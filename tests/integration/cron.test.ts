// The nightly cron against local Supabase (npm run test:integration).
// Push is mocked: web-push is never called, and no real VAPID keys exist.
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { GET } from "@/app/api/cron/nightly/route";
import { runNightly, type FeedSync } from "@/lib/server/nightly";
import { sendToUser, type PushSub, type Sender } from "@/lib/server/push";

vi.mock("web-push", () => ({ sendNotification: vi.fn() }));

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
const NIGHT = new Date("2026-10-20T19:30:00Z"); // 21:30 Madrid, Tuesday
const TOMORROW_9 = "2026-10-21T07:00:00Z"; // 9:00 Madrid
const SECRET = "x".repeat(32);
const users: string[] = [];

async function student(opts: {
  missed?: number;
  classTomorrow?: boolean;
  feed?: { status: string; last_synced_at: string | null };
  subs?: number;
}) {
  const email = `cron-${crypto.randomUUID()}@example.com`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  users.push(userId);
  const course = await db
    .from("courses")
    .insert({
      user_id: userId,
      name: "Statistics II",
      sessions_typed: 30,
      missed_before: opts.missed ?? 5,
    })
    .select("id")
    .single();
  const feed = await db
    .from("calendar_feeds")
    .insert({
      user_id: userId,
      url: `https://example.com/${crypto.randomUUID()}.ics`,
      status: opts.feed?.status ?? "ok",
      last_synced_at: opts.feed?.last_synced_at ?? "2026-10-20T10:00:00Z",
    })
    .select("id")
    .single();
  if (course.error || feed.error) throw course.error ?? feed.error;
  const addClass = async (starts_at: string) => {
    const r = await db.from("class_sessions").insert({
      user_id: userId,
      course_id: course.data.id,
      feed_id: feed.data.id,
      uid: crypto.randomUUID(),
      original_start: starts_at,
      starts_at,
      ends_at: new Date(Date.parse(starts_at) + 90 * 60_000).toISOString(),
      kind: "class",
    });
    if (r.error) throw r.error;
  };
  if (opts.classTomorrow ?? true) await addClass(TOMORROW_9);
  const subs = Array.from({ length: opts.subs ?? 1 }, (_, i) => ({
    user_id: userId,
    endpoint: `https://fcm.googleapis.com/fcm/send/${userId}-${i}`,
    p256dh: "p",
    auth: "a",
  }));
  const s = await db.from("push_subscriptions").insert(subs);
  if (s.error) throw s.error;
  return { userId, feedId: feed.data.id, addClass };
}

// Records which of our users got a push; other local users are ignored.
function recorder() {
  const sent: { userId: string; body: string }[] = [];
  const send = vi.fn(async (subs: PushSub[], body: string) => {
    const userId = subs[0]?.endpoint.split("/").pop()?.slice(0, 36) ?? "";
    if (users.includes(userId)) sent.push({ userId, body });
    return { sent: subs.length, gone: [] as string[] };
  });
  return { sent, send };
}
const forUser = (sent: { userId: string; body: string }[], id: string) =>
  sent.filter((s) => s.userId === id);

beforeAll(() => {
  if (!process.env.SUPABASE_SECRET_KEY)
    throw new Error("run via npm run test:integration");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  for (const id of users) await db.auth.admin.deleteUser(id);
});

describe("cron route auth", () => {
  const call = (auth?: string) =>
    GET(
      new Request("http://localhost/api/cron/nightly", {
        headers: auth ? { authorization: auth } : {},
      }),
    );

  it("returns 500 when CRON_SECRET is unset or shorter than 32 chars", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer undefined")).status).toBe(500);
    vi.stubEnv("CRON_SECRET", "short-secret");
    expect((await call("Bearer short-secret")).status).toBe(500);
  });

  it("returns 401 without or with a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer ${"y".repeat(32)}`)).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
  });

  it("runs with the right secret (no-op outside 21:xx Madrid)", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
  });
});

describe("runNightly", () => {
  it("does nothing outside 21:xx Madrid", async () => {
    await student({});
    const { sent, send } = recorder();
    for (const now of ["2026-10-20T18:30:00Z", "2026-10-20T20:00:00Z"]) {
      const r = await runNightly({ db, now: new Date(now), send });
      expect(r.ran).toBe(false);
    }
    expect(sent).toEqual([]);
  });

  it("sends one push per user per night across two runs", async () => {
    const a = await student({});
    const calm = await student({ missed: 0 });
    const { sent, send } = recorder();
    await runNightly({ db, now: NIGHT, send });
    await runNightly({ db, now: new Date("2026-10-20T19:45:00Z"), send });
    expect(forUser(sent, a.userId)).toEqual([
      {
        userId: a.userId,
        body: "Tomorrow 9:00 Statistics II. Last life, don't skip.",
      },
    ]);
    expect(forUser(sent, calm.userId)).toEqual([]);
  });

  it("re-syncs the calendar first, reading the link with the admin client", async () => {
    const a = await student({ classTomorrow: false });
    const { sent, send } = recorder();
    const urls: (string | null)[] = [];
    const syncFeed: FeedSync = async (_db, feedId, userId, getUrl) => {
      urls.push(await getUrl());
      if (userId === a.userId && feedId === a.feedId)
        await a.addClass(TOMORROW_9);
    };
    await runNightly({ db, now: NIGHT, send, syncFeed });
    expect(urls.some((u) => u?.startsWith("https://example.com/"))).toBe(true);
    expect(forUser(sent, a.userId)).toHaveLength(1);
  });

  it("still alerts from old data when the sync fails, saying as of when", async () => {
    const a = await student({
      feed: { status: "failed", last_synced_at: "2026-10-19T10:00:00Z" },
    });
    const { sent, send } = recorder();
    const syncFeed: FeedSync = async () => {
      throw new Error("feed down");
    };
    await runNightly({ db, now: NIGHT, send, syncFeed });
    expect(forUser(sent, a.userId)[0]?.body).toBe(
      "Tomorrow 9:00 Statistics II. Last life, don't skip.\nCalendar as of Mon.",
    );
  });

  it("deletes subscriptions the push service reports as 410 or 404", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public");
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private");
    vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");
    const a = await student({ subs: 3 });
    const codes = [410, 404, 201];
    const fake: Sender = async (sub) => {
      if (!sub.endpoint.includes(a.userId)) return {};
      const code = codes.shift();
      if (code !== 201) throw { statusCode: code };
      return {};
    };
    await runNightly({
      db,
      now: NIGHT,
      send: (subs, body) => sendToUser(subs, body, fake),
    });
    const left = await db
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", a.userId);
    expect(left.data).toHaveLength(1);
  });
});
