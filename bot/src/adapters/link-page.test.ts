import { beforeEach, describe, expect, it } from "vitest";
import { type LinkPageDeps, showLinkPage, submitLinkPage } from "./link-page";

let valid: Set<string>;
let failures: string[];
let signedOut: string[];
let outcome: { outcome: string; place: number | null };

const deps: LinkPageDeps = {
  tokenOk: async (t) => valid.has(t),
  failed: async (t) => void failures.push(t),
  signIn: async (email, password) =>
    email === "ana@student.ie.edu" && password === "right"
      ? { userId: "u1", sessionId: "s1", accessToken: "at" }
      : null,
  signOut: async (at) => void signedOut.push(at),
  complete: async () => outcome,
};

const submit = (fields: Record<string, string>) =>
  submitLinkPage(
    new Request("https://bot.test/link", {
      method: "POST",
      body: new URLSearchParams(fields),
    }),
    deps,
  );

beforeEach(() => {
  valid = new Set(["tok"]);
  failures = [];
  signedOut = [];
  outcome = { outcome: "linked", place: null };
});

describe("showLinkPage", () => {
  it("shows the form for a live token, with headers that keep the token private", async () => {
    const res = await showLinkPage(
      new URL("https://bot.test/link?t=tok"),
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain('name="password"');
  });

  it("says the link expired for an unknown token", async () => {
    expect(
      (await showLinkPage(new URL("https://bot.test/link?t=old"), deps)).status,
    ).toBe(410);
  });

  it("escapes the token it puts back in the page", async () => {
    valid.add('"><script>');
    const html = await (
      await showLinkPage(new URL('https://bot.test/link?t="><script>'), deps)
    ).text();
    expect(html).not.toContain("<script>");
  });
});

describe("submitLinkPage", () => {
  it("links on the right password and ends the sign-in session", async () => {
    const res = await submit({
      t: "tok",
      email: "ana@student.ie.edu",
      password: "right",
    });
    expect(await res.text()).toContain("re connected");
    expect(signedOut).toEqual(["at"]);
  });

  it("counts a wrong password against the token", async () => {
    const res = await submit({
      t: "tok",
      email: "ana@student.ie.edu",
      password: "wrong",
    });
    expect(res.status).toBe(400);
    expect(failures).toEqual(["tok"]);
  });

  it("shows the waitlist place past the student cap", async () => {
    outcome = { outcome: "waitlisted", place: 7 };
    const html = await (
      await submit({ t: "tok", email: "ana@student.ie.edu", password: "right" })
    ).text();
    expect(html).toContain("number 7");
  });

  it("refuses an expired token before trying the password", async () => {
    const res = await submit({
      t: "gone",
      email: "ana@student.ie.edu",
      password: "right",
    });
    expect(res.status).toBe(410);
    expect(signedOut).toEqual([]);
  });
});
