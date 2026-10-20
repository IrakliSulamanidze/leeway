// syncFeed against the local Supabase: user session path and admin (cron) path.
// Run: eval "$(supabase status -o env | sed 's/^/export /')" && npx vitest run --config vitest.integration.config.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { FEED_ERRORS, FeedError } from "@/lib/calendar/errors";
import { syncFeed } from "@/lib/calendar/sync";
import type { Database } from "@/lib/db/types";

const URL = process.env.API_URL!;
const ANON = process.env.ANON_KEY!;
const SERVICE = process.env.SERVICE_ROLE_KEY!;
type Db = SupabaseClient<Database>;

const FIXTURE = readFileSync(
  join(__dirname, "../../src/lib/calendar/__fixtures__/ie-public.ics"),
  "utf8",
);
const FEED_URL = "https://cal.example.com/feed?key=integration-secret";

// The fixture without the events whose UID passes `drop`.
function without(drop: (uid: string) => boolean): string {
  return FIXTURE.replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT\r?\n/g, (block) =>
    drop(/UID:(\S+)/.exec(block)![1]) ? "" : block,
  );
}
const fetcherFor = (body: string) => async () => ({
  status: 200,
  contentType: "text/calendar",
  body,
});

let clock = Date.parse("2026-10-20T10:00:00Z");
const tick = () => new Date((clock += 60_000));

async function user(admin: Db, name: string) {
  const email = `${name}-${Date.now()}@test.local`;
  const { data } = await admin.auth.admin.createUser({
    email,
    password: "password-123",
    email_confirm: true,
  });
  const db = createClient<Database>(URL, ANON, {
    auth: { persistSession: false },
  });
  await db.auth.signInWithPassword({ email, password: "password-123" });
  return { id: data.user!.id, db };
}

