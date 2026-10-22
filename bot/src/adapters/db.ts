// The only module that talks to Postgres. The bot connects as wa_gateway,
// which can call a handful of wa.* functions and read no table
// (supabase/migrations/*_wa_core.sql, docs/adr/0002).
import pg from "pg";

export type Queryable = Pick<pg.PoolClient, "query">;
type PoolLike = {
  connect(): Promise<Pick<pg.PoolClient, "query" | "release">>;
};

let pool: pg.Pool | undefined;

function sharedPool(): pg.Pool {
  const url = process.env.WA_DB_URL;
  if (!url) throw new Error("WA_DB_URL is not set");
  // Two connections per instance: serverless functions are many and short,
  // and the transaction pooler multiplexes them.
  pool ??= new pg.Pool({ connectionString: url, max: 2 });
  return pool;
}

// Runs work in one transaction that acts only for the student linked to waId.
// The turn is opened first, so every wa function called inside takes that
// student from the grant. Rolls back on any error and always releases the
// connection. Never hold it across a model, speech or Meta call.
export async function inTurn<T>(
  waId: string,
  work: (tx: Queryable) => Promise<T>,
  db: PoolLike = sharedPool(),
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("select wa.begin_turn($1)", [waId]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// One switch from wa.settings; null when it is not set.
export async function readSetting(
  name: string,
  db: Queryable = sharedPool(),
): Promise<unknown> {
  const { rows } = await db.query("select wa.setting($1) as value", [name]);
  return rows[0]?.value ?? null;
}
