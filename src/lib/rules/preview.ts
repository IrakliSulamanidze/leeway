// The line under the skip field: what this skip would cost, verdict first.
// Pure: no I/O. All preview copy lives in this file.
import { DEFAULT_SESSIONS, type Pace, livesFor, paceLabel } from "./lives";

export const PREVIEW_PROMPT =
  "Type a class to see what skipping it would cost.";
export const PREVIEW_LAST_SPARE =
  "This uses your last spare. After it, the next skip takes you below 80%.";
export const PREVIEW_OUT = "Out of lives. The next skip takes you below 80%.";
export const PREVIEW_DOUBLE_OVER =
  "This uses 2 lives. You have 1, so it takes you below 80%.";
export const PREVIEW_OVER = "Over the limit. Talk to your professor.";

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
const word = (n: number) => WORDS[n] ?? String(n);
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export type PreviewInput = {
  typed: string;
  // The matched course, or null for a new one.
  course: { lives: number; left: number } | null;
  sessions?: 1 | 2;
  weeksToGo: number;
  weekOfTerm?: number;
  skipsLast4Weeks?: number;
};

// "about one skip every two weeks": how often the lives left can be spent.
function rhythm(left: number, weeksToGo: number): string {
  const every = Math.floor(weeksToGo / left);
  if (every < 1) return "";
  if (every === 1) return ": about one skip a week";
  if (every === 4) return ": about one skip a month";
  return `: about one skip every ${word(every)} weeks`;
}

// The reserve life: a planned save that would spend a course's last spare asks
// first. Courses with fewer than 2 lives have no reserve. Today never asks.
export function asksLastSpare(
  course: { lives: number; left: number } | undefined,
  day: "today" | "tomorrow",
  sessions: 1 | 2,
): boolean {
  if (!course || day !== "tomorrow" || course.lives < 2) return false;
  return course.left >= 1 && course.left - sessions <= 0;
}

// state is null only for the prompt, which shows no state colour.
export function previewLine(i: PreviewInput): {
  text: string;
  state: Pace | null;
} {
  if (!i.typed.trim()) return { text: PREVIEW_PROMPT, state: null };
  const cost = i.sessions ?? 1;
  const lives = i.course ? i.course.lives : livesFor(DEFAULT_SESSIONS);
  const before = i.course ? i.course.left : lives;
  const after = before - cost;
  const state = paceLabel({
    left: after,
    lives,
    skipsLast4Weeks: (i.skipsLast4Weeks ?? 0) + 1,
    weekOfTerm: i.weekOfTerm ?? 0,
    weeksToGo: i.weeksToGo,
  });

  if (before < 0) return { text: PREVIEW_OVER, state };
  if (before === 0) return { text: PREVIEW_OUT, state };
  if (after < 0) return { text: PREVIEW_DOUBLE_OVER, state };
  if (after === 0) return { text: PREVIEW_LAST_SPARE, state };

  const uses = `This uses ${plural(cost, "life", "lives")}.`;
  if (!i.course) {
    return {
      text: `New course. You'll have ${after} of ${lives} lives left.`,
      state,
    };
  }
  const weeks =
    i.weeksToGo > 0 ? `, ${plural(i.weeksToGo, "week", "weeks")} to go` : "";
  const pace = after >= 2 && i.weeksToGo > 0 ? rhythm(after, i.weeksToGo) : "";
  return { text: `${uses} ${after} left${weeks}${pace}.`, state };
}
