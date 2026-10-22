import type { Messenger } from "../ports";
import type { Reply } from "../core/types";

// Records what would have been sent. Used by tests and the chat simulator.
export class MemoryMessenger implements Messenger {
  readonly sent: { to: string; reply: Reply }[] = [];

  async send(to: string, reply: Reply): Promise<void> {
    this.sent.push({ to, reply });
  }
}
