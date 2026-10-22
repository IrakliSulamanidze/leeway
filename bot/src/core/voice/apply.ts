import type { Reply } from "../types";
import { replyProblems } from "../reply";
import { LIBRARY } from "./library";
import type { Library, Voice } from "./types";

export type Profile = { voice: Voice | null; adult: boolean | null };

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
  profile: Pick<Profile, "voice" | "adult">,
  seed: string,
  library: Library = LIBRARY,
): Reply[] {
  return replies.map((reply) => {
    const { situation, ...rest } = reply;
    if (!situation || !profile.voice || profile.voice === "straight")
      return rest;
    const lines = library[profile.voice][situation].filter(
      (l) => l.approved && (!l.swears || profile.adult === true),
    );
    if (!lines.length) return rest;
    const line = lines[pick(lines.length, `${seed}:${situation}`)].text;
    const voiced = { ...rest, text: `${line}\n${rest.text}` };
    // A line never costs a reply: past WhatsApp's limits, send the facts alone.
    return replyProblems(voiced).length ? rest : voiced;
  });
}
