import { madridToday } from "@/lib/rules/dates";
import { courseLives } from "../data";
import type { Intent } from "./types";

const WORDS = new Set(["lives", "my lives", "lives left", "how many lives"]);

function status(left: number): string {
  if (left < 0) return ", over the limit";
  if (left === 0) return ", out of lives";
  if (left === 1) return ", last one";
  return "";
}

export const lives: Intent = {
  name: "lives",
  matches: (t) =>
    t.button === "lives" || (t.text !== null && WORDS.has(t.text)),
  async run(turn, deps) {
    const today = madridToday(turn.now);
    const snap = await deps.student.snapshot(turn.msg.from, {
      from: today,
      to: today,
    });
    if (!snap.courses.length)
      return {
        replies: [
          { text: "You have no courses yet. Add them on the Leeway website." },
        ],
      };
    const lines = courseLives(snap, today)
      .sort((a, b) => a.left - b.left || a.name.localeCompare(b.name))
      .map(
        (c) =>
          `${c.name}: ${Math.max(c.left, 0)} of ${c.lives} left${status(c.left)}`,
      );
    return { replies: [{ text: `Your lives:\n${lines.join("\n")}` }] };
  },
};
