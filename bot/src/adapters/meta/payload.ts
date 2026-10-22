import { z } from "zod";
import type { Inbound, InboundBody } from "../../core/types";

// The parts of Meta's webhook payload the bot reads. Unknown fields are ignored,
// so Meta adding fields never breaks parsing.
const Message = z.object({
  id: z.string().min(1).max(256),
  // Phone number; Meta may omit it for users with a username.
  from: z.string().max(32).optional(),
  // Business-scoped user id. Meta's docs say incoming messages carry it; the
  // phone number is the fallback.
  from_user_id: z.string().max(140).optional(),
  timestamp: z.string().regex(/^\d{1,12}$/),
  type: z.string(),
  text: z.object({ body: z.string().max(4096) }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string().max(256) }).optional(),
      list_reply: z.object({ id: z.string().max(256) }).optional(),
    })
    .optional(),
  button: z.object({ payload: z.string().max(256) }).optional(),
  audio: z.object({ id: z.string().max(256) }).optional(),
});

// The envelope is checked loosely and each message on its own, so one odd
// message never stops the others in the same delivery.
const Payload = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z
            .object({ messages: z.array(z.unknown()).optional() })
            .loose(),
        }),
      ),
    }),
  ),
});

// Not something a student asked: no reply, and not counted against the cap.
const IGNORED = new Set([
  "system",
  "reaction",
  "unsupported",
  "ephemeral",
  "request_welcome",
]);

type MetaMessage = z.infer<typeof Message>;

// One message to answer: the core's view of it, and where the reply goes.
export type Incoming = { msg: Inbound; replyTo: string };

function bodyOf(m: MetaMessage): InboundBody {
  if (m.type === "text" && m.text) return { kind: "text", text: m.text.body };
  const tapped =
    m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id;
  if (m.type === "interactive" && tapped) return { kind: "button", id: tapped };
  if (m.type === "button" && m.button)
    return { kind: "button", id: m.button.payload };
  if (m.type === "audio" && m.audio)
    return { kind: "voice", mediaId: m.audio.id };
  return { kind: "unsupported" };
}

// Returns the messages in a webhook POST, and how many were skipped as
// unreadable. Status updates, reactions and Meta's notices produce nothing.
export function readMessages(json: unknown): {
  messages: Incoming[];
  skipped: number;
} {
  const payload = Payload.safeParse(json);
  if (!payload.success || payload.data.object !== "whatsapp_business_account")
    return { messages: [], skipped: 1 };
  const out: Incoming[] = [];
  let skipped = 0;
  for (const entry of payload.data.entry)
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      for (const raw of change.value.messages ?? []) {
        const parsed = Message.safeParse(raw);
        if (!parsed.success) {
          skipped++;
          continue;
        }
        const m = parsed.data;
        const sender = m.from_user_id ?? m.from;
        if (!sender || IGNORED.has(m.type)) continue;
        out.push({
          msg: {
            id: m.id,
            from: sender,
            at: new Date(Number(m.timestamp) * 1000),
            body: bodyOf(m),
          },
          replyTo: m.from ?? sender,
        });
      }
    }
  return { messages: out, skipped };
}
