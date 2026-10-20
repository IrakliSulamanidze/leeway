import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { nightAlert, type AlertTest } from "@/lib/rules/alert";
import {
  addDays,
  dateIn,
  MADRID,
  madridToday,
  madridTomorrow,
  zonedToUtc,
} from "@/lib/rules/dates";
import { sendToUser, type PushSub } from "./push";

type Db = SupabaseClient<Database>;
// syncFeed from src/lib/calendar/sync.ts (tech-plan 5.2).
export type FeedSync = (
  db: Db,
  feedId: string,
  userId: string,
  getUrl: () => Promise<string | null>,
) => Promise<unknown>;

export type NightlyDeps = {
  db: Db;
  // Without one, alerts use the last synced data.
  syncFeed?: FeedSync;
  now?: Date;
  send?: typeof sendToUser;
  budgetMs?: number;
  random?: () => number;
};
export type NightlyResult = {
  ran: boolean;
  users: number;
  sent: number;
  removed: number;
};

const LOOKAHEAD_DAYS = 14;

function madridHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: MADRID,
      hourCycle: "h23",
      hour: "2-digit",
    }).format(now),
  );
}

function shuffle<T>(xs: T[], random: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Resolves when p settles or the deadline passes; never rejects.
function until(p: Promise<unknown>, deadline: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, Math.max(0, deadline - Date.now()));
    p.catch(() => undefined).finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function alertFor(db: Db, userId: string, now: Date, deps: NightlyDeps) {
  const deadline = Date.now() + (deps.budgetMs ?? 4_000);
  const feeds = await db
    .from("calendar_feeds")
    .select("id")
    .eq("user_id", userId);
  // Re-sync each feed inside this user's budget; a slow or failed sync leaves
  // the last synced data in place.
  const sync = deps.syncFeed;
  for (const f of sync ? (feeds.data ?? []) : []) {
    if (Date.now() >= deadline) break;
    const getUrl = async () =>
      (
        await db
          .from("calendar_feeds")
          .select("url")
          .eq("id", f.id)
          .eq("user_id", userId)
          .maybeSingle()
      ).data?.url ?? null;
    await until(
      Promise.resolve().then(() => sync?.(db, f.id, userId, getUrl)),
      deadline,
    );
  }

  const tomorrow = madridTomorrow(now);
  const from = zonedToUtc(`${tomorrow}T00:00`, MADRID).toISOString();
  const to = zonedToUtc(
    `${addDays(tomorrow, LOOKAHEAD_DAYS)}T00:00`,
    MADRID,
  ).toISOString();
  const [state, courses, skips, classes, tests] = await Promise.all([
    db
      .from("calendar_feeds")
      .select("status, last_synced_at")
      .eq("user_id", userId),
    db
      .from("courses")
      .select(
        "id, name, sessions_typed, sessions_syllabus, sessions_calendar, missed_before",
      )
      .eq("user_id", userId),
    db
      .from("skips")
      .select("course_id, sessions, skip_date, planned")
      .eq("user_id", userId),
    db
      .from("class_sessions")
      .select("id, course_id, starts_at, kind, is_exam_slot")
      .eq("user_id", userId)
      .gte("starts_at", from)
      .lt("starts_at", to),
    db
      .from("assessments")
      .select("course_id, on_date, class_session_id")
      .eq("user_id", userId),
  ]);
  const startOf = new Map(
    (classes.data ?? []).map((k) => [k.id, k.starts_at] as const),
  );
  const feedRows = state.data ?? [];
  const failed = feedRows.filter((f) => f.status === "failed");
  const syncedOn = failed
    .map((f) => f.last_synced_at)
    .filter((d): d is string => !!d)
    .sort()[0];
  return nightAlert({
    tomorrow,
    courses: courses.data ?? [],
    skips: skips.data ?? [],
    classes: classes.data ?? [],
    tests: (tests.data ?? []).map((t): AlertTest => ({
      course_id: t.course_id,
      on_date: t.on_date,
      class_starts_at: t.class_session_id
        ? (startOf.get(t.class_session_id) ?? null)
        : null,
    })),
    calendar: feedRows.length
      ? {
          failed: failed.length > 0,
          syncedOn: syncedOn ? dateIn(new Date(syncedOn), MADRID) : null,
        }
      : null,
  });
}

export async function runNightly(deps: NightlyDeps): Promise<NightlyResult> {
  const { db } = deps;
  const now = deps.now ?? new Date();
  // Read first, before the hour gate: this daily query keeps the database awake.
  const { data: rows } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, created_at");
  const result: NightlyResult = { ran: false, users: 0, sent: 0, removed: 0 };
  if (madridHour(now) !== 21) return result;
  result.ran = true;

  const byUser = new Map<string, PushSub[]>();
  for (const r of rows ?? [])
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  const night = madridToday(now);
  // Stop before Vercel's 300 s limit; users run in random order, so a cut
  // never starves the same people every night.
  const stopAt = Date.now() + 270_000;

  for (const userId of shuffle(
    [...byUser.keys()],
    deps.random ?? Math.random,
  )) {
    if (Date.now() > stopAt) break;
    result.users++;
    const message = await alertFor(db, userId, now, deps);
    if (!message) continue;
    // At most one push per user per night, enforced by the primary key.
    const claim = await db
      .from("alert_log")
      .upsert(
        { user_id: userId, night },
        { onConflict: "user_id,night", ignoreDuplicates: true },
      )
      .select("night");
    if (!claim.data?.length) continue;
    const { sent, gone } = await (deps.send ?? sendToUser)(
      byUser.get(userId) ?? [],
      message,
    );
    result.sent += sent;
    if (gone.length) {
      await db
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .in("id", gone);
      result.removed += gone.length;
    }
  }
  return result;
}
