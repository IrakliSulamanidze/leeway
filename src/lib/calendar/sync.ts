// Keeps one feed's class sessions in step with the calendar (tech-plan 5.2) without
// ever losing a logged skip. Runs as the user (route) or with the admin client
// (nightly job); every query is scoped to userId, so it never touches anyone else.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  classifyIE,
  classifyOther,
  isIEFeed,
  type SessionKind,
} from "./classify-ie";
import {
  FEED_ERRORS,
  FeedError,
  logCode,
  type FeedErrorCode,
  type FeedErrorMessage,
} from "./errors";
import { parseFeed } from "./parse";
import { safeFetch, type Fetcher } from "./safe-fetch";

type Db = SupabaseClient<Database>;
type SessionRow = Database["public"]["Tables"]["class_sessions"]["Insert"];

export type SyncResult =
  | { status: "ok"; sessions: number; pending: number }
  | { status: "busy" }
  | { status: "failed"; error: FeedErrorMessage };

// Fall 2026 (7 Sep to 18 Dec). Events are read from 7 days before to 120 after.
export const SYNC_TERM = { start: "2026-09-07", end: "2026-12-18" };
const DAY = 86_400_000;
const GUARD_MS = 30_000;
const GLITCH_SHARE = 0.3;
const MIN_EVENTS_OTHER_FEEDS = 3;

class DbError extends Error {}

function must<T>(
  res: { data: T; error: { code?: string } | null },
  where: string,
): NonNullable<T> {
  if (res.error) {
    logCode(`sync ${where}`, res.error.code);
    throw new DbError(where);
  }
  // A select without an error always returns its rows (writes without select return null, unused).
  return res.data as NonNullable<T>;
}

export function madridDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(
    at,
  );
}

function madridLabel(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(at);
}

export function sourceHash(courseKey: string): string {
  return createHash("sha256").update(courseKey).digest("hex");
}

const livesFor = (sessions: number) => Math.floor(sessions * 0.2);
const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;
const key = (uid: string, originalStart: string | Date) =>
  `${uid}\u0000${new Date(originalStart).getTime()}`;

export async function syncFeed(
  db: Db,
  feedId: string,
  userId: string,
  getUrl: () => Promise<string | null>,
  fetcher: Fetcher = safeFetch,
  now: Date = new Date(),
): Promise<SyncResult> {
  // 1. Two-tab guard: only one sync per feed every 30 seconds.
  const claimed = must(
    await db
      .from("calendar_feeds")
      .update({ last_attempt_at: now.toISOString() })
      .eq("id", feedId)
      .eq("user_id", userId)
      .or(
        `last_attempt_at.is.null,last_attempt_at.lt.${new Date(now.getTime() - GUARD_MS).toISOString()}`,
      )
      .select("id"),
    "claim",
  );
  if (!claimed.length) return { status: "busy" };

  const fail = async (code: FeedErrorCode): Promise<SyncResult> => {
    await db
      .from("calendar_feeds")
      .update({ status: "failed", last_error: FEED_ERRORS[code] })
      .eq("id", feedId)
      .eq("user_id", userId);
    return { status: "failed", error: FEED_ERRORS[code] };
  };

  try {
    return await run(db, feedId, userId, getUrl, fetcher, now, fail);
  } catch (err) {
    if (err instanceof FeedError) return fail(err.code);
    if (!(err instanceof DbError)) logCode("sync", "unexpected");
    return fail("unreadable");
  }
}

