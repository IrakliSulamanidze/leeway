"use server";

import { revalidatePath } from "next/cache";
import { MAX_ITEM_LENGTH } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type SaveResult =
  { ok: true; id: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One tap = one log_skip call: it finds or creates the course by name and saves
// the skip as the user, so RLS applies. Only the typed text is required.
export async function logSkip(text: unknown): Promise<SaveResult> {
  if (typeof text !== "string" || !text.trim())
    return { ok: false, message: "Type the class you're skipping." };
  if (text.length > MAX_ITEM_LENGTH)
    return {
      ok: false,
      message: `Keep it under ${MAX_ITEM_LENGTH} characters.`,
    };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_skip", { p_text: text });
  if (error || !data)
    return { ok: false, message: "Couldn't save. Try again." };
  revalidatePath("/app");
  return { ok: true, id: data.id };
}

// Undo: removes the skip, and the course too when that skip created it and
// nothing else was logged against it since.
export async function deleteSkip(id: unknown): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false };
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

  revalidatePath("/app");
  return { ok: true };
}
