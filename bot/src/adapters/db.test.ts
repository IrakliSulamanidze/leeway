import { describe, expect, it } from "vitest";
import { inTurn, readSetting } from "./db";

function fakePool(fail?: string, failRollback = false) {
  const log: string[] = [];
  let released = 0;
  let releasedWith: unknown;
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      log.push(params ? `${sql} ${JSON.stringify(params)}` : sql);
      if (fail && sql.startsWith(fail)) throw new Error(`failed: ${fail}`);
      if (failRollback && sql === "rollback") throw new Error("socket closed");
      return { rows: [{ value: false }] };
    },
    release: (err?: unknown) => {
      released++;
      releasedWith = err;
    },
  };
  return {
    log,
    released: () => released,
    releasedWith: () => releasedWith,
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
      'select wa_api.begin_turn($1) ["34600000001"]',
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
    const db = fakePool("select wa_api.begin_turn");
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

describe("inTurn with a broken connection", () => {
  it("drops a connection whose rollback failed instead of reusing it", async () => {
    const db = fakePool("select 1", true);
    await expect(
      inTurn(
        "34600000001",
        async (tx) => {
          await tx.query("select 1");
        },
        db.pool,
      ),
    ).rejects.toThrow("failed");
    expect(db.released()).toBe(1);
    expect(db.releasedWith()).toBeInstanceOf(Error);
  });

  it("returns a healthy connection to the pool", async () => {
    const db = fakePool();
    await inTurn("34600000001", async () => undefined, db.pool);
    expect(db.releasedWith()).toBeUndefined();
  });
});

describe("readSetting", () => {
  it("passes the name as a parameter", async () => {
    const db = fakePool();
    const client = await (db.pool as { connect(): Promise<never> }).connect();
    expect(await readSetting("paused", client)).toBe(false);
    expect(db.log).toEqual(['select wa_api.setting($1) as value ["paused"]']);
  });
});
