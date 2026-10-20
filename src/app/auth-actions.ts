"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isValidEmail,
  isValidPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/validate";

export type AuthState = { message: string } | null;

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = credentials(formData);
  if (!isValidEmail(email)) return { message: "Enter a valid email." };
  if (!isValidPassword(password))
    return {
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`,
    };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { message: error.message };
  // With email confirmation off (the grading contract), sign-up returns a session.
  if (!data.session) return { message: "Account created. Log in to continue." };
  redirect("/app");
}

export async function logIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = credentials(formData);
  if (!isValidEmail(email) || !password)
    return { message: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { message: "That email and password don't match." };
  redirect("/app");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
