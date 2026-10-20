import { createClient } from "./server";

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

// The signed-in user's email, or null when logged out (or when a fresh local
// copy has no Supabase keys yet).
export async function getSignedInEmail(): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return String(data.claims.email ?? "");
}
