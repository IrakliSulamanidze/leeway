// Everything the core needs from the outside world. Each port has a production
// adapter and a fake in src/adapters.
import type { Reply } from "../core/types";

export interface Clock {
  now(): Date;
}

// Checks that run before any request is read. Senders are WhatsApp ids; the
// adapter stores only a keyed hash of them.
export interface Gate {
  // The kill switch: when on, every message gets one fixed line.
  paused(): Promise<boolean>;
  // Counts this message against the sender's daily cap. Returns how many the
  // sender has sent today, this one included, and the cap.
  countToday(sender: string): Promise<{ count: number; cap: number }>;
  // STOP and START: proactive messages go only to senders who have not opted out.
  setOptOut(sender: string, optedOut: boolean): Promise<void>;
}

export interface Messenger {
  send(to: string, reply: Reply): Promise<void>;
}

// What a handler may use. Later ports (store, reader, speech) are added here as
// the features that need them land, so a handler's dependencies stay explicit.
export type Deps = {
  clock: Clock;
};

export type InboundDeps = Deps & { gate: Gate };
