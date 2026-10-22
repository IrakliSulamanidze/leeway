import { beforeEach, describe, expect, it } from "vitest";
import {
  type LinkPageDeps,
  type Prepared,
  showLinkPage,
  submitLinkPage,
} from "./link-page";

let valid: Set<string>;
let attemptsLeft: number;
let ipCount: number;
let signedOut: string[];
let prepared: Prepared;
let signInThrows: boolean;

const deps = (): LinkPageDeps => ({
  tokenOk: async (t) => valid.has(t),
  takeAttempt: async () => attemptsLeft-- > 0,
  countIp: async () => ++ipCount,
  signIn: async (email, password) => {
    if (signInThrows) throw new Error("timeout");
    return email === "ana@student.ie.edu" && password === "right"
      ? { userId: "u1", sessionId: "s1", accessToken: "at" }
      : null;
  },
  signOut: async (at) => void signedOut.push(at),
  prepare: async () => prepared,
  newCode: () => "482913",
  now: () => 0,
});

const submit = (fields: Record<string, string>) =>
  submitLinkPage(
    new Request("https://bot.test/link", {
      method: "POST",
      body: new URLSearchParams(fields),
    }),
    deps(),
  );
const right = { t: "tok", email: "ana@student.ie.edu", password: "right" };

beforeEach(() => {
  valid = new Set(["tok"]);
  attemptsLeft = 5;
  ipCount = 0;
  signedOut = [];
  prepared = "ok";
  signInThrows = false;
});

describe("showLinkPage", () => {
  it("shows the form for a live link, with headers that keep the link private", async () => {
    const res = await showLinkPage(
      new URL("https://bot.test/link?t=tok"),
      deps(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toContain('name="password"');
  });

  it("says the link expired for an unknown token", async () => {
    expect(
      (await showLinkPage(new URL("https://bot.test/link?t=old"), deps()))
        .status,
    ).toBe(410);
  });

  it("escapes the token it puts back in the page", async () => {
    valid.add('"><script>');
    const html = await (
      await showLinkPage(new URL('https://bot.test/link?t="><script>'), deps())
    ).text();
    expect(html).not.toContain("<script>");
  });
});

describe("submitLinkPage", () => {
  it("shows the code to send back from WhatsApp and ends the sign-in session", async () => {
    const html = await (await submit(right)).text();
    expect(html).toContain("482 913");
    expect(signedOut).toEqual(["at"]);
  });

  it("refuses a wrong password with the same message whether or not the email exists", async () => {
    const a = await submit({ ...right, password: "wrong" });
    const b = await submit({
      ...right,
      email: "nobody@x.y",
      password: "wrong",
    });
    expect(a.status).toBe(400);
    expect(await a.text()).toBe(await b.text());
  });

  it("stops when the number has no attempts left today", async () => {
    attemptsLeft = 0;
    expect((await submit(right)).status).toBe(429);
  });

  it("stops after too many attempts from one address", async () => {
    ipCount = 20;
    expect((await submit(right)).status).toBe(429);
  });

  it("refuses an expired link before trying the password", async () => {
    const res = await submit({ ...right, t: "gone" });
    expect(res.status).toBe(410);
    expect(signedOut).toEqual([]);
  });

  it("says so when the account is already connected elsewhere", async () => {
    prepared = "account_taken";
    expect((await submit(right)).status).toBe(409);
    expect(signedOut).toEqual(["at"]);
  });

  it("says Leeway did not answer when the sign-in service is down", async () => {
    signInThrows = true;
    expect((await submit(right)).status).toBe(503);
  });

  it("refuses bodies that are too large or not a form", async () => {
    const big = new Request("https://bot.test/link", {
      method: "POST",
      body: "x".repeat(5000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect((await submitLinkPage(big, deps())).status).toBe(400);
    const json = new Request("https://bot.test/link", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    });
    expect((await submitLinkPage(json, deps())).status).toBe(400);
  });
});
