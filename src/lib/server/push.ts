import "server-only";
import { sendNotification, type RequestOptions } from "web-push";
import { isPushEndpoint } from "@/lib/push-hosts";

export const PUSH_TIMEOUT_MS = 5_000;
export const MAX_SUBS_PER_USER = 5;

export type PushSub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};
export type Sender = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: RequestOptions,
) => Promise<unknown>;

function vapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function pushConfigured(): boolean {
  return vapid() !== null;
}

// The 5 newest subscriptions on a known push service, in that order.
export function pickSubs(subs: PushSub[]): PushSub[] {
  return subs
    .filter((s) => isPushEndpoint(s.endpoint))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_SUBS_PER_USER);
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), PUSH_TIMEOUT_MS);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

// Sends one message to a user's devices. Returns how many got it and the ids
// of subscriptions the push service says are gone (404/410), to delete.
export async function sendToUser(
  subs: PushSub[],
  body: string,
  send: Sender = sendNotification,
): Promise<{ sent: number; gone: string[] }> {
  const details = vapid();
  if (!details) return { sent: 0, gone: [] };
  const payload = JSON.stringify({ title: "Leeway", body, url: "/app" });
  let sent = 0;
  const gone: string[] = [];
  for (const s of pickSubs(subs)) {
    try {
      await withTimeout(
        send(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          {
            vapidDetails: details,
            TTL: 12 * 3600,
            timeout: PUSH_TIMEOUT_MS,
          },
        ),
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) gone.push(s.id);
    }
  }
  return { sent, gone };
}
