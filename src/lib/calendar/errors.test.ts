import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { FEED_ERRORS } from "./errors";

it("every feed error is a message the database accepts in last_error", () => {
  const dir = join(__dirname, "../../../supabase/migrations");
  const sql = readdirSync(dir)
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  for (const message of Object.values(FEED_ERRORS))
    expect(sql).toContain(`'${message}'`);
});
