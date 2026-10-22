import { LINES } from "../core/lines";
import { ReplyError } from "../core/pipeline";
import type { Inbound, Reply } from "../core/types";
import type { Messenger } from "../ports";
import type { Inbox } from "./db-gate";
import { log } from "./log";
import { MetaSendError } from "./meta/cloud-api";
import { readMessages } from "./meta/payload";
import { sameToken, validSignature } from "./meta/signature";

// Meta's largest webhook body.
const MAX_BODY = 3 * 1024 * 1024;

export type WebhookDeps = {
  appSecret: string;
  inbox: Inbox;
  messenger: Messenger;
  process: (msg: Inbound) => Promise<Reply[]>;
};

// GET: Meta's subscription handshake.
export function verifySubscription(url: URL, verifyToken: string): Response {
  const ok =
    url.searchParams.get("hub.mode") === "subscribe" &&
    sameToken(url.searchParams.get("hub.verify_token"), verifyToken);
  return ok
    ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 })
    : new Response(null, { status: 403 });
}

// POST: checks the signature on the raw body, then handles each message once.
// Answers 500 only when a retry could help, so Meta redelivers just those.
export async function receive(
  req: Request,
  deps: WebhookDeps,
): Promise<Response> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY)
    return new Response(null, { status: 413 });
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  if (
    !validSignature(raw, req.headers.get("x-hub-signature-256"), deps.appSecret)
  )
    return new Response(null, { status: 401 });

  let incoming;
  try {
    incoming = readMessages(JSON.parse(raw.toString("utf8")));
  } catch {
    log.warn("webhook: unreadable payload");
    return new Response(null, { status: 400 });
  }

  let retry = false;
  for (const { msg, replyTo } of incoming) {
    if (!(await deps.inbox.claim(msg.id))) continue;
    try {
      for (const reply of await deps.process(msg))
        await deps.messenger.send(replyTo, reply);
    } catch (error) {
      if (error instanceof ReplyError) {
        // A bug in a reply won't fix itself on retry: say so and move on.
        log.error(
          "reply: invalid",
          `${error.intent}: ${error.problems.join("; ")}`,
        );
        await deps.messenger
          .send(replyTo, { text: LINES.notUnderstood })
          .catch(() => undefined);
      } else if (
        error instanceof MetaSendError &&
        error.status < 500 &&
        error.status !== 429
      ) {
        log.error(
          "send: refused",
          `status ${error.status}, code ${error.code ?? "none"}`,
        );
      } else {
        log.error(
          "message: failed, will retry",
          error instanceof Error ? error.name : "unknown",
        );
        await deps.inbox.release(msg.id).catch(() => undefined);
        retry = true;
      }
    }
  }
  return new Response(null, { status: retry ? 500 : 200 });
}
