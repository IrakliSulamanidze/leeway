import type { Voice } from "../core/voice/types";
import type { Accounts, LinkResult, LinkState } from "../ports";

// In-memory Accounts for tests and the chat simulator.
export class MemoryAccounts implements Accounts {
  readonly states = new Map<string, LinkState>();
  readonly ages = new Map<string, boolean>();
  readonly voices = new Map<string, Voice>();
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

  // The code the fake sign-in page "showed".
  pendingCode: string | null = null;

  async confirmCode(sender: string, code: string): Promise<LinkResult> {
    if (this.pendingCode === null) return { outcome: "no_code" };
    if (code !== this.pendingCode) return { outcome: "wrong_code" };
    this.pendingCode = null;
    this.states.set(sender, { state: "active" });
    return { outcome: "linked" };
  }

  async profile(sender: string) {
    return {
      adult: this.ages.get(sender) ?? null,
      voice: this.voices.get(sender) ?? null,
    };
  }

  async setVoice(sender: string, voice: Voice) {
    this.voices.set(sender, voice);
  }

  async setAdult(sender: string, adult: boolean) {
    this.ages.set(sender, adult);
  }
}
