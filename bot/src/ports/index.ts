// Everything the core needs from the outside world. Each port has a production
// adapter and a fake in src/adapters; tests and the chat simulator use the fakes.
import type { Reply } from "../core/types";

export interface Clock {
  now(): Date;
}

export interface Messenger {
  send(to: string, reply: Reply): Promise<void>;
}

// What a handler may use. Later ports (store, reader, speech) are added here as
// the features that need them land, so a handler's dependencies stay explicit.
export type Deps = {
  clock: Clock;
};
