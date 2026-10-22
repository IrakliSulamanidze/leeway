import type { Intent } from "./types";

// Codes are 8 letters and digits without look-alikes (no 0/O, 1/I/L).
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE = /^share ([a-hjkmnp-z2-9]{8})$/;
const BUTTON = /^share\.(allow|not_now|block):([A-HJKMNP-Z2-9]{8})$/;

const CLOSED =
  "Sharing test dates with classmates isn't open yet. I'll tell you when it is.";
const EXPIRED = "That code has expired or was already used.";

const ANSWERED = {
  allow:
    'Done. They\'ll see your test dates for those courses. Send "stop sharing" any time to end it.',
  not_now: "Okay, nothing is shared.",
  block: "Done. Codes from them won't reach you again.",
  expired: EXPIRED,
  closed: CLOSED,
  you_full:
    'You already share with as many classmates as Leeway allows. Send "stop sharing" to make room.',
  they_full:
    "They already follow as many classmates as Leeway allows, so nothing was shared. The code still works.",
} as const;

// Sharing test dates with a classmate. Every line here is fixed wording: no
// voice, no jokes, nothing about the other student.
export const share: Intent = {
  name: "share",
  matches: (t) =>
    t.text === "share" ||
    t.text === "stop sharing" ||
    t.text === "stop following" ||
    (t.text !== null && CODE.test(t.text)) ||
    (t.button !== null && BUTTON.test(t.button)),
  async run(turn, deps) {
    const reply = (text: string) => ({ replies: [{ text }] });
    const from = turn.msg.from;

    if (turn.text === "stop sharing") {
      const n = await deps.sharing.stopSharing(from);
      return reply(
        n
          ? "Done. Nobody sees your test dates now."
          : "You weren't sharing with anyone.",
      );
    }
    if (turn.text === "stop following") {
      const n = await deps.sharing.stopFollowing(from);
      return reply(
        n
          ? "Done. You won't see classmates' test dates now."
          : "You weren't following anyone.",
      );
    }

    if (turn.text === "share") {
      const code = deps.newCode();
      const made = await deps.sharing.newCode(from, code);
      if (made === "closed") return reply(CLOSED);
      if (made === "too_many")
        return reply("That's enough codes for today. Try again tomorrow.");
      if (made === "full")
        return reply(
          'You already follow 3 classmates. Send "stop following" to make room.',
        );
      return reply(
        `Give this to one classmate, in your own chat with them:\n\nshare ${code}\n\nThey send it to me and choose whether to share their test dates with you. It works once, for 7 days.`,
      );
    }

    const button = turn.button ? BUTTON.exec(turn.button) : null;
    if (button) {
      const answer = button[1] as "allow" | "not_now" | "block";
      return reply(
        ANSWERED[await deps.sharing.answer(from, button[2], answer)],
      );
    }

    const code = CODE.exec(turn.text ?? "")![1].toUpperCase();
    const preview = await deps.sharing.preview(from, code);
    if (preview.outcome === "closed") return reply(CLOSED);
    if (preview.outcome === "self")
      return reply("That's your own code. Give it to a classmate instead.");
    if (preview.outcome === "nothing_shared")
      return reply(
        "You don't take any of the same courses, so there's nothing to share.",
      );
    if (preview.outcome !== "ok") return reply(EXPIRED);
    return {
      replies: [
        {
          text: `A classmate gave you this code to see your test dates. If you allow it, they see a short test name and date for these courses you both take: ${preview.courses.join(", ")}. Never your timetable, absences, skips or notes, and no course you add later. You can stop any time with "stop sharing".`,
          buttons: [
            { id: `share.allow:${code}`, title: "Allow" },
            { id: `share.not_now:${code}`, title: "Not now" },
            { id: `share.block:${code}`, title: "Block" },
          ],
        },
      ],
    };
  },
};
