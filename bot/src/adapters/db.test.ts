import { describe, expect, it } from "vitest";
import { inTurn, readSetting } from "./db";

function fakePool(fail?: string) {
  const log: string[] = [];
  let released = 0;
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      log.push(params ? `${sql} ${JSON.stringify(params)}` : sql);
      if (fail && sql.startsWith(fail)) throw new Error(`failed: ${fail}`);
      return { rows: [{ value: false }] };
    },
    release: () => {
      released++;
    },
  };
  return {
    log,
    released: () => released,
    pool: { connect: async () => client } as never,
  };
}

describe("inTurn", () => {
  it("opens the turn first and commits after the work", async () => {
    const db = fakePool();
    const out = await inTurn(
      "34600000001",
      async (tx) => {
        await tx.query("select 1");
        return "done";
      },
      db.pool,
    );
    expect(out).toBe("done");
    expect(db.log).toEqual([
      "begin",
      'select wa.begin_turn($1) ["34600000001"]',
      "select 1",
      "commit",
    ]);
    expect(db.released()).toBe(1);
  });

  it("rolls back and releases when the work throws", async () => {
    const db = fakePool();
    await expect(
      inTurn(
        "34600000001",
        async () => {
          throw new Error("boom");
        },
        db.pool,
      ),
    ).rejects.toThrow("boom");
    expect(db.log.at(-1)).toBe("rollback");
    expect(db.log).not.toContain("commit");
    expect(db.released()).toBe(1);
  });

  it("never runs the work when the turn is refused", async () => {
    const db = fakePool("select wa.begin_turn");
    let ran = false;
    await expect(
      inTurn(
        "34699999999",
        async () => {
          ran = true;
        },
        db.pool,
      ),
    ).rejects.toThrow("failed");
    expect(ran).toBe(false);
    expect(db.released()).toBe(1);
  });
});

describe("readSetting", () => {
  it("passes the name as a parameter", async () => {
    const db = fakePool();
    const client = await (db.pool as { connect(): Promise<never> }).connect();
    expect(await readSetting("paused", client)).toBe(false);
    expect(db.log).toEqual(['select wa.setting($1) as value ["paused"]']);
  });
});
