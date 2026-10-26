// Turns messages from a regular WhatsApp account (through Baileys) into the
// core's Inbound, and the core's replies into plain text. Used only for the
// pilot on an ordinary number (docs/bot/pilot.md); the Cloud API path is the
// real one.
import type { Button, Inbound, Reply } from "../../core/types";

// The parts of a Baileys message the bot reads.
export type RawMessage = {
  key: {
    remoteJid?: string | null;
    remoteJidAlt?: string | null;
    fromMe?: boolean | null;
    id?: string | null;
  };
  message?: {
    conversation?: string | null;
    extendedTextMessage?: { text?: string | null } | null;
    audioMessage?: unknown;
  } | null;
  messageTimestamp?: number | { toNumber(): number } | null;
};

const PHONE_JID = /^(\d{6,20})(?::\d+)?@s\.whatsapp\.net$/;

// The sender's phone number: from the chat id, or from its alternate id when
// WhatsApp hides the number behind a private id (@lid).
function phoneOf(key: RawMessage["key"]): string | null {
  for (const jid of [key.remoteJid, key.remoteJidAlt]) {
    const m = jid ? PHONE_JID.exec(jid) : null;
    if (m) return m[1];
  }
  return null;
}

export type Incoming = { msg: Inbound; replyTo: string };

// Only one-to-one messages from other people. Groups, status updates,
// channels and the account's own messages are ignored.
export function toInbound(raw: RawMessage, now: Date): Incoming | null {
  const { key } = raw;
  if (key.fromMe || !key.id || !key.remoteJid) return null;
  if (!/@(s\.whatsapp\.net|lid)$/.test(key.remoteJid)) return null;
  const from = phoneOf(key);
  if (!from) return null;
  const ts = raw.messageTimestamp;
  const seconds = typeof ts === "number" ? ts : ts ? ts.toNumber() : null;
  const at = seconds ? new Date(seconds * 1000) : now;
  const text =
    raw.message?.conversation ?? raw.message?.extendedTextMessage?.text ?? null;
  const body: Inbound["body"] =
    typeof text === "string"
      ? { kind: "text", text: text.slice(0, 4096) }
      : raw.message?.audioMessage
        ? { kind: "voice", mediaId: key.id }
        : { kind: "unsupported" };
  return { msg: { id: key.id, from, at, body }, replyTo: key.remoteJid };
}

// Ordinary accounts can't send tap buttons, so each one becomes a numbered
// line; the student answers with the number.
export function toText(reply: Reply): string {
  if (!reply.buttons?.length) return reply.text;
  const options = reply.buttons
    .map((b, i) => `${i + 1}. ${b.title}`)
    .join("\n");
  return `${reply.text}\n\nReply with a number:\n${options}`;
}

const MENU_TTL_MS = 15 * 60 * 1000;

// The numbered options last offered to each sender, so "2" can be read back
// as the button it stood for. Kept in memory only, for 15 minutes.
export class NumberedMenus {
  private readonly menus = new Map<string, { buttons: Button[]; at: number }>();

  remember(sender: string, replies: Reply[], now: number): void {
    const last = [...replies].reverse().find((r) => r.buttons?.length);
    if (last?.buttons)
      this.menus.set(sender, { buttons: last.buttons, at: now });
    else if (replies.length) this.menus.delete(sender);
  }

  // A bare number that matches a live menu becomes that button's tap.
  resolve(msg: Inbound, now: number): Inbound {
    if (msg.body.kind !== "text") return msg;
    const n = /^\s*([1-9])\s*\.?\s*$/.exec(msg.body.text);
    const menu = this.menus.get(msg.from);
    if (!n || !menu || now - menu.at > MENU_TTL_MS) return msg;
    const button = menu.buttons[Number(n[1]) - 1];
    if (!button) return msg;
    this.menus.delete(msg.from);
    return { ...msg, body: { kind: "button", id: button.id } };
  }
}
