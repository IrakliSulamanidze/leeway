import type { Clock } from "../ports";

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock {
  const at = new Date(iso);
  return { now: () => new Date(at) };
}
