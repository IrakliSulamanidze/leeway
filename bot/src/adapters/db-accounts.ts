import { createHash, randomBytes } from "node:crypto";
import type { Accounts, LinkState } from "../ports";
import { inTurn, type Queryable, sharedPool } from "./db";

export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest();

// Accounts on the wa_api functions. Link tokens are 256 random bits; only their
// hash is stored.
export function dbAccounts(
  publicUrl: string,
  db: () => Queryable = sharedPool,
): Accounts {
  return {
    async state(sender) {
      const { rows } = await db().query(
        "select state, place from wa_api.link_state($1)",
        [sender],
      );
      const { state, place } = rows[0] as {
        state: string;
        place: number | null;
      };
      if (state === "waitlisted") return { state, place: place ?? 0 };
      if (state === "active" || state === "suspended") return { state };
      return { state: "none" } satisfies LinkState;
    },
    async newLinkUrl(sender) {
      const token = randomBytes(32).toString("base64url");
      await db().query("select wa_api.issue_link_token($1, $2)", [
        sender,
        tokenHash(token),
      ]);
      const url = new URL("/link", publicUrl);
      url.searchParams.set("t", token);
      return url.toString();
    },
    async adult(sender) {
      return inTurn(sender, async (tx) => {
        const { rows } = await tx.query("select adult from wa_api.my_link()");
        return (rows[0]?.adult as boolean | null | undefined) ?? null;
      });
    },
    async setAdult(sender, adult) {
      await inTurn(sender, (tx) =>
        tx.query("select wa_api.set_adult($1)", [adult]),
      );
    },
  };
}
