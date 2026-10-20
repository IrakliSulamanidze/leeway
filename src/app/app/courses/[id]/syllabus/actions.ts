"use server";

import { revalidatePath } from "next/cache";
import { madridDate, sessionDates } from "@/lib/syllabus/dates";
import { confirmSchema } from "@/lib/syllabus/rows";
import { createClient } from "@/lib/supabase/server";

export type ConfirmResult = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "Couldn't save. Check your connection and try again.";

// The only place syllabus rows are written: after the student confirms each line.
// Replaces the course's syllabus tests and topics; manual and feed tests stay.
export async function confirmSyllabus(input: unknown): Promise<ConfirmResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: SAVE_FAILED };
  const c = parsed.data;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: SAVE_FAILED };

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", c.courseId)
    .maybeSingle();
  if (!course) return { ok: false, error: SAVE_FAILED };

  const { data: classes } = await supabase
    .from("class_sessions")
    .select("starts_at, session_numbers")
    .eq("course_id", c.courseId);
  const dates = sessionDates(classes ?? []);

  const steps = [
    () =>
      supabase
        .from("assessments")
        .delete()
        .eq("course_id", c.courseId)
        .eq("source", "syllabus"),
    () =>
      supabase.from("syllabus_sessions").delete().eq("course_id", c.courseId),
    () =>
      c.tests.length
        ? supabase.from("assessments").insert(
            c.tests.map((t) => ({
              course_id: c.courseId,
              session_number: t.session_number,
              on_date: dates.has(t.session_number)
                ? madridDate(dates.get(t.session_number)!)
                : null,
              title: t.title,
              weight: t.weight,
              weight_assumed: t.weight_assumed,
              source: "syllabus",
            })),
          )
        : null,
    () =>
      c.topics.length
        ? supabase
            .from("syllabus_sessions")
            .insert(c.topics.map((t) => ({ course_id: c.courseId, ...t })))
        : null,
    () =>
      supabase
        .from("courses")
        .update({
          sessions_syllabus: c.sessionsTotal,
          participation_weight: c.participation,
        })
        .eq("id", c.courseId),
  ];
  for (const step of steps) {
    const res = await step();
    if (res?.error) {
      console.error("syllabus confirm failed", res.error.code);
      return { ok: false, error: SAVE_FAILED };
    }
  }
  revalidatePath(`/app/courses/${c.courseId}`);
  revalidatePath("/app");
  return { ok: true };
}
