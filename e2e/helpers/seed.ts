import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// Seeds calendar rows for e2e tests with the LOCAL Supabase secret key, read at
// runtime from `supabase status` and never written anywhere. Lives outside src/
// (the contract check fails if src/ imports it) and refuses any non-local URL.
function localAdmin() {
  const env = Object.fromEntries(
    execSync("supabase status -o env", { encoding: "utf8" })
      .split("\n")
      .map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  const url = env.API_URL;
  const key = env.SECRET_KEY || env.SERVICE_ROLE_KEY;
  if (!url || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url))
    throw new Error("seed.ts only runs against a local Supabase");
  if (!key) throw new Error("local secret key not found in supabase status");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const madridToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(
    new Date(),
  );

export type Seeded = {
  email: string;
  password: string;
  courses: Record<string, string>;
  classes: Record<string, string>;
};

type ClassSeed = {
  key: string;
  course: string;
  day: string;
  hourUtc: number;
  kind?: "class" | "async" | "exam";
  examSlot?: boolean;
  sessions?: number[];
};

// One confirmed user with a synced calendar, its courses and classes.
export async function seedCalendarUser(opts: {
  courses: string[];
  classes: ClassSeed[];
  tests?: { course: string; day: string }[];
  pending?: string[];
  lastSyncedAt?: string;
}): Promise<Seeded> {
  const db = localAdmin();
  const run = Math.random().toString(36).slice(2, 10);
  const email = `cal-${run}@example.com`;
  const password = `pw-${run}-cal`;
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error("could not create seed user");
  const user_id = created.user.id;

  const { data: feed } = await db
    .from("calendar_feeds")
    .insert({
      user_id,
      url: `https://calendar.example.test/${run}.ics`,
      status: "ok",
      last_synced_at: opts.lastSyncedAt ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (!feed) throw new Error("could not seed feed");

  const courses: Record<string, string> = {};
  for (const name of opts.courses) {
    const { data } = await db
      .from("courses")
      .insert({ user_id, name, sessions_calendar: 30 })
      .select("id")
      .single();
    courses[name] = data!.id;
  }

  const classes: Record<string, string> = {};
  for (const [i, c] of opts.classes.entries()) {
    const start = new Date(`${c.day}T00:00:00Z`);
    start.setUTCHours(c.hourUtc);
    const { data } = await db
      .from("class_sessions")
      .insert({
        user_id,
        feed_id: feed.id,
        course_id: courses[c.course],
        uid: `seed-${run}-${i}`,
        original_start: start.toISOString(),
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 80 * 60_000).toISOString(),
        kind: c.kind ?? "class",
        is_exam_slot: c.examSlot ?? false,
        session_numbers: c.sessions ?? [i + 1],
      })
      .select("id")
      .single();
    classes[c.key] = data!.id;
  }

  for (const [i, key] of (opts.pending ?? []).entries())
    await db.from("feed_course_map").insert({
      user_id,
      feed_id: feed.id,
      source_key: key,
      source_hash: `seed-${run}-${i}`,
      status: "pending",
    });

  for (const t of opts.tests ?? [])
    await db.from("assessments").insert({
      user_id,
      course_id: courses[t.course],
      on_date: t.day,
      title: "Midterm",
      source: "manual",
    });

  return { email, password, courses, classes };
}
