import { describe, expect, it } from "vitest";
import { cloudApiMessenger, MetaSendError, messageBody } from "./cloud-api";

describe("messageBody", () => {
  it("sends plain text without link previews", () => {
    expect(messageBody("346", { text: "Hi" })).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "346",
      type: "text",
      text: { body: "Hi", preview_url: false },
    });
  });

  it("sends reply buttons as an interactive message", () => {
    const body = messageBody("346", {
      text: "Save?",
      buttons: [{ id: "yes", title: "Save" }],
    });
    expect(body.type).toBe("interactive");
    expect(body).toMatchObject({
      interactive: {
        action: {
          buttons: [{ type: "reply", reply: { id: "yes", title: "Save" } }],
        },
      },
    });
  });
});

describe("cloudApiMessenger", () => {
  it("posts to the phone number's messages endpoint with the token", async () => {
    const calls: [string, RequestInit][] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await cloudApiMessenger("123", "tok", fake).send("346", { text: "Hi" });
    expect(calls[0][0]).toBe("https://graph.facebook.com/v25.0/123/messages");
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("reports Meta's error code without the token", async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ error: { code: 131047 } }), {
        status: 400,
      })) as typeof fetch;
    const err = await cloudApiMessenger("123", "secret-token", fake)
      .send("346", { text: "Hi" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaSendError);
    expect((err as MetaSendError).code).toBe(131047);
    expect(String(err)).not.toContain("secret-token");
  });
});
