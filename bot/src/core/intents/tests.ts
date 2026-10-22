import { addDays, madridToday } from "@/lib/rules/dates";
import {
  madridDate,
  type WeekAssessment,
  type WeekClass,
} from "@/lib/rules/week";
import { dayName } from "../data";
import type { Intent } from "./types";

const WORDS = new Set(["tests", "my tests", "exams", "upcoming tests"]);
const DAYS_AHEAD = 21;

// The Madrid date of a test: its own date, its class, or the class holding its
// session number.
function testDay(a: WeekAssessment, sessions: WeekClass[]): string | null {
  if (a.on_date) return a.on_date;
  const cls =
    sessions.find((s) => s.id === a.class_session_id) ??
    (a.session_number === null
      ? undefined
      : sessions.find(
          (s) =>
            s.course_id === a.course_id &&
            s.session_numbers.includes(a.session_number!),
        ));
  return cls ? madridDate(cls.starts_at) : null;
}

export const tests: Intent = {
  name: "tests",
  matches: (t) =>
    t.button === "tests" || (t.text !== null && WORDS.has(t.text)),
  async run(turn, deps) {
    const today = madridToday(turn.now);
    const until = addDays(today, DAYS_AHEAD);
    const snap = await deps.student.snapshot(turn.msg.from, {
      from: today,
      to: until,
    });
    const names = new Map(snap.courses.map((c) => [c.id, c.name]));
    const upcoming = snap.assessments
      .map((a) => ({ a, day: testDay(a, snap.sessions) }))
      .filter(
        (x): x is { a: WeekAssessment; day: string } =>
          x.day !== null && x.day >= today && x.day <= until,
      )
      .sort((x, y) => x.day.localeCompare(y.day));
    if (!upcoming.length)
      return {
        replies: [
          {
            text: "No tests marked in the next three weeks.",
            situation: "tests_none",
          },
        ],
      };
    const lines = upcoming.map(
      ({ a, day }) =>
        `${dayName(day)} · ${names.get(a.course_id) ?? "Course"} · ${a.title ?? "Test"}`,
    );
    return {
      replies: [
        {
          text: `Tests in the next three weeks:\n${lines.join("\n")}`,
          situation: "tests_some",
        },
      ],
    };
  },
};
