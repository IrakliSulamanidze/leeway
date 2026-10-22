import type { Gate } from "../ports";

// In-memory Gate for tests and the chat simulator.
export class MemoryGate implements Gate {
  isPaused = false;
  cap = 60;
  readonly counts = new Map<string, number>();
  readonly optedOut = new Set<string>();

  async paused() {
    return this.isPaused;
  }

  async countToday(sender: string) {
    const count = (this.counts.get(sender) ?? 0) + 1;
    this.counts.set(sender, count);
    return { count, cap: this.cap };
  }

  async setOptOut(sender: string, optedOut: boolean) {
    if (optedOut) this.optedOut.add(sender);
    else this.optedOut.delete(sender);
  }
}