async function run(
  db: Db,
  feedId: string,
  userId: string,
  getUrl: () => Promise<string | null>,
  fetcher: Fetcher,
  now: Date,
  fail: (code: FeedErrorCode) => Promise<SyncResult>,
): Promise<SyncResult> {
  // 2. Fetch and parse.
  const url = await getUrl();
  if (!url) return fail("badLink");
  const { body } = await fetcher(url);
  const range = {
    from: new Date(Date.parse(`${SYNC_TERM.start}T00:00:00Z`) - 7 * DAY),
    to: new Date(Date.parse(`${SYNC_TERM.end}T00:00:00Z`) + 120 * DAY),
  };
  let events;
  try {
    events = parseFeed(body, range);
  } catch {
    return fail("unreadable");
  }

  // 3. Classify; group by course key. Other feeds only offer keys seen 3+ times.
  const ie = isIEFeed(events);
  const groups = new Map<
    string,
    { title: string; count: number; titleFromExam: boolean }
  >();
  const items = events.flatMap((e) => {
    const c = ie ? classifyIE(e) : classifyOther(e);
    if (!c || !c.courseKey) return [];
    const g = groups.get(c.courseKey);
    if (!g)
      groups.set(c.courseKey, {
        title: c.title,
        count: 1,
        titleFromExam: c.kind === "exam",
      });
    else {
      g.count += 1;
      if (g.titleFromExam && c.kind !== "exam")
        Object.assign(g, { title: c.title, titleFromExam: false });
    }
    return [{ e, c, hash: sourceHash(c.courseKey) }];
  });

  const mapRows = must(
    await db
      .from("feed_course_map")
      .select("source_hash, course_id, status")
      .eq("feed_id", feedId)
      .eq("user_id", userId),
    "read map",
  );
  const known = new Map(mapRows.map((r) => [r.source_hash, r]));
  const fresh = [...groups.entries()]
    .filter(
      ([k, g]) =>
        !known.has(sourceHash(k)) && (ie || g.count >= MIN_EVENTS_OTHER_FEEDS),
    )
    .map(([k, g]) => ({
      user_id: userId,
      feed_id: feedId,
      source_key: clip(g.title || k, 300),
      source_hash: sourceHash(k),
      status: "pending",
    }));
  if (fresh.length)
    must(
      await db.from("feed_course_map").upsert(fresh, {
        onConflict: "feed_id,source_hash",
        ignoreDuplicates: true,
      }),
      "add pending",
    );

  // Only mapped keys keep their events; pending and ignored ones are never stored.
  const desired = new Map<string, SessionRow & { kind: SessionKind }>();
  for (const { e, c, hash } of items) {
    const m = known.get(hash);
    if (m?.status !== "mapped" || !m.course_id) continue;
    desired.set(key(e.uid, e.originalStart), {
      user_id: userId,
      feed_id: feedId,
      course_id: m.course_id,
      uid: e.uid,
      original_start: e.originalStart.toISOString(),
      starts_at: e.start.toISOString(),
      ends_at: e.end.toISOString(),
      all_day: e.allDay,
      kind: c.kind,
      session_numbers: c.sessionNumbers,
      is_exam_slot: false,
    });
  }

  // 6. Exam slot: a class of the same course starting 30 min into an exam.
  const rows = [...desired.values()];
  for (const exam of rows.filter((r) => r.kind === "exam")) {
    const examStart = Date.parse(exam.starts_at);
    for (const r of rows)
      if (
        r.kind === "class" &&
        r.course_id === exam.course_id &&
        Date.parse(r.starts_at) === examStart + 30 * 60_000 &&
        Date.parse(r.starts_at) < Date.parse(exam.ends_at)
      )
        r.is_exam_slot = true;
  }

  // 4. Glitch guard: dropping over 30% of stored future sessions means a bad feed.
  const stored = must(
    await db
      .from("class_sessions")
      .select("id, uid, original_start, starts_at, course_id")
      .eq("feed_id", feedId)
      .eq("user_id", userId)
      .gte("starts_at", range.from.toISOString())
      .lt("starts_at", range.to.toISOString()),
    "read sessions",
  );
  const vanished = stored.filter(
    (s) => !desired.has(key(s.uid, s.original_start)),
  );
  const future = stored.filter((s) => Date.parse(s.starts_at) > now.getTime());
  const futureGone = vanished.filter(
    (s) => Date.parse(s.starts_at) > now.getTime(),
  );
  if (future.length && futureGone.length > GLITCH_SHARE * future.length)
    return fail("glitch");

  // 5. Upsert by (feed, uid, original start); release planned skips of vanished classes.
  if (rows.length)
    must(
      await db
        .from("class_sessions")
        .upsert(rows, { onConflict: "feed_id,uid,original_start" }),
      "upsert sessions",
    );
  if (vanished.length) await removeVanished(db, userId, vanished, now);

  const mappedCourses = [
    ...new Set(
      mapRows.filter((r) => r.status === "mapped").map((r) => r.course_id!),
    ),
  ];
  // 7. Recount sessions_calendar; 8. link unlinked skips.
  if (mappedCourses.length) {
    await recount(db, userId, mappedCourses);
    await linkSkips(db, userId, mappedCourses);
  }

  must(
    await db
      .from("calendar_feeds")
      .update({
        status: "ok",
        last_error: null,
        last_synced_at: now.toISOString(),
      })
      .eq("id", feedId)
      .eq("user_id", userId),
    "finish",
  );
  return { status: "ok", sessions: rows.length, pending: fresh.length };
}

