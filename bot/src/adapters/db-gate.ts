import type { Gate } from "../ports";
import { type Queryable, sharedPool } from "./db";
import { keyedHash } from "./hash";

// Redelivery check: Meta may send the same message more than once.
export interface Inbox {
  claim(messageId: string): Promise<boolean>;
  release(messageId: string): Promise<void>;
}

// Gate and Inbox on the wa_api functions. Ids are hashed before they leave
// the process.
export function dbGate(
  hashKey: string,
  db: () => Queryable = sharedPool,
): Gate & Inbox {
  const hash = (value: string) => keyedHash(value, hashKey);
  return {
    async paused() {
      const { rows } = await db().query(
        "select wa_api.setting('paused') as value",
      );
      return rows[0]?.value === true;
    },
    async countToday(sender) {
      const { rows } = await db().query(
        "select msg_count, cap from wa_api.count_message($1)",
        [hash(sender)],
      );
      return { count: rows[0].msg_count as number, cap: rows[0].cap as number };
    },
    async setOptOut(sender, optedOut) {
      await db().query("select wa_api.set_opt_out($1, $2)", [
        hash(sender),
        optedOut,
      ]);
    },
    async claim(messageId) {
      const { rows } = await db().query(
        "select wa_api.claim_message($1) as fresh",
        [hash(messageId)],
      );
      return rows[0]?.fresh === true;
    },
    async release(messageId) {
      await db().query("select wa_api.release_message($1)", [hash(messageId)]);
    },
  };
}
