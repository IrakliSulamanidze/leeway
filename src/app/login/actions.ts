"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validate";

export type LoginState = { ok: boolean; message: string } | null;

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  if (!isValidEmail(email))
    return { ok: false, message: "Enter a valid email." };
  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Check your email for a login link." };
}
