import type { SharePreview, Sharing } from "../ports";
import { inTurn } from "./db";
import { keyedHash } from "./hash";

export function dbSharing(hashKey: string): Sharing {
  const hash = (code: string) => keyedHash(`share:${code}`, hashKey);
  const one = async (sender: string, sql: string, params: unknown[] = []) =>
    inTurn(sender, async (tx) => (await tx.query(sql, params)).rows[0]);
  return {
    newCode: async (sender, code) =>
      (await one(sender, "select wa_api.new_share_code($1) as r", [hash(code)]))
        .r,
    async preview(sender, code) {
      const r = await one(
        sender,
        "select outcome, courses from wa_api.share_preview($1)",
        [hash(code)],
      );
      return (
        r.outcome === "ok"
          ? { outcome: "ok", courses: r.courses }
          : { outcome: r.outcome }
      ) as SharePreview;
    },
    answer: async (sender, code, answer) =>
      (
        await one(sender, "select wa_api.answer_share($1, $2) as r", [
          hash(code),
          answer,
        ])
      ).r,
    sharedTests: (sender, range) =>
      inTurn(sender, async (tx) =>
        (
          await tx.query(
            "select course_id, title, on_date::text as on_date from wa_api.shared_tests($1, $2)",
            [range.from, range.to],
          )
        ).rows.map((r) => ({
          courseId: r.course_id as string,
          title: r.title as string,
          onDate: r.on_date as string,
        })),
      ),
    stopSharing: async (sender) =>
      (await one(sender, "select wa_api.stop_sharing() as n")).n,
    stopFollowing: async (sender) =>
      (await one(sender, "select wa_api.stop_following() as n")).n,
  };
}
