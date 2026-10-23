import type { Messenger } from "../ports";
import { log } from "./log";

// Counts every message Meta accepts, for the monthly watch on its bill.
export function countingMessenger(
  inner: Messenger,
  count: () => Promise<void>,
): Messenger {
  const counted = async () => {
    await count().catch(() => log.warn("meta: could not count a sent message"));
  };
  return {
    async send(to, reply) {
      await inner.send(to, reply);
      await counted();
    },
    async sendTemplate(to, name, params) {
      await inner.sendTemplate(to, name, params);
      await counted();
    },
  };
}
