import type { InboundDeps } from "../ports";
import { LINES, linkPrompt, waitlisted } from "./lines";
import { normalise } from "./normalise";
import { handle } from "./pipeline";
import { isCrisis, optCommand } from "./safety";
import type { Inbound, Reply } from "./types";
import { applyVoice } from "./voice/apply";
import type { Voice } from "./voice/types";

// Meta retries undelivered webhooks for up to 7 days.
const STALE_MS = 24 * 60 * 60 * 1000;

// Everything that happens to one incoming message, in a fixed order:
// 1. crisis words get the crisis line, whatever else is switched on;
// 2. STOP and START change reminders;
// 3. a message Meta delivers more than a day late gets no answer;
// 4. the kill switch answers with one fixed line;
// 5. the daily cap: one notice when it is crossed, then silence until tomorrow;
// 6. who the sender is: a sign-in link, the waitlist, or a paused link;
// 7. the age question and the voice question, once each;
// 8. the request itself, in the student's voice.
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
  if (link.state === "none") return linkReplies(msg, text, deps);
  if (link.state === "waitlisted") return [{ text: waitlisted(link.place) }];
  if (link.state === "suspended") return [{ text: LINES.suspended }];
  await deps.accounts.markInbound(msg.from);

  // A voice note is transcribed only for a linked student, before anything
  // else is asked, so a spoken crisis or STOP is heard like a typed one.
  let request = msg;
  if (msg.body.kind === "voice") {
    const heard = await deps.speech.transcribe(msg.body.mediaId);
    if (!heard.ok) return [{ text: VOICE_NOTE_LINES[heard.reason] }];
    const spoken = normalise(heard.text);
    if (isCrisis(spoken)) return [{ text: LINES.crisis }];
    const opt = optCommand(spoken);
    if (opt) {
      await deps.gate.setOptOut(msg.from, opt === "stop");
      return [{ text: opt === "stop" ? LINES.stopped : LINES.started }];
    }
    request = { ...msg, body: { kind: "text", text: heard.text } };
  }

  const profile = await deps.accounts.profile(msg.from);
  const button = msg.body.kind === "button" ? msg.body.id : null;

  const age =
    button && Object.hasOwn(AGE_BUTTONS, button)
      ? AGE_BUTTONS[button]
      : undefined;
  if (age !== undefined && profile.adult === null) {
    await deps.accounts.setAdult(msg.from, age);
    return [ASK_VOICE];
  }
  if (profile.adult === null) return [ASK_AGE];

  const voice =
    button && Object.hasOwn(VOICE_BUTTONS, button)
      ? VOICE_BUTTONS[button]
      : undefined;
  if (voice) {
    await deps.accounts.setVoice(msg.from, voice);
    return [{ text: LINES.voiceSet }];
  }
  if (text === "voice" || text === "change voice") return [ASK_VOICE];
  // The voice question comes once, right after the age answer. Until one is
  // picked, replies are Straight; a request is never held back for it.

  if (text === "hide details" || text === "show details") {
    await deps.accounts.setHideDetails(msg.from, text === "hide details");
    return [
      {
        text:
          text === "hide details" ? LINES.detailsHidden : LINES.detailsShown,
      },
    ];
  }

  return applyVoice(await handle(request, deps), profile, msg.id);
}

const ASK_AGE: Reply = {
  text: LINES.askAge,
  buttons: [
    { id: "age.adult", title: "Yes, 18 or older" },
    { id: "age.minor", title: "No, under 18" },
  ],
};

const ASK_VOICE: Reply = {
  text: LINES.askVoice,
  buttons: [
    { id: "voice.straight", title: "Straight" },
    { id: "voice.friendly", title: "Friendly" },
    { id: "voice.roast", title: "Roast" },
  ],
};

const VOICE_BUTTONS: Record<string, Voice> = {
  "voice.straight": "straight",
  "voice.friendly": "friendly",
  "voice.roast": "roast",
};

const VOICE_NOTE_LINES = {
  off: LINES.voiceNoteOff,
  too_long: LINES.voiceNoteLong,
  failed: LINES.voiceNoteFailed,
} as const;

const AGE_BUTTONS: Record<string, boolean> = {
  "age.adult": true,
  "age.minor": false,
};

const CODE = /^\d{3} ?\d{3}$/;

// An unlinked sender: the code from the sign-in page, or a new link.
async function linkReplies(
  msg: Inbound,
  text: string | null,
  deps: InboundDeps,
): Promise<Reply[]> {
  if (text !== null && CODE.test(text)) {
    const result = await deps.accounts.confirmCode(
      msg.from,
      text.replace(" ", ""),
    );
    if (result.outcome === "linked") return [{ text: LINES.linked }];
    if (result.outcome === "waitlisted")
      return [{ text: waitlisted(result.place) }];
    if (result.outcome === "wrong_code") return [{ text: LINES.wrongCode }];
    if (result.outcome === "account_taken")
      return [{ text: LINES.accountTaken }];
  }
  return [{ text: linkPrompt(await deps.accounts.newLinkUrl(msg.from)) }];
}
