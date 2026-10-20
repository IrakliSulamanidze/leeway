import "server-only";
import { createClient } from "@/lib/supabase/server";
import { livesLeft } from "@/lib/rules/lives";
import type {
  WeekAssessment,
  WeekClass,
  WeekCourse,
  WeekSkip,
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
      .select("id, course_id, starts_at, kind, is_exam_slot, session_numbers")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    supabase
      .from("skips")
      .select("course_id, class_session_id, skip_date, sessions, planned"),
    supabase
      .from("assessments")
      .select("course_id, class_session_id, session_number, on_date"),
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
