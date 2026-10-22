import type { Accounts, LinkState } from "../ports";

// In-memory Accounts for tests and the chat simulator.
export class MemoryAccounts implements Accounts {
  readonly states = new Map<string, LinkState>();
  readonly ages = new Map<string, boolean>();
  issued = 0;

  constructor(linkedByDefault = false) {
    this.linkedByDefault = linkedByDefault;
  }

  private readonly linkedByDefault: boolean;

  async state(sender: string): Promise<LinkState> {
    return (
      this.states.get(sender) ?? {
        state: this.linkedByDefault ? "active" : "none",
      }
    );
  }

  async newLinkUrl() {
    this.issued++;
    return `https://bot.test/link?t=token${this.issued}`;
  }

  async adult(sender: string) {
    return this.ages.get(sender) ?? null;
  }

  async setAdult(sender: string, adult: boolean) {
    this.ages.set(sender, adult);
  }
}
