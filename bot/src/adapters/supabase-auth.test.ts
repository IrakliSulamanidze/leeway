import { describe, expect, it } from "vitest";
import { signIn } from "./supabase-auth";

const jwt = (claims: object) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
const fakeFetch = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const cfg = (f: typeof fetch) => ({
  url: "https://x.supabase.co",
  publishableKey: "pk",
  fetch: f,
});

describe("signIn", () => {
  it("returns the account and the session the sign-in created", async () => {
    const who = await signIn(
      "a@b.c",
      "pw",
      cfg(
        fakeFetch(200, {
          access_token: jwt({ session_id: "s1" }),
          user: { id: "u1" },
        }),
      ),
    );
    expect(who).toMatchObject({ userId: "u1", sessionId: "s1" });
  });

  it("returns null on a wrong password or a token without a session", async () => {
    expect(
      await signIn(
        "a@b.c",
        "pw",
        cfg(fakeFetch(400, { error: "invalid_grant" })),
      ),
    ).toBeNull();
    expect(
      await signIn(
        "a@b.c",
        "pw",
        cfg(fakeFetch(200, { access_token: jwt({}), user: { id: "u1" } })),
      ),
    ).toBeNull();
  });
});
