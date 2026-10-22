import { describe, expect, it } from "vitest";
import { readMessages } from "./payload";

const wrap = (messages: unknown[], field = "messages") => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA",
      changes: [
        {
          field,
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "1" },
            contacts: [{ wa_id: "34600000001", user_id: "ES.abc123" }],
            messages,
          },
        },
      ],
    },
  ],
});
const read = (json: unknown) => readMessages(json).messages;
const base = {
  id: "wamid.1",
  from: "34600000001",
  from_user_id: "ES.abc123",
  timestamp: "1761469200",
};

describe("readMessages", () => {
  it("reads a text, keyed on the user id and answered on the phone number", () => {
    const [m] = read(wrap([{ ...base, type: "text", text: { body: "help" } }]));
    expect(m.msg).toEqual({
      id: "wamid.1",
      from: "ES.abc123",
      at: new Date(1761469200 * 1000),
      body: { kind: "text", text: "help" },
    });
    expect(m.replyTo).toBe("34600000001");
  });

  it("reads button taps, voice notes and anything else as unsupported", () => {
    const out = read(
      wrap([
        {
          ...base,
          type: "interactive",
          interactive: {
            type: "button_reply",
            button_reply: { id: "help", title: "Help" },
          },
        },
        { ...base, type: "button", button: { payload: "menu", text: "Menu" } },
        { ...base, type: "audio", audio: { id: "media1", voice: true } },
        { ...base, type: "sticker", sticker: { id: "s1" } },
      ]),
    ).map((m) => m.msg.body);
    expect(out).toEqual([
      { kind: "button", id: "help" },
      { kind: "button", id: "menu" },
      { kind: "voice", mediaId: "media1" },
      { kind: "unsupported" },
    ]);
  });

  it("falls back to the phone number when no user id is sent, and back again", () => {
    const [m] = read(
      wrap([
        {
          id: "w",
          from: "34600000001",
          timestamp: "1",
          type: "text",
          text: { body: "x" },
        },
      ]),
    );
    expect(m.msg.from).toBe("34600000001");
    const [n] = read(
      wrap([
        {
          id: "w",
          from_user_id: "ES.abc123",
          timestamp: "1",
          type: "text",
          text: { body: "x" },
        },
      ]),
    );
    expect(n.replyTo).toBe("ES.abc123");
  });

  it("skips status updates, reactions, system notices and other fields", () => {
    expect(
      read(wrap([{ ...base, type: "system", system: { body: "x" } }])),
    ).toEqual([]);
    expect(
      read(wrap([{ ...base, type: "reaction", reaction: { emoji: "x" } }])),
    ).toEqual([]);
    expect(read(wrap([], "account_update"))).toEqual([]);
    const statuses = wrap([]);
    delete (statuses.entry[0].changes[0].value as { messages?: unknown })
      .messages;
    expect(read(statuses)).toEqual([]);
  });

  it("skips an unreadable message without dropping the others", () => {
    const out = readMessages(
      wrap([
        { ...base, type: "text", text: { body: "x".repeat(4097) } },
        { ...base, id: "wamid.2", type: "text", text: { body: "help" } },
      ]),
    );
    expect(out.skipped).toBe(1);
    expect(out.messages.map((m) => m.msg.id)).toEqual(["wamid.2"]);
  });

  it("reads nothing from a payload that is not Meta's", () => {
    expect(readMessages({ object: "page", entry: [] })).toEqual({
      messages: [],
      skipped: 1,
    });
    expect(readMessages("nonsense").messages).toEqual([]);
  });
});
