// The only module that talks to Postgres. The bot connects as wa_gateway,
// which can call the wa_api functions and read no table
// (supabase/migrations/*_wa_core.sql, docs/adr/0002).
import pg from "pg";
import { log } from "./log";

export type Queryable = Pick<pg.PoolClient, "query">;
type PoolLike = {
  connect(): Promise<Pick<pg.PoolClient, "query" | "release">>;
};

let pool: pg.Pool | undefined;

export function sharedPool(): pg.Pool {
  if (pool) return pool;
  const url = process.env.WA_DB_URL;
  if (!url) throw new Error("WA_DB_URL is not set");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  // Supabase's certificate chains to Supabase's own CA (docs/bot/database.md).
  const ca = process.env.WA_DB_CA;
  if (!local && !ca) throw new Error("WA_DB_CA is not set");
  pool = new pg.Pool({
    connectionString: url,
    ssl: local ? undefined : { ca, rejectUnauthorized: true },
    // Few connections per instance: serverless functions are many and short,
    // and the transaction pooler multiplexes them.
    max: 2,
    idleTimeoutMillis: 10_000,
    // Meta waits about 10 s for the webhook; a slow connect must fail fast.
    connectionTimeoutMillis: 3_000,
  });
  // The pooler may close an idle connection; without a listener that error
  // would crash the process.
  pool.on("error", (error) =>
    log.warn("db: idle connection closed", error.message),
  );
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
  let result: T;
  try {
    await client.query("begin");
    await client.query("select wa_api.begin_turn($1)", [waId]);
    result = await work(client);
    await client.query("commit");
  } catch (error) {
    // A connection whose rollback failed is broken; release(err) drops it
    // instead of returning it to the pool.
    const broken = await client.query("rollback").then(
      () => undefined,
      (e: Error) => e,
    );
    client.release(broken);
    throw error;
  }
  client.release();
  return result;
}
