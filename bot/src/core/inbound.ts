import type { InboundDeps } from "../ports";
import { LINES, linkPrompt, waitlisted } from "./lines";
import { normalise } from "./normalise";
import { handle } from "./pipeline";
import { isCrisis, optCommand } from "./safety";
import type { Inbound, Reply } from "./types";

// Meta retries undelivered webhooks for up to 7 days.
const STALE_MS = 24 * 60 * 60 * 1000;

// Everything that happens to one incoming message, in a fixed order:
// 1. crisis words get the crisis line, whatever else is switched on;
// 2. STOP and START change reminders;
// 3. a message Meta delivers more than a day late gets no answer;
// 4. the kill switch answers with one fixed line;
// 5. the daily cap: one notice when it is crossed, then silence until tomorrow;
// 6. who the sender is: a sign-in link, the waitlist, or a paused link;
// 7. the age question, once;
// 8. the request itself.
export async function processInbound(
  msg: Inbound,
  deps: InboundDeps,
): Promise<Reply[]> {
  const text = msg.body.kind === "text" ? normalise(msg.body.text) : null;

  if (text !== null && isCrisis(text)) return [{ text: LINES.crisis }];

  const opt = text === null ? null : optCommand(text);
  if (opt) {
    await deps.gate.setOptOut(msg.from, opt === "stop");
    return [{ text: opt === "stop" ? LINES.stopped : LINES.started }];
  }

  if (deps.clock.now().getTime() - msg.at.getTime() > STALE_MS) return [];

  if (await deps.gate.paused()) return [{ text: LINES.paused }];

  const { count, cap } = await deps.gate.countToday(msg.from);
  if (count === cap + 1) return [{ text: LINES.tooMany }];
  if (count > cap) return [];

  const link = await deps.accounts.state(msg.from);
  if (link.state === "none")
    return [{ text: linkPrompt(await deps.accounts.newLinkUrl(msg.from)) }];
  if (link.state === "waitlisted") return [{ text: waitlisted(link.place) }];
  if (link.state === "suspended") return [{ text: LINES.suspended }];

  const ageButton =
    msg.body.kind === "button" ? AGE_BUTTONS[msg.body.id] : undefined;
  if (ageButton !== undefined) {
    await deps.accounts.setAdult(msg.from, ageButton);
    return [{ text: LINES.ageThanks }];
  }
  if ((await deps.accounts.adult(msg.from)) === null)
    return [
      {
        text: LINES.askAge,
        buttons: [
          { id: "age.adult", title: "Yes, 18 or older" },
          { id: "age.minor", title: "No, under 18" },
        ],
      },
    ];

  return handle(msg, deps);
}

const AGE_BUTTONS: Record<string, boolean> = {
  "age.adult": true,
  "age.minor": false,
};
