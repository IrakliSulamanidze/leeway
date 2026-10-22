import type { Reply } from "../types";
import { LIBRARY } from "./library";
import type { Situation, Voice } from "./types";

export type Profile = { voice: Voice | null; adult: boolean | null };

// For these, the voice line replaces the fixed first sentence; the rest of
// the fixed line still says what the bot can do.
const SWAP: Partial<Record<Situation, string>> = {
  off_topic:
    "I can check your lives, today, tomorrow, this week or your tests, and save a skip.",
  not_understood: 'Send "help" to see what I can do.',
};

// A stable pick per message, so a retried message gets the same line.
function pick(n: number, seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0) % n;
}

// Adds the student's voice to replies that name a situation. Straight, an
// unset voice, or no approved line leaves the reply exactly as code wrote it.
export function applyVoice(
  replies: Reply[],
  profile: Profile,
  seed: string,
): Reply[] {
  return replies.map((reply) => {
    const { situation, ...rest } = reply;
    if (!situation || !profile.voice || profile.voice === "straight")
      return rest;
    const lines = LIBRARY[profile.voice][situation].filter(
      (l) => l.approved && (!l.swears || profile.adult === true),
    );
    if (!lines.length) return rest;
    const line = lines[pick(lines.length, `${seed}:${situation}`)].text;
    const swap = SWAP[situation];
    return {
      ...rest,
      text: swap ? `${line} ${swap}` : `${line}\n${rest.text}`,
    };
  });
}
