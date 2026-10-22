import type { Deps } from "../ports";
import { MENU } from "./intents/help";
import { INTENTS } from "./intents/registry";
import type { Outcome, Turn } from "./intents/types";
import { LINES } from "./lines";
import { normalise } from "./normalise";
import { commandFor } from "./read";
import { madridToday } from "@/lib/rules/dates";
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
    viaReader: false,
  };
}

// No intent matched. Text goes to the AI reader, which picks a request from a
// fixed list; code turns that into a command and answers it as if typed.
async function fallback(
  turn: Turn,
  deps: Deps,
): Promise<{ outcome: Outcome; via: string }> {
  const kind = turn.msg.body.kind;
  if (kind !== "text" || turn.text === null) {
    const text = kind === "button" ? LINES.notUnderstood : LINES.textOnly;
    return { outcome: { replies: [{ text }] }, via: "fallback" };
  }
  const reading = await deps.reader.read(turn.text, madridToday(turn.now));
  if (reading?.kind === "off_topic")
    return {
      outcome: { replies: [{ text: LINES.offTopic, buttons: MENU }] },
      via: "reader",
    };
  const command = reading ? commandFor(reading) : null;
  const intent = command
    ? INTENTS.find((i) =>
        i.matches({ ...turn, text: command, viaReader: true }),
      )
    : undefined;
  if (intent && command)
    return {
      outcome: await intent.run(
        { ...turn, text: command, viaReader: true },
        deps,
      ),
      via: intent.name,
    };
  return {
    outcome: { replies: [{ text: LINES.notUnderstood, buttons: MENU }] },
    via: "reader",
  };
}

// Decides the replies to one message. Sends nothing: the caller delivers them,
// so this stays testable without WhatsApp. An invalid reply throws; the webhook
// catches it, logs it and sends a fixed fallback line instead.
export async function handle(msg: Inbound, deps: Deps): Promise<Reply[]> {
  const turn = toTurn(msg, deps.clock.now());
  const intent = INTENTS.find((i) => i.matches(turn));
  const { outcome, via } = intent
    ? { outcome: await intent.run(turn, deps), via: intent.name }
    : await fallback(turn, deps);
  for (const reply of outcome.replies) {
    const problems = replyProblems(reply);
    if (problems.length) throw new ReplyError(via, problems);
  }
  return outcome.replies;
}
