"use server";

import { revalidatePath } from "next/cache";
import { MAX_ITEM_LENGTH } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

// Typing only in core-input saves an item: user_id defaults to auth.uid().
export async function addItem(formData: FormData) {
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, MAX_ITEM_LENGTH);
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("items").insert({ title });
  revalidatePath("/app");
}
