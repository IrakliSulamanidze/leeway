import { createHmac } from "node:crypto";

// Keyed hash for Meta ids and senders, so the database never holds them in the
// clear. The key lives only in the bot's environment.
export function keyedHash(value: string, key: string): Buffer {
  if (!key) throw new Error("hash key is empty");
  return createHmac("sha256", key).update(value).digest();
}
