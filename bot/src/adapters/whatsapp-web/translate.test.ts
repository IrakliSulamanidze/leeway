import { describe, expect, it } from "vitest";
import { NumberedMenus, toInbound, toText } from "./translate";

const now = new Date("2026-10-26T09:00:00Z");
const msg = (key: object, message: object | null = { conversation: "lives" }) =>
  toInbound(
    { key: { id: "ABC", ...key }, message, messageTimestamp: 1761469200 },
    now,
  );

describe("toInbound", () => {
  it("reads a direct message keyed on the phone number", () => {
    expect(msg({ remoteJid: "34600000001@s.whatsapp.net" })).toEqual({
      msg: {
        id: "ABC",
        from: "34600000001",
        at: new Date(1761469200 * 1000),
        body: { kind: "text", text: "lives" },
      },
      replyTo: "34600000001@s.whatsapp.net",
    });
  });

  it("finds the number behind a private id", () => {
    expect(
      msg({
        remoteJid: "12345@lid",
        remoteJidAlt: "34600000001@s.whatsapp.net",
      })?.msg.from,
    ).toBe("34600000001");
    expect(msg({ remoteJid: "12345@lid" })).toBeNull();
  });

  it("ignores its own messages, groups, status updates and channels", () => {
    expect(
      msg({ remoteJid: "34600000001@s.whatsapp.net", fromMe: true }),
    ).toBeNull();
    expect(msg({ remoteJid: "1203630@g.us" })).toBeNull();
    expect(msg({ remoteJid: "status@broadcast" })).toBeNull();
    expect(msg({ remoteJid: "1203630@newsletter" })).toBeNull();
  });

  it("reads long texts, voice notes and anything else", () => {
    expect(
      msg(
        { remoteJid: "34600000001@s.whatsapp.net" },
        { extendedTextMessage: { text: "hi" } },
      )?.msg.body,
    ).toEqual({
      kind: "text",
      text: "hi",
    });
    expect(
      msg({ remoteJid: "34600000001@s.whatsapp.net" }, { audioMessage: {} })
        ?.msg.body.kind,
    ).toBe("voice");
    expect(
      msg({ remoteJid: "34600000001@s.whatsapp.net" }, { imageMessage: {} })
        ?.msg.body.kind,
    ).toBe("unsupported");
  });
});

describe("numbered replies", () => {
  const reply = {
    text: "Save it?",
    buttons: [
      { id: "skip.yes:x", title: "Save it" },
      { id: "skip.no", title: "Don't save" },
    ],
  };

  it("turns buttons into numbered lines", () => {
    expect(toText(reply)).toBe(
      "Save it?\n\nReply with a number:\n1. Save it\n2. Don't save",
    );
    expect(toText({ text: "Hi" })).toBe("Hi");
  });

  it("reads a number back as the button it stood for, once, for 15 minutes", () => {
    const menus = new NumberedMenus();
    menus.remember("346", [reply], 0);
    const two = {
      id: "m",
      from: "346",
      at: now,
      body: { kind: "text" as const, text: "2" },
    };
    expect(menus.resolve(two, 1000).body).toEqual({
      kind: "button",
      id: "skip.no",
    });
    expect(menus.resolve(two, 2000).body).toEqual({ kind: "text", text: "2" });
    menus.remember("346", [reply], 0);
    expect(menus.resolve(two, 16 * 60 * 1000).body.kind).toBe("text");
  });

  it("leaves other numbers and other senders alone", () => {
    const menus = new NumberedMenus();
    menus.remember("346", [reply], 0);
    expect(
      menus.resolve(
        { id: "m", from: "999", at: now, body: { kind: "text", text: "1" } },
        1,
      ).body.kind,
    ).toBe("text");
    expect(
      menus.resolve(
        { id: "m", from: "346", at: now, body: { kind: "text", text: "7" } },
        1,
      ).body.kind,
    ).toBe("text");
    expect(
      menus.resolve(
        {
          id: "m",
          from: "346",
          at: now,
          body: { kind: "text", text: "123456" },
        },
        1,
      ).body.kind,
    ).toBe("text");
  });
});