async function removeVanished(
  db: Db,
  userId: string,
  vanished: { id: string; starts_at: string; course_id: string }[],
  now: Date,
) {
  const ids = vanished.map((v) => v.id);
  const today = madridDate(now);
  const released = must(
    await db
      .from("skips")
      .delete()
      .eq("user_id", userId)
      .eq("planned", true)
      .gte("skip_date", today)
      .in("class_session_id", ids)
      .select("class_session_id, course_id"),
    "release planned",
  );
  if (released.length) {
    const names = await courseNames(db, userId, [
      ...new Set(released.map((r) => r.course_id)),
    ]);
    const notices = released.map((r) => {
      const at = new Date(
        vanished.find((v) => v.id === r.class_session_id)!.starts_at,
      );
      return {
        user_id: userId,
        body: clip(
          `${clip(names.get(r.course_id) ?? "A course", 120)} on ${madridLabel(at)} is no longer in your calendar, so your planned skip was released.`,
          300,
        ),
      };
    });
    must(await db.from("notices").insert(notices), "notice released");
  }
  // A test pinned only to a vanished class keeps its date, so it isn't lost.
  const pinned = must(
    await db
      .from("assessments")
      .select("id, class_session_id")
      .eq("user_id", userId)
      .is("on_date", null)
      .is("session_number", null)
      .in("class_session_id", ids),
    "read pinned tests",
  );
  for (const a of pinned) {
    const at = new Date(
      vanished.find((v) => v.id === a.class_session_id)!.starts_at,
    );
    must(
      await db
        .from("assessments")
        .update({ on_date: madridDate(at) })
        .eq("id", a.id)
        .eq("user_id", userId),
      "keep test date",
    );
  }
  must(
    await db
      .from("class_sessions")
      .delete()
      .eq("user_id", userId)
      .in("id", ids),
    "delete sessions",
  );
}

async function courseNames(db: Db, userId: string, ids: string[]) {
  const rows = must(
    await db
      .from("courses")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", ids),
    "names",
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function recount(db: Db, userId: string, courseIds: string[]) {
  const sessions = must(
    await db
      .from("class_sessions")
      .select("course_id, kind, session_numbers")
      .eq("user_id", userId)
      .in("course_id", courseIds)
      .in("kind", ["class", "async"]),
    "read counts",
  );
  const courses = must(
    await db
      .from("courses")
      .select("id, name, sessions_typed, sessions_syllabus, sessions_calendar")
      .eq("user_id", userId)
      .in("id", courseIds),
    "read courses",
  );
  for (const c of courses) {
    const numbers = new Set<number>();
    let unnumberedAsync = 0;
    for (const s of sessions.filter((x) => x.course_id === c.id)) {
      s.session_numbers.forEach((n) => numbers.add(n));
      if (s.kind === "async" && !s.session_numbers.length) unnumberedAsync += 1;
    }
    const count = Math.min(numbers.size + unnumberedAsync, 200) || null;
    if (count === c.sessions_calendar) continue;
    must(
      await db
        .from("courses")
        .update({ sessions_calendar: count })
        .eq("id", c.id)
        .eq("user_id", userId),
      "update count",
    );
    const usesCalendar =
      c.sessions_typed == null && c.sessions_syllabus == null;
    if (
      usesCalendar &&
      c.sessions_calendar != null &&
      count != null &&
      livesFor(count) !== livesFor(c.sessions_calendar)
    ) {
      const change =
        count < c.sessions_calendar ? "lost a session" : "gained a session";
      must(
        await db.from("notices").insert({
          user_id: userId,
          body: `${clip(c.name, 200)} ${change}. Lives now ${livesFor(count)}.`,
        }),
        "notice count",
      );
    }
  }
}

async function linkSkips(db: Db, userId: string, courseIds: string[]) {
  const skips = must(
    await db
      .from("skips")
      .select("id, course_id, skip_date")
      .eq("user_id", userId)
      .is("class_session_id", null)
      .in("course_id", courseIds),
    "read skips",
  );
  if (!skips.length) return;
  const linked = must(
    await db
      .from("skips")
      .select("class_session_id")
      .eq("user_id", userId)
      .not("class_session_id", "is", null),
    "read links",
  );
  const taken = new Set(linked.map((l) => l.class_session_id));
  const classes = must(
    await db
      .from("class_sessions")
      .select("id, course_id, starts_at")
      .eq("user_id", userId)
      .in("course_id", courseIds)
      .in("kind", ["class", "async"])
      .eq("is_exam_slot", false)
      .order("starts_at"),
    "read classes",
  );
  for (const s of skips) {
    const match = classes.find(
      (c) =>
        c.course_id === s.course_id &&
        !taken.has(c.id) &&
        madridDate(new Date(c.starts_at)) === s.skip_date,
    );
    if (!match) continue;
    taken.add(match.id);
    const res = await db
      .from("skips")
      .update({ class_session_id: match.id })
      .eq("id", s.id)
      .eq("user_id", userId)
      .is("class_session_id", null);
    // A concurrent save may have linked the class first (unique index); skip it.
    if (res.error && res.error.code !== "23505")
      logCode("sync link", res.error.code);
  }
}
