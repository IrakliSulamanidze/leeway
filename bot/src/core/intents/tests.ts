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
    const own = new Set(
      upcoming.map(
        ({ a, day }) =>
          `${a.course_id}|${day}|${(a.title || "").toLowerCase()}`,
      ),
    );

    // Classmates' dates the student doesn't already have. Within one test
    // (course and name), each classmate's dates are kept apart, so one
    // classmate's weekly quiz is two quizzes, and two classmates who disagree
    // show both dates.
    const groups = new Map<
      string,
      { courseId: string; title: string; bySource: Map<number, Set<string>> }
    >();
    for (const t of await deps.sharing.sharedTests(turn.msg.from, {
      from: today,
      to: until,
    })) {
      if (own.has(`${t.courseId}|${t.onDate}|${t.title.toLowerCase()}`))
        continue;
      const key = `${t.courseId}|${t.title.toLowerCase()}`;
      const g = groups.get(key) ?? {
        courseId: t.courseId,
        title: t.title,
        bySource: new Map(),
      };
      g.bySource.set(
        t.source,
        (g.bySource.get(t.source) ?? new Set()).add(t.onDate),
      );
      groups.set(key, g);
    }
    type Line = { day: string; text: string };
    const theirs: Line[] = [];
    for (const { courseId, title, bySource } of groups.values()) {
      const course = names.get(courseId) ?? "Course";
      const sets = [...bySource.values()].map((d) => [...d].sort().join(","));
      const agree = sets.every((x) => x === sets[0]);
      const days = [
        ...new Set([...bySource.values()].flatMap((d) => [...d])),
      ].sort();
      if (bySource.size > 1 && !agree)
        theirs.push({
          day: days[0],
          text: `${course} · ${title}: classmates say ${days.map(dayName).join(" or ")}`,
        });
      else
        for (const day of days)
          theirs.push({
            day,
            text: `${dayName(day)} · ${course} · ${title} (from ${bySource.size > 1 ? "classmates" : "a classmate"})`,
          });
    }

    if (!upcoming.length && !theirs.length)
      return {
        replies: [
          {
            text: "No tests marked in the next three weeks.",
            situation: "tests_none",
          },
        ],
      };
    const lines = [
      ...upcoming.map(({ a, day }) => ({
        day,
        text: `${dayName(day)} · ${names.get(a.course_id) ?? "Course"} · ${a.title || "Test"}`,
      })),
      ...theirs,
    ]
      .sort((x, y) => x.day.localeCompare(y.day))
      .map((l) => l.text);
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
