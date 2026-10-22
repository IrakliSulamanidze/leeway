import { addDays, madridToday } from "@/lib/rules/dates";
import { canISkip, type Range, weekRange } from "@/lib/rules/week";
import { weekCourses } from "../data";
import type { Intent, Turn } from "./types";

const MAX_ROWS = 12;

function rangeFor(turn: Turn): { range: Range; label: string } | null {
  const today = madridToday(turn.now);
  const word = turn.button ?? turn.text;
  if (word === "today")
    return { range: { from: today, to: today }, label: "Today" };
  if (word === "tomorrow") {
    const day = addDays(today, 1);
    return { range: { from: day, to: day }, label: "Tomorrow" };
  }
  if (word === "week" || word === "this week")
    // The rest of the week, as the web's plan page counts it.
    return {
      range: { from: today, to: weekRange(today).to },
      label: "This week",
    };
  return null;
}

// Today, tomorrow or this week: what skipping it all would cost, with the
// same verdict the web app's "Can I skip?" gives.
export const week: Intent = {
  name: "week",
  matches: (t) => rangeFor(t) !== null,
  async run(turn, deps) {
    const { range, label } = rangeFor(turn)!;
    const today = madridToday(turn.now);
    const snap = await deps.student.snapshot(turn.msg.from, range);
    const answer = canISkip(
      range,
      snap.sessions,
      weekCourses(snap, today),
      snap.skips,
      snap.assessments,
    );
    const rows = answer.classes.slice(0, MAX_ROWS).map((r) => {
      const extra = r.planned
        ? ", skip planned"
        : r.testDay
          ? `, ${r.test ?? "test"}`
          : "";
      return `${r.day} · ${r.course}${extra}`;
    });
    const more =
      answer.classes.length > MAX_ROWS
        ? `\n…and ${answer.classes.length - MAX_ROWS} more`
        : "";
    const list = rows.length ? `\n\n${rows.join("\n")}${more}` : "";
    return { replies: [{ text: `${label}: ${answer.verdict}${list}` }] };
  },
};