describe.skipIf(!URL || !SERVICE)("syncFeed", () => {
  let admin: Db;
  let a: Awaited<ReturnType<typeof user>>;
  let b: Awaited<ReturnType<typeof user>>;
  let feed: string;
  const getUrl = () => async () => {
    const { data } = await a.db.rpc("feed_url_for_sync", { p_feed: feed });
    return data as string | null;
  };
  const sync = (body: string, now = tick()) =>
    syncFeed(a.db, feed, a.id, getUrl(), fetcherFor(body), now);

  beforeAll(async () => {
    admin = createClient<Database>(URL, SERVICE, {
      auth: { persistSession: false },
    });
    a = await user(admin, "a");
    b = await user(admin, "b");
    feed = (await a.db.rpc("connect_feed", { p_url: FEED_URL })).data as string;
    // B has their own data, which an admin sync of A must not touch.
    const feedB = (await b.db.rpc("connect_feed", { p_url: FEED_URL }))
      .data as string;
    await b.db.rpc("log_skip", { p_text: "COURSE KILO" });
    await syncFeed(
      b.db,
      feedB,
      b.id,
      async () => FEED_URL,
      fetcherFor(FIXTURE),
      tick(),
    );
  });

  it("first sync stores nothing and lists course keys as pending, titles only", async () => {
    expect(await sync(FIXTURE)).toMatchObject({
      status: "ok",
      sessions: 0,
      // The 8 fall-term courses; last term's events are outside the sync range.
      pending: 8,
    });
    const { count } = await a.db
      .from("class_sessions")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(0);
    const { data } = await a.db
      .from("feed_course_map")
      .select("source_key, status");
    expect(data!.every((r) => r.status === "pending")).toBe(true);
    expect(data!.map((r) => r.source_key)).toContain("COURSE KILO");
  });

  it("stores mapped courses only, recounts sessions and marks the exam slot", async () => {
    for (const name of ["COURSE KILO", "COURSE PAPA"]) {
      const course = (
        await a.db.from("courses").insert({ name }).select("id").single()
      ).data!;
      await a.db
        .from("feed_course_map")
        .update({ course_id: course.id, status: "mapped" })
        .eq("source_key", name);
    }
    expect(await sync(FIXTURE)).toMatchObject({ status: "ok", pending: 0 });
    const { data: courses } = await a.db
      .from("courses")
      .select("name, sessions_calendar")
      .order("name");
    expect(courses).toEqual([
      { name: "COURSE KILO", sessions_calendar: 30 },
      { name: "COURSE PAPA", sessions_calendar: 30 },
    ]);
    const { data: slots } = await a.db
      .from("class_sessions")
      .select("session_numbers")
      .eq("is_exam_slot", true);
    expect(slots).toEqual([{ session_numbers: [30] }]);
    const { count } = await a.db
      .from("class_sessions")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(30 + 20);
    // A resync changes nothing: upsert by UID, no duplicates.
    await sync(FIXTURE);
    expect(
      (
        await a.db
          .from("class_sessions")
          .select("id", { count: "exact", head: true })
      ).count,
    ).toBe(50);
  });

  it("two syncs at once: the second is busy", async () => {
    const now = tick();
    const [x, y] = await Promise.all([sync(FIXTURE, now), sync(FIXTURE, now)]);
    expect([x.status, y.status].sort()).toEqual(["busy", "ok"]);
  });

  it("a cancelled class releases a planned skip with a notice and keeps a logged one", async () => {
    const { data: kilo } = await a.db
      .from("class_sessions")
      .select("id, uid, starts_at, course_id")
      .eq("kind", "class")
      .gt("starts_at", "2026-11-01")
      .order("starts_at")
      .limit(2);
    const [planned, logged] = kilo!;
    const day = (iso: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(
        new Date(iso),
      );
    await a.db.from("skips").insert([
      {
        course_id: planned.course_id,
        text_typed: "plan",
        planned: true,
        skip_date: day(planned.starts_at),
        class_session_id: planned.id,
      },
      {
        course_id: logged.course_id,
        text_typed: "logged",
        planned: false,
        skip_date: day(logged.starts_at),
        class_session_id: logged.id,
      },
    ]);
    expect(
      await sync(without((u) => u === planned.uid || u === logged.uid)),
    ).toMatchObject({ status: "ok" });
    const { data: skips } = await a.db
      .from("skips")
      .select("text_typed, class_session_id");
    expect(skips).toEqual([{ text_typed: "logged", class_session_id: null }]);
    const { data: notices } = await a.db.from("notices").select("body");
    expect(
      notices!.some((n) => n.body.includes("planned skip was released")),
    ).toBe(true);
    // Restoring the class links the logged skip back to it by date.
    await sync(FIXTURE);
    const { data: relinked } = await a.db
      .from("skips")
      .select("class_session_id");
    expect(relinked![0].class_session_id).not.toBeNull();
  });

  it("glitch guard: losing over 30% of future sessions fails and keeps everything", async () => {
    const before = (
      await a.db
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
    ).count;
    const result = await sync(without((u) => u.startsWith("F")));
    expect(result).toEqual({ status: "failed", error: FEED_ERRORS.glitch });
    expect(
      (
        await a.db
          .from("class_sessions")
          .select("id", { count: "exact", head: true })
      ).count,
    ).toBe(before);
    const { data } = await a.db
      .from("calendar_feeds")
      .select("status, last_error")
      .eq("id", feed)
      .single();
    expect(data).toEqual({ status: "failed", last_error: FEED_ERRORS.glitch });
  });

  it("fetch failures store fixed strings only", async () => {
    const failing = async () => {
      throw new FeedError("timeout");
    };
    expect(await syncFeed(a.db, feed, a.id, getUrl(), failing, tick())).toEqual(
      {
        status: "failed",
        error: FEED_ERRORS.timeout,
      },
    );
    const crash = async () => {
      throw new Error(`boom ${FEED_URL}`);
    };
    await syncFeed(a.db, feed, a.id, getUrl(), crash, tick());
    const { data } = await a.db
      .from("calendar_feeds")
      .select("last_error")
      .eq("id", feed)
      .single();
    expect(Object.values(FEED_ERRORS)).toContain(data!.last_error);
  });

  it("admin (cron) sync of A works through getUrl and leaves B byte-identical", async () => {
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all(
          (
            [
              "courses",
              "skips",
              "calendar_feeds",
              "feed_course_map",
              "class_sessions",
              "notices",
            ] as const
          ).map(
            async (t) =>
              (
                await admin
                  .from(t)
                  .select("*")
                  .eq("user_id", b.id)
                  .order("created_at")
              ).data,
          ),
        ),
      );
    const before = await snapshot();
    const cronGetUrl = async () =>
      (
        await admin
          .from("calendar_feeds")
          .select("url")
          .eq("id", feed)
          .eq("user_id", a.id)
          .single()
      ).data?.url ?? null;
    expect(
      await syncFeed(
        admin,
        feed,
        a.id,
        cronGetUrl,
        fetcherFor(FIXTURE),
        tick(),
      ),
    ).toMatchObject({
      status: "ok",
    });
    expect(await snapshot()).toBe(before);
  });
});
