"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { GUIDE_COOKIE } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

// "Got it" on the first-run guide. The cookie holds the user id, so another
// account on the same browser still gets its own guide. It is a display
// setting, not user data.
export async function hideGuide() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return;
  (await cookies()).set(GUIDE_COOKIE, id, {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/app");
}
