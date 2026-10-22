import type { Reply } from "../../core/types";
import type { Messenger } from "../../ports";

const GRAPH = "https://graph.facebook.com/v25.0";

export class MetaSendError extends Error {
  readonly status: number;
  readonly code: number | undefined;

  constructor(status: number, code: number | undefined) {
    super(`Meta refused the message: HTTP ${status}, code ${code ?? "none"}`);
    this.name = "MetaSendError";
    this.status = status;
    this.code = code;
  }
}

// The request body for one reply: plain text, or text with reply buttons.
export function messageBody(to: string, reply: Reply) {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
  };
  if (!reply.buttons?.length)
    return {
      ...base,
      type: "text",
      text: { body: reply.text, preview_url: false },
    };
  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: reply.text },
      action: {
        buttons: reply.buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  };
}

// Sends through the WhatsApp Cloud API. Errors carry Meta's status and code,
// never the token or the message text.
export function cloudApiMessenger(
  phoneNumberId: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Messenger {
  return {
    async send(to, reply) {
      const res = await fetchImpl(`${GRAPH}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageBody(to, reply)),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { code?: number };
        } | null;
        throw new MetaSendError(res.status, json?.error?.code);
      }
    },
  };
}
