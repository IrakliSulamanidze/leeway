import type { Snapshot, Student } from "../ports";
import { inTurn } from "./db";
import { keyedHash } from "./hash";

// Student on the wa_api functions; each call is its own turn for the sender.
export function dbStudent(hashKey: string): Student {
  return {
    snapshot: (sender, range) =>
      inTurn(sender, async (tx) => {
        const { rows } = await tx.query(
          "select wa_api.my_snapshot($1, $2) as snap",
          [range.from, range.to],
        );
        return rows[0].snap as Snapshot;
      }),
    logSkip: (sender, skip, messageId) =>
      inTurn(sender, async (tx) => {
        const { rows } = await tx.query(
          "select wa_api.log_skip_on($1, $2, $3, $4, $5) as id",
          [
            skip.courseId,
            skip.classId,
            skip.day,
            skip.sessions,
            keyedHash(`skip:${messageId}`, hashKey),
          ],
        );
        return rows[0].id as string;
      }),
    undoSkip: (sender, skipId) =>
      inTurn(sender, async (tx) => {
        const { rows } = await tx.query("select wa_api.undo_skip($1) as done", [
          skipId,
        ]);
        return rows[0].done === true;
      }),
  };
}
