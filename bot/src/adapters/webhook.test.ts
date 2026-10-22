import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { LINES } from "../core/lines";
import { ReplyError } from "../core/pipeline";
import type { Inbound, Reply } from "../core/types";
import { MetaSendError } from "./meta/cloud-api";
import { receive, verifySubscription, type WebhookDeps } from "./webhook";

const SECRET = "app-secret";
const payload = (ids: string[]) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              messages: ids.map((id) => ({
                id,
                from: "34600000001",
                from_user_id: "ES.abc",
                timestamp: "1761469200",
                type: "text",
                text: { body: "help" },
              })),
            },
          },
        ],
      },
    ],
  });
const post = (body: string, secret = SECRET) =>
  new Request("https://bot.test/api/wa/webhook", {
    method: "POST",
    body,
    headers: {
      "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
    },
  });

let claimed: Set<string>;
let released: string[];
let finished: string[];
let sendFailures: number;
let sent: { to: string; reply: Reply }[];
let process: (msg: Inbound) => Promise<Reply[]>;
let sendError: Error | null;

const deps = (): WebhookDeps => ({
  appSecret: SECRET,
  inbox: {
    claim: async (id) => (claimed.has(id) ? false : (claimed.add(id), true)),
    finish: async (id) => void finished.push(id),
    release: async (id) => {
      released.push(id);
      claimed.delete(id);
    },
  },
  messenger: {
    send: async (to, reply) => {
      if (sendError && sendFailures-- > 0) throw sendError;
      sent.push({ to, reply });
    },
  },
  process: (msg) => process(msg),
});

beforeEach(() => {
  claimed = new Set();
  released = [];
  finished = [];
  sendFailures = Infinity;
  sent = [];
  sendError = null;
  process = async () => [{ text: "ok" }];
});

describe("receive", () => {
  it("answers each signed message on the sender's number", async () => {
    const res = await receive(post(payload(["w1", "w2"])), deps());
    expect(res.status).toBe(200);
    expect(sent).toEqual([
      { to: "34600000001", reply: { text: "ok" } },
      { to: "34600000001", reply: { text: "ok" } },
    ]);
  });

  it("refuses an unsigned or wrongly signed request before reading it", async () => {
    let read = false;
    process = async () => ((read = true), []);
    expect((await receive(post(payload(["w1"]), "wrong"), deps())).status).toBe(
      401,
    );
    expect(read).toBe(false);
  });

  it("handles a redelivered message once", async () => {
    await receive(post(payload(["w1"])), deps());
    await receive(post(payload(["w1"])), deps());
    expect(sent).toHaveLength(1);
  });

  it("releases a message that failed for a passing reason and asks Meta to retry", async () => {
    process = async () => {
      throw new Error("database timeout");
    };
    const res = await receive(post(payload(["w1"])), deps());
    expect(res.status).toBe(500);
    expect(released).toEqual(["w1"]);
  });

  it("sends the fallback line for an invalid reply and does not retry", async () => {
    process = async () => {
      throw new ReplyError("help", ["empty text"]);
    };
    const res = await receive(post(payload(["w1"])), deps());
    expect(res.status).toBe(200);
    expect(sent.map((s) => s.reply.text)).toEqual([LINES.notUnderstood]);
    expect(released).toEqual([]);
  });

  it("does not retry when Meta refuses this message outright", async () => {
    sendError = new MetaSendError(400, 131047);
    const res = await receive(post(payload(["w1"])), deps());
    expect(res.status).toBe(200);
    expect(released).toEqual([]);
    expect(finished).toEqual(["w1"]);
  });

  it("asks Meta to retry when the token is bad and nothing was sent", async () => {
    sendError = new MetaSendError(401, 190);
    const res = await receive(post(payload(["w1"])), deps());
    expect(res.status).toBe(500);
    expect(released).toEqual(["w1"]);
  });

  it("retries a passing send failure once on the spot", async () => {
    sendError = new MetaSendError(503, undefined);
    sendFailures = 1;
    const res = await receive(post(payload(["w1"])), deps());
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(finished).toEqual(["w1"]);
  });

  it("finishes a message once any reply reached the student", async () => {
    process = async () => [{ text: "one" }, { text: "two" }];
    let calls = 0;
    const d = deps();
    d.messenger = {
      send: async (to, reply) => {
        if (calls++ > 0) throw new MetaSendError(503, undefined);
        sent.push({ to, reply });
      },
    };
    const res = await receive(post(payload(["w1"])), d);
    expect(res.status).toBe(200);
    expect(sent.map((s) => s.reply.text)).toEqual(["one"]);
    expect(finished).toEqual(["w1"]);
    expect(released).toEqual([]);
  });

  it("leaves messages unclaimed for Meta's retry when time runs short", async () => {
    let t = 0;
    const d = { ...deps(), now: () => t };
    process = async () => {
      t += 7_000;
      return [{ text: "ok" }];
    };
    const res = await receive(post(payload(["w1", "w2"])), d);
    expect(res.status).toBe(500);
    expect(finished).toEqual(["w1"]);
    expect(claimed.has("w2")).toBe(false);
  });

  it("accepts a signed body it cannot read, since a retry would not help", async () => {
    expect((await receive(post('{"hello":1}'), deps())).status).toBe(200);
    expect(sent).toEqual([]);
  });
});

describe("verifySubscription", () => {
  const url = (token: string) =>
    new URL(
      `https://bot.test/api/wa/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=42`,
    );

  it("echoes the challenge for the right token only", async () => {
    expect(await verifySubscription(url("tok"), "tok").text()).toBe("42");
    expect(verifySubscription(url("nope"), "tok").status).toBe(403);
  });
});
