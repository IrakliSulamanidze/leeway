import { LINES } from "../core/lines";
import { ReplyError } from "../core/pipeline";
import type { Inbound, Reply } from "../core/types";
import type { Messenger } from "../ports";
import type { Inbox } from "./db-gate";
import { log } from "./log";
import { MetaSendError } from "./meta/cloud-api";
import { readMessages } from "./meta/payload";
import { sameToken, validSignature } from "./meta/signature";

// Meta documents webhook bodies of up to 3 MB.
const MAX_BODY = 3 * 1024 * 1024;
// Meta expects an answer within about 10 s; stop starting work well before.
const BUDGET_MS = 8_500;
const MIN_LEFT_MS = 3_000;

export type WebhookDeps = {
  appSecret: string;
  inbox: Inbox;
  messenger: Messenger;
  process: (msg: Inbound) => Promise<Reply[]>;
  now?: () => number;
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

// Errors where trying again later can work: Meta or the network having a bad
// moment, rate limits, and an expired or wrong token (fixed by updating it).
// A refusal about this one recipient or message will not change.
function retryable(error: unknown): boolean {
  if (!(error instanceof MetaSendError)) return true;
  return (
    error.status >= 500 ||
    error.status === 429 ||
    error.status === 401 ||
    error.status === 403 ||
    error.code === 190
  );
}

const describeError = (error: unknown) =>
  error instanceof MetaSendError
    ? `meta status ${error.status}, code ${error.code ?? "none"}`
    : `${error instanceof Error ? error.name : "unknown"}${
        typeof (error as { code?: unknown })?.code === "string"
          ? ` ${(error as { code: string }).code}`
          : ""
      }`;

// POST: checks the signature on the raw body, then handles each message once.
// Answers 500 only when a retry could help, so Meta redelivers just those.
export async function receive(
  req: Request,
  deps: WebhookDeps,
): Promise<Response> {
  const now = deps.now ?? Date.now;
  const deadline = now() + BUDGET_MS;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY)
    return new Response(null, { status: 413 });
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  if (
    !validSignature(raw, req.headers.get("x-hub-signature-256"), deps.appSecret)
  )
    return new Response(null, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    json = null;
  }
  // Signed by Meta but unreadable: a retry would bring the same bytes.
  const { messages, skipped } = readMessages(json);
  if (skipped)
    log.warn("webhook: skipped unreadable messages", String(skipped));

  let retry = false;
  for (const { msg, replyTo } of messages) {
    // Left unclaimed, so Meta's retry handles it with a fresh time budget.
    if (deadline - now() < MIN_LEFT_MS) {
      retry = true;
      break;
    }
    if (!(await deps.inbox.claim(msg.id))) continue;

    let replies: Reply[];
    try {
      replies = await deps.process(msg);
    } catch (error) {
      if (error instanceof ReplyError) {
        // A bug in a reply won't fix itself on retry.
        log.error(
          "reply: invalid",
          `${error.intent}: ${error.problems.join("; ")}`,
        );
        replies = [{ text: LINES.notUnderstood }];
      } else {
        log.error("message: failed, will retry", describeError(error));
        await deps.inbox.release(msg.id).catch(() => undefined);
        retry = true;
        continue;
      }
    }

    // Once anything reached the student the message is finished, even if a
    // later reply fails: a retry would repeat what they already have. Before
    // that, a passing failure releases it for Meta's retry, which runs the
    // request again; writes made by requests are keyed on the message id so a
    // second run changes nothing.
    let sent = 0;
    try {
      for (const reply of replies) {
        await sendWithOneRetry(
          deps.messenger,
          replyTo,
          reply,
          () => deadline - now(),
        );
        sent++;
      }
      await deps.inbox.finish(msg.id);
    } catch (error) {
      if (sent === 0 && retryable(error)) {
        log.error("send: failed, will retry", describeError(error));
        await deps.inbox.release(msg.id).catch(() => undefined);
        retry = true;
      } else {
        log.error("send: failed, not retrying", describeError(error));
        await deps.inbox.finish(msg.id).catch(() => undefined);
      }
    }
  }
  return new Response(null, { status: retry ? 500 : 200 });
}

async function sendWithOneRetry(
  messenger: Messenger,
  to: string,
  reply: Reply,
  timeLeft: () => number,
): Promise<void> {
  try {
    await messenger.send(to, reply);
  } catch (error) {
    if (!retryable(error) || timeLeft() < MIN_LEFT_MS) throw error;
    await new Promise((r) => setTimeout(r, 300));
    await messenger.send(to, reply);
  }
}
