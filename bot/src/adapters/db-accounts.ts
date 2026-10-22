import { createHash, randomBytes } from "node:crypto";
import type { Accounts, LinkResult, LinkState } from "../ports";
import { inTurn, type Queryable, sharedPool } from "./db";
import { keyedHash } from "./hash";

export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest();

// The 6-digit code is short, so its stored hash is keyed: a copy of the table
// alone cannot be searched for it.
export const codeHash = (code: string, hashKey: string) =>
  keyedHash(`link-code:${code}`, hashKey);

// Accounts on the wa_api functions. Link tokens are 256 random bits; only their
// hash is stored.
export function dbAccounts(
  publicUrl: string,
  hashKey: string,
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
    async confirmCode(sender, code) {
      const { rows } = await db().query(
        "select outcome, place from wa_api.confirm_link($1, $2)",
        [sender, codeHash(code, hashKey)],
      );
      const { outcome, place } = rows[0] as {
        outcome: string;
        place: number | null;
      };
      if (outcome === "waitlisted") return { outcome, place: place ?? 0 };
      return { outcome } as LinkResult;
    },
    async profile(sender) {
      return inTurn(sender, async (tx) => {
        const { rows } = await tx.query(
          "select adult, voice, hide_details from wa_api.my_profile()",
        );
        return {
          adult: rows[0]?.adult ?? null,
          voice: rows[0]?.voice ?? null,
          hideDetails: rows[0]?.hide_details === true,
        };
      });
    },
    async setHideDetails(sender, hide) {
      await inTurn(sender, (tx) =>
        tx.query("select wa_api.set_hide_details($1)", [hide]),
      );
    },
    async setVoice(sender, voice) {
      await inTurn(sender, (tx) =>
        tx.query("select wa_api.set_voice($1)", [voice]),
      );
    },
    async setAdult(sender, adult) {
      await inTurn(sender, (tx) =>
        tx.query("select wa_api.set_adult($1)", [adult]),
      );
    },
  };
}
