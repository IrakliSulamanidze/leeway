"use server";

import { isPushEndpoint } from "@/lib/push-hosts";
import { createClient } from "@/lib/supabase/server";

export type SubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Saves this browser's push subscription for the signed-in student. Endpoints
// that aren't a known push service are refused, so the nightly job never
// fetches a host a student chose.
export async function savePushSubscription(
  input: SubscriptionInput,
): Promise<{ ok: boolean }> {
  const endpoint = String(input?.endpoint ?? "");
  const p256dh = String(input?.p256dh ?? "");
  const auth = String(input?.auth ?? "");
  if (
    endpoint.length > 1000 ||
    !isPushEndpoint(endpoint) ||
    p256dh.length < 1 ||
    p256dh.length > 200 ||
    auth.length < 1 ||
    auth.length > 100
  )
    return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { endpoint, p256dh, auth },
      { onConflict: "user_id,endpoint", ignoreDuplicates: true },
    );
  return { ok: !error };
}
