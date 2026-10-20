"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MAX_ITEM_LENGTH } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type SaveResult =
  { ok: true; id: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (id: unknown): id is string =>
  typeof id === "string" && UUID.test(id);
const isInt = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

// One tap = one log_skip call: it finds or creates the course by name and saves
// the skip as the user, so RLS applies. Only the typed text is required.
export async function logSkip(
  text: unknown,
  day: unknown = "today",
  sessions: unknown = 1,
): Promise<SaveResult> {
  if (typeof text !== "string" || !text.trim())
    return { ok: false, message: "Type the class you're skipping." };
  if (text.length > MAX_ITEM_LENGTH)
    return {
      ok: false,
      message: `Keep it under ${MAX_ITEM_LENGTH} characters.`,
    };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_skip", {
    p_text: text,
    p_day: day === "tomorrow" ? "tomorrow" : "today",
    p_sessions: sessions === 2 ? 2 : 1,
  });
  if (error || !data)
    return {
      ok: false,
      message: "Couldn't save. Check your connection and try again.",
    };
  revalidatePath("/app", "layout");
  return { ok: true, id: data.id };
}

// Undo: removes the skip, and the course too when that skip created it and
// nothing else was logged against it since.
export async function deleteSkip(id: unknown): Promise<{ ok: boolean }> {
  if (!isId(id)) return { ok: false };
  const supabase = await createClient();
  const { data: skip, error } = await supabase
    .from("skips")
    .delete()
    .eq("id", id)
    .select("course_id, created_at")
    .maybeSingle();
  if (error || !skip) return { ok: false };

  const { data: course } = await supabase
    .from("courses")
    .select("created_at, skips(count)")
    .eq("id", skip.course_id)
    .maybeSingle();
  const remaining = course?.skips?.[0]?.count ?? 0;
  if (course && course.created_at === skip.created_at && remaining === 0)
    await supabase.from("courses").delete().eq("id", skip.course_id);

  revalidatePath("/app", "layout");
  return { ok: true };
}

// Delete on any skip, cancel on a planned one. The course always stays.
export async function removeSkip(id: unknown): Promise<{ ok: boolean }> {
  if (!isId(id)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("skips").delete().eq("id", id);
  if (error) return { ok: false };
  revalidatePath("/app", "layout");
  return { ok: true };
}

// Sessions 1 to 200.
export async function setCourseNumbers(
  id: unknown,
  sessions: unknown,
): Promise<{ ok: boolean; message?: string }> {
  if (!isId(id)) return { ok: false };
  if (!isInt(sessions, 1, 200))
    return { ok: false, message: "Sessions must be 1 to 200." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ sessions_typed: sessions })
    .eq("id", id);
  if (error)
    return {
      ok: false,
      message: "Couldn't save. Check your connection and try again.",
    };
  revalidatePath("/app", "layout");
  return { ok: true };
}

// Classes missed before the student started logging, 0 to 200. Classes
// marked in the calendar are skips and never part of this number.
export async function setMissedBefore(
  id: unknown,
  missed: unknown,
): Promise<{ ok: boolean }> {
  if (!isId(id) || !isInt(missed, 0, 200)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ missed_before: missed })
    .eq("id", id);
  if (error) return { ok: false };
  revalidatePath("/app", "layout");
  return { ok: true };
}

// Deletes the course and, by cascade, its skips.
export async function removeCourse(id: unknown) {
  if (!isId(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return;
  revalidatePath("/app", "layout");
  redirect("/app/courses");
}

// The definer function deletes the auth user; every table cascades from it.
// The session is already invalid afterwards, so sign-out only clears cookies.
export async function deleteAccount(): Promise<{ ok: false }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false };
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
