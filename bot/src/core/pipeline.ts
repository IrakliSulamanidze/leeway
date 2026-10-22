import type { Deps } from "../ports";
import { INTENTS } from "./intents/registry";
import type { Outcome, Turn } from "./intents/types";
import { LINES } from "./lines";
import { normalise } from "./normalise";
import { replyProblems } from "./reply";
import type { Inbound, Reply } from "./types";

export class ReplyError extends Error {
  readonly intent: string;
  readonly problems: string[];

  constructor(intent: string, problems: string[]) {
    super(`${intent} produced an invalid reply: ${problems.join("; ")}`);
    this.name = "ReplyError";
    this.intent = intent;
    this.problems = problems;
  }
}

export function toTurn(msg: Inbound, now: Date): Turn {
  const { body } = msg;
  return {
    msg,
    text: body.kind === "text" ? normalise(body.text) : null,
    button: body.kind === "button" ? body.id : null,
    now,
  };
}

// No intent matched. The reader, a later stage, slots in before this.
function fallback(turn: Turn): Outcome {
  const kind = turn.msg.body.kind;
  const text =
    kind === "text" || kind === "button" ? LINES.notUnderstood : LINES.textOnly;
  return { replies: [{ text }] };
}

// Decides the replies to one message. Sends nothing: the caller delivers them,
// so this stays testable without WhatsApp. An invalid reply throws; the webhook
// catches it, logs it and sends a fixed fallback line instead.
export async function handle(msg: Inbound, deps: Deps): Promise<Reply[]> {
  const turn = toTurn(msg, deps.clock.now());
  const intent = INTENTS.find((i) => i.matches(turn));
  const { replies } = intent ? await intent.run(turn, deps) : fallback(turn);
  for (const reply of replies) {
    const problems = replyProblems(reply);
    if (problems.length)
      throw new ReplyError(intent?.name ?? "fallback", problems);
  }
  return replies;
}
