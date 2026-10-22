import type { Reply } from "./types";

// WhatsApp Cloud API limits for a text or reply-button message.
export const LIMITS = {
  textBody: 4096,
  buttonBody: 1024,
  buttons: 3,
  buttonTitle: 20,
  buttonId: 256,
} as const;

// Returns what is wrong with a reply, or an empty list. Every reply the core
// produces passes through this before it can be sent.
export function replyProblems(reply: Reply): string[] {
  const problems: string[] = [];
  const buttons = reply.buttons ?? [];
  const maxBody = buttons.length ? LIMITS.buttonBody : LIMITS.textBody;

  if (!reply.text.trim()) problems.push("empty text");
  if (reply.text.length > maxBody)
    problems.push(`text longer than ${maxBody} characters`);
  if (buttons.length > LIMITS.buttons)
    problems.push(`more than ${LIMITS.buttons} buttons`);

  const ids = new Set<string>();
  for (const b of buttons) {
    if (!b.title.trim() || b.title.length > LIMITS.buttonTitle)
      problems.push(
        `button title "${b.title}" must be 1 to ${LIMITS.buttonTitle} characters`,
      );
    if (!b.id || b.id.length > LIMITS.buttonId)
      problems.push(`button id must be 1 to ${LIMITS.buttonId} characters`);
    if (ids.has(b.id)) problems.push(`duplicate button id "${b.id}"`);
    ids.add(b.id);
  }
  return problems;
}
