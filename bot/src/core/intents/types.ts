import type { Deps } from "../../ports";
import type { Inbound, Reply } from "../types";

// One incoming message as handlers see it.
export type Turn = {
  msg: Inbound;
  // Normalised text, or null when the message is not text.
  text: string | null;
  // Reply-button id, or null when the message is not a button tap.
  button: string | null;
  now: Date;
};

// What handling a turn produced. The pipeline, not the intent, commits it, so
// writes, the redelivery check and the replies land together. Effects (saved
// skips, a pending question) join this type with the store.
export type Outcome = { replies: Reply[] };

// One kind of request. Adding a feature means adding an Intent and listing it
// in registry.ts; nothing else in the pipeline changes.
export interface Intent {
  name: string;
  // True when this intent answers the turn without the reader (exact command or
  // button). Must be cheap and side-effect free.
  matches(turn: Turn): boolean;
  run(turn: Turn, deps: Deps): Outcome | Promise<Outcome>;
}
