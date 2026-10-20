"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normName, suggestName } from "@/lib/calendar/names";
import { madridDate } from "@/lib/rules/week";

export type ConnectState = { ok: boolean; error: string | null };

// Messages connect_feed raises. They are fixed text, never the link itself.
const CONNECT_ERRORS = [
  "Use a calendar link that starts with https:// or webcal://.",
  "You can connect up to 3 calendars.",
  "Log in first.",
];

const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

function refresh() {
  revalidatePath("/app", "layout");
}

// The feed link travels only in this POST body. It is never put in a URL, a
// redirect, a log line or the returned state, so it can't be echoed back.
export async function connectFeed(
  _prev: ConnectState,
  form: FormData,
): Promise<ConnectState> {
  const link = field(form, "link");
  if (!link) return { ok: false, error: "Paste the link first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("connect_feed", { p_url: link });
  if (error) {
    const known = CONNECT_ERRORS.find((m) => m === error.message);
    return {
      ok: false,
      error: known ?? "That link is not a calendar link we can use.",
    };
  }
  refresh();
  return { ok: true, error: null };
}

export async function disconnectFeed(form: FormData) {
  const supabase = await createClient();
  await supabase.from("calendar_feeds").delete().eq("id", field(form, "id"));
  refresh();
}

// Course mapping: confirm as a new course, link to an existing one, or ignore.
export async function mapCourse(form: FormData) {
  const id = field(form, "id");
  const choice = field(form, "choice");
  const supabase = await createClient();
  if (choice === "ignore") {
    await supabase
      .from("feed_course_map")
      .update({ status: "ignored", source_key: null, course_id: null })
      .eq("id", id);
  } else {
    let courseId = field(form, "course");
    if (choice === "new") {
      const name = field(form, "name").slice(0, 200);
      if (!name) return;
      const { data } = await supabase
        .from("courses")
        .insert({ name })
        .select("id")
        .single();
      if (!data) return;
      courseId = data.id;
    }
    if (!courseId) return;
    await supabase
      .from("feed_course_map")
      .update({ status: "mapped", course_id: courseId })
      .eq("id", id);
  }
  refresh();
}

// "Add all": every pending course under its suggested name. A name that is
// already a course, or that two sections share, links to that one course.
export async function addAllCourses() {
  const supabase = await createClient();
  const [{ data: pending }, { data: courses }] = await Promise.all([
    supabase
      .from("feed_course_map")
      .select("id, source_key")
      .eq("status", "pending")
      .limit(60),
    supabase.from("courses").select("id, name"),
  ]);
  const byName = new Map(
    (courses ?? []).map((c) => [normName(c.name), c.id as string]),
  );
  for (const m of pending ?? []) {
    if (!m.source_key) continue;
    const name = suggestName(m.source_key);
    if (!name) continue;
    let courseId = byName.get(normName(name));
    if (!courseId) {
      const { data } = await supabase
        .from("courses")
        .insert({ name })
        .select("id")
        .single();
      if (!data) continue;
      courseId = data.id as string;
      byName.set(normName(name), courseId);
    }
    await supabase
      .from("feed_course_map")
      .update({ status: "mapped", course_id: courseId })
      .eq("id", m.id);
  }
  refresh();
}

export async function dismissNotice(form: FormData) {
  const supabase = await createClient();
  await supabase
    .from("notices")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", field(form, "id"));
  refresh();
}

// "All good" closes this week's Sunday card.
export async function weeklyAllGood(form: FormData) {
  const supabase = await createClient();
  await supabase
    .from("weekly_checks")
    .upsert(
      { week_start: field(form, "week") },
      { onConflict: "user_id,week_start", ignoreDuplicates: true },
    );
  refresh();
}

// Skipped switch on a class in Today. Exam slots are never toggleable.
export async function toggleSkipped(form: FormData) {
  const classId = field(form, "class");
  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("class_sessions")
    .select("id, course_id, starts_at, kind, is_exam_slot, session_numbers")
    .eq("id", classId)
    .single();
  if (!cls || cls.is_exam_slot || !["class", "async"].includes(cls.kind))
    return;
  const { data: existing } = await supabase
    .from("skips")
    .select("id")
    .eq("class_session_id", classId);
  // A skip typed in the skip box for that course and day shows as this class
  // too (isPlanned), so switching it off removes that one.
  const { data: typed } = existing?.length
    ? { data: [] }
    : await supabase
        .from("skips")
        .select("id")
        .is("class_session_id", null)
        .eq("course_id", cls.course_id)
        .eq("skip_date", madridDate(cls.starts_at))
        .limit(1);
  if (existing?.length) {
    await supabase.from("skips").delete().eq("class_session_id", classId);
  } else if (typed?.length) {
    await supabase.from("skips").delete().eq("id", typed[0].id);
  } else {
    const { data: course } = await supabase
      .from("courses")
      .select("name")
      .eq("id", cls.course_id)
      .single();
    if (!course) return;
    await supabase.from("skips").insert({
      course_id: cls.course_id,
      class_session_id: cls.id,
      text_typed: course.name,
      skip_date: madridDate(cls.starts_at),
      sessions: cls.session_numbers.length >= 2 ? 2 : 1,
    });
  }
  refresh();
}

// A test mark by date (on a course) or on one class.
export async function markTest(form: FormData) {
  const courseId = field(form, "course");
  const onDate = field(form, "date");
  const classId = field(form, "class");
  if (!courseId || (!onDate && !classId)) return;
  const supabase = await createClient();
  // A mark on one class also stores that class's date, so the course page
  // and the countdown can show it.
  let date = /^\d{4}-\d{2}-\d{2}$/.test(onDate) ? onDate : null;
  if (!date && classId) {
    const { data: cls } = await supabase
      .from("class_sessions")
      .select("starts_at")
      .eq("id", classId)
      .maybeSingle();
    if (cls) date = madridDate(cls.starts_at);
  }
  await supabase.from("assessments").insert({
    course_id: courseId,
    on_date: date,
    class_session_id: classId || null,
    title: field(form, "title").slice(0, 200) || "Test",
    source: "manual",
  });
  refresh();
}

// Undo a test marked by hand on one class or on its date (a mis-tap on
// Quiz, Midterm or Final). Tests read from a syllabus stay.
export async function unmarkTest(form: FormData) {
  const courseId = field(form, "course");
  const classId = field(form, "class");
  const day = field(form, "date");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!courseId || !uuid.test(classId) || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    return;
  const supabase = await createClient();
  await supabase
    .from("assessments")
    .delete()
    .eq("course_id", courseId)
    .eq("source", "manual")
    .or(`class_session_id.eq.${classId},on_date.eq.${day}`);
  refresh();
}

// Trip check: save each class in the dates as a planned skip.
export async function saveTrip(form: FormData) {
  const ids = form.getAll("class").map(String).filter(Boolean).slice(0, 60);
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("class_sessions")
    .select("id, course_id, starts_at, kind, is_exam_slot, session_numbers")
    .in("id", ids);
  const { data: courses } = await supabase.from("courses").select("id, name");
  const { data: taken } = await supabase
    .from("skips")
    .select("class_session_id")
    .in("class_session_id", ids);
  const skipped = new Set((taken ?? []).map((s) => s.class_session_id));
  const names = new Map((courses ?? []).map((c) => [c.id, c.name]));
  const today = madridDate(new Date().toISOString());
  const rows = (classes ?? [])
    .filter(
      (c) =>
        !c.is_exam_slot &&
        ["class", "async"].includes(c.kind) &&
        !skipped.has(c.id),
    )
    .map((c) => ({
      course_id: c.course_id,
      class_session_id: c.id,
      text_typed: names.get(c.course_id) ?? "Class",
      skip_date: madridDate(c.starts_at),
      planned: madridDate(c.starts_at) > today,
      sessions: c.session_numbers.length >= 2 ? 2 : 1,
    }));
  if (rows.length) await supabase.from("skips").insert(rows);
  refresh();
}
