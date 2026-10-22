// Shapes that cross the core boundary. Adapters translate provider payloads into
// Inbound and Reply into provider calls; the core never sees either provider.

export type Inbound = {
  // Provider message id; the webhook uses it to drop redeliveries.
  id: string;
  // Sender's WhatsApp id (international number, digits only).
  from: string;
  // When the student sent it, from the provider's timestamp, not our clock.
  at: Date;
  body: InboundBody;
};

export type InboundBody =
  | { kind: "text"; text: string }
  | { kind: "button"; id: string }
  | { kind: "voice"; mediaId: string }
  | { kind: "unsupported" };

export type Button = { id: string; title: string };

export type Reply = { text: string; buttons?: Button[] };
