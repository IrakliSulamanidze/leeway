// Turns what the AI reader found into the exact command the bot already
// answers, so a read message and a typed command go down the same path.
import type { Reading } from "../ports";

const COURSE = /^[\p{L}\p{N} &.'-]{2,60}$/u;

export function commandFor(r: Reading): string | null {
  switch (r.kind) {
    case "lives":
    case "today":
    case "tomorrow":
    case "tests":
    case "help":
      return r.kind;
    case "week":
      return "this week";
    case "log_skip":
      return r.course && COURSE.test(r.course)
        ? `skipped ${r.course.toLowerCase()}`
        : null;
    case "plan_skip":
      return r.course && COURSE.test(r.course)
        ? `skipping ${r.course.toLowerCase()} tomorrow`
        : null;
    default:
      return null;
  }
}
