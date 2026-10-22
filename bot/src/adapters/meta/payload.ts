import { z } from "zod";
import type { Inbound, InboundBody } from "../../core/types";

// The parts of Meta's webhook payload the bot reads. Unknown fields are ignored,
// so Meta adding fields never breaks parsing.
const Message = z.object({
  id: z.string().min(1).max(256),
  // Phone number; Meta may omit it for users with a username.
  from: z.string().max(32).optional(),
  // Business-scoped user id, present on every message since April 2026.
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

const Payload = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({ messages: z.array(Message).optional() }).loose(),
        }),
      ),
    }),
  ),
});

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

// Returns the messages in a webhook POST. Status updates and Meta's system
// notices produce nothing here. Throws on a payload that is not Meta's shape.
export function readMessages(json: unknown): Incoming[] {
  const payload = Payload.parse(json);
  const out: Incoming[] = [];
  for (const entry of payload.entry)
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      for (const m of change.value.messages ?? []) {
        const sender = m.from_user_id ?? m.from;
        if (!sender || m.type === "system") continue;
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
  return out;
}
