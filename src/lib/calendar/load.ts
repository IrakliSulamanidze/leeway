import "server-only";
import { createClient } from "@/lib/supabase/server";
import { livesLeft } from "@/lib/rules/lives";
import {
  classCost,
  dedupeClasses,
  madridDate,
  skippable,
  type WeekAssessment,
  type WeekClass,
  type WeekCourse,
  type WeekSkip,
} from "@/lib/rules/week";

// The student's calendar state, read with their own session (RLS applies).
// calendar_feeds never selects url: the column is not even granted.
export async function loadFeeds() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_feeds")
    .select("id, status, last_synced_at, last_attempt_at, last_error")
    .order("created_at");
  return data ?? [];
}

// True when a course was linked to the calendar but has no classes yet: the
// sync that stores them hasn't run since (it is throttled to one per 30
// seconds, and the client retry dies if the student leaves the page).
export async function hasUnsyncedCourses(): Promise<boolean> {
  const supabase = await createClient();
  const { data: maps } = await supabase
    .from("feed_course_map")
    .select("course_id")
    .eq("status", "mapped")
    .not("course_id", "is", null);
  const ids = [...new Set((maps ?? []).map((m) => m.course_id as string))];
  if (ids.length === 0) return false;
  const { data: rows } = await supabase
    .from("class_sessions")
    .select("course_id")
    .in("course_id", ids);
  const withClasses = new Set((rows ?? []).map((r) => r.course_id));
  return ids.some((id) => !withClasses.has(id));
}

// Request time, read once on the server and passed down as a prop.
export function requestTime(): number {
  return Date.now();
}

export type Feed = Awaited<ReturnType<typeof loadFeeds>>[number];

export async function loadPendingMaps() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feed_course_map")
    .select("id, source_key")
    .eq("status", "pending")
    .order("source_key");
  return (data ?? []).filter((m): m is { id: string; source_key: string } =>
    Boolean(m.source_key),
  );
}

export async function loadNotices() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("id, body")
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

// Per course, from the calendar: sessions still ahead that a skip could take
// (for "Attendance safe") and whether it has any class this term (else it goes
// to "Past courses"). Courses without calendar classes are not in either map.
export async function loadCourseCalendar(
  now: string,
  term: { start: string; end: string },
) {
  const supabase = await createClient();
  const [{ data: rows }, { data: linked }] = await Promise.all([
    supabase
      .from("class_sessions")
      .select("id, course_id, starts_at, kind, is_exam_slot, session_numbers"),
    supabase
      .from("skips")
      .select("class_session_id")
      .not("class_session_id", "is", null),
  ]);
  const taken = new Set((linked ?? []).map((s) => s.class_session_id));
  const remaining = new Map<string, number>();
  const thisTerm = new Map<string, boolean>();
  for (const c of dedupeClasses((rows ?? []) as WeekClass[])) {
    const day = madridDate(c.starts_at);
    const inTerm = day >= term.start && day <= term.end;
    thisTerm.set(c.course_id, (thisTerm.get(c.course_id) ?? false) || inTerm);
    const ahead =
      skippable(c) && c.starts_at > now && !taken.has(c.id) ? classCost(c) : 0;
    remaining.set(c.course_id, (remaining.get(c.course_id) ?? 0) + ahead);
  }
  return { remaining, thisTerm };
}

// Everything the week tools need for a date range.
export async function loadWeekData(range: { from: string; to: string }) {
  const supabase = await createClient();
  const from = new Date(`${range.from}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${range.to}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 2);
  const [courses, sessions, skips, assessments] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, sessions_typed, sessions_syllabus, sessions_calendar, missed_before",
      )
      .order("name"),
    supabase
      .from("class_sessions")
      .select(
        "id, course_id, starts_at, ends_at, all_day, kind, is_exam_slot, session_numbers",
      )
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    supabase
      .from("skips")
      .select("course_id, class_session_id, skip_date, sessions, planned"),
    supabase
      .from("assessments")
      .select("course_id, class_session_id, session_number, on_date, title"),
  ]);
  const skipRows = skips.data ?? [];
  return {
    courses: (courses.data ?? []).map((c): WeekCourse => ({
      id: c.id,
      name: c.name,
      left: livesLeft(c, skipRows).left,
    })),
    sessions: (sessions.data ?? []) as WeekClass[],
    skips: skipRows as WeekSkip[],
    assessments: (assessments.data ?? []) as WeekAssessment[],
  };
}
