import { describe, expect, it } from "vitest";
import {
  canISkip,
  dedupeClasses,
  ifYouHaveToMissOne,
  leftOutLine,
  weekRange,
  weekStart,
  type WeekAssessment,
  type WeekClass,
  type WeekCourse,
} from "./week";

// Week of Mon 2 Nov 2026 (Madrid is UTC+1 after 25 Oct).
const WEEK = { from: "2026-11-02", to: "2026-11-08" };

const cls = (
  id: string,
  course_id: string,
  starts_at: string,
  extra: Partial<WeekClass> = {},
): WeekClass => ({
  id,
  course_id,
  starts_at,
  kind: "class",
  is_exam_slot: false,
  session_numbers: [1],
  ...extra,
});

const courses: WeekCourse[] = [
  { id: "fin", name: "Financial Accounting", left: 5 },
  { id: "micro", name: "Microeconomics", left: 2 },
  { id: "stats", name: "Statistics II", left: 1 },
];

const marks: WeekAssessment[] = ["fin", "micro", "stats"].map((c) => ({
  course_id: c,
  class_session_id: null,
  session_number: 30,
  on_date: null,
}));

describe("ifYouHaveToMissOne", () => {
  const sessions = [
    cls("f1", "fin", "2026-11-06T08:00:00Z"),
    cls("m1", "micro", "2026-11-04T08:00:00Z"),
    cls("m2", "micro", "2026-11-05T08:00:00Z"),
    cls("s1", "stats", "2026-11-03T10:30:00Z"),
  ];
  const testDay: WeekAssessment = {
    course_id: "micro",
    class_session_id: null,
    session_number: null,
    on_date: "2026-11-05",
  };

  it("never offers a test day", () => {
    const r = ifYouHaveToMissOne(
      WEEK,
      sessions,
      courses,
      [],
      [...marks, testDay],
    );
    expect(r.options.map((o) => o.cls.id)).not.toContain("m2");
    expect(r.leftOut).toContainEqual({
      course: "Microeconomics",
      reason: "test",
      day: "Thu 5",
    });
  });

  it("never offers an exam slot, an exam or a deadline", () => {
    const r = ifYouHaveToMissOne(
      WEEK,
      [
        cls("slot", "fin", "2026-11-03T08:30:00Z", { is_exam_slot: true }),
        cls("ex", "fin", "2026-11-03T08:00:00Z", { kind: "exam" }),
        cls("dl", "fin", "2026-11-03T22:00:00Z", { kind: "deadline" }),
        cls("f1", "fin", "2026-11-06T08:00:00Z"),
      ],
      courses,
      [],
      marks,
    );
    expect(r.options.map((o) => o.cls.id)).toEqual(["f1"]);
  });

  it("never offers a course on its last life", () => {
    const r = ifYouHaveToMissOne(WEEK, sessions, courses, [], marks);
    expect(r.options.map((o) => o.cls.course_id)).not.toContain("stats");
    expect(leftOutLine(r.leftOut)).toBe("Left out: Statistics II (last life).");
  });

  it("lists the cheapest first", () => {
    const r = ifYouHaveToMissOne(WEEK, sessions, courses, [], marks);
    expect(r.options.map((o) => [o.cls.id, o.leftAfter])).toEqual([
      ["f1", 4],
      ["m1", 1],
      ["m2", 1],
    ]);
  });

  it("leaves out a course with no test marks", () => {
    const r = ifYouHaveToMissOne(WEEK, sessions, courses, [], marks.slice(1));
    expect(r.options.map((o) => o.cls.course_id)).not.toContain("fin");
    expect(r.leftOut).toContainEqual({
      course: "Financial Accounting",
      reason: "mark",
    });
  });
});

describe("canISkip", () => {
  it("asks to mark a course's test days first", () => {
    const r = canISkip(
      WEEK,
      [cls("f1", "fin", "2026-11-06T08:00:00Z")],
      courses,
      [],
      [],
    );
    expect(r.state).toBe("mark");
    expect(r.verdict).toBe("Mark Financial Accounting's test days first");
  });

  it("says when a course would be on its last life", () => {
    const r = canISkip(
      { from: "2026-11-05", to: "2026-11-09" },
      [
        cls("a", "fin", "2026-11-05T08:00:00Z"),
        cls("b", "fin", "2026-11-06T08:00:00Z"),
        cls("c", "micro", "2026-11-09T08:00:00Z"),
      ],
      courses,
      [],
      marks,
    );
    expect(r.verdict).toBe(
      "You'd miss 3 classes. Microeconomics would be on its last life.",
    );
    expect(r.classes.map((c) => c.leftAfter)).toEqual([4, 3, 1]);
  });

  it("counts a double class twice and a planned class not at all", () => {
    const r = canISkip(
      WEEK,
      [
        cls("d", "fin", "2026-11-03T08:00:00Z", { session_numbers: [13, 14] }),
        cls("p", "fin", "2026-11-04T08:00:00Z"),
      ],
      courses,
      [{ course_id: "fin", class_session_id: "p", skip_date: "2026-11-04" }],
      marks,
    );
    expect(r.classes.map((c) => [c.cost, c.planned])).toEqual([
      [2, false],
      [0, true],
    ]);
    expect(r.verdict).toBe("You'd miss 1 class. Every course stays safe.");
  });

  it("flags a test day before lives", () => {
    const r = canISkip(
      WEEK,
      [cls("f1", "fin", "2026-11-06T08:00:00Z", { session_numbers: [30] })],
      courses,
      [],
      marks,
    );
    expect(r.state).toBe("test");
  });
});

describe("dedupe and weeks", () => {
  it("counts the same class in two calendars once", () => {
    const a = cls("a", "fin", "2026-11-06T08:00:00Z");
    const b = cls("b", "fin", "2026-11-06T09:00:00+01:00");
    expect(dedupeClasses([a, b])).toEqual([a]);
    const r = canISkip(WEEK, [a, b], courses, [], marks);
    expect(r.classes).toHaveLength(1);
  });

  it("finds the Monday of the week", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
    expect(weekRange("2026-11-04")).toEqual(WEEK);
  });

  it("uses the Madrid date near midnight", () => {
    // 23:30 UTC on Sun 8 Nov is Mon 9 Nov in Madrid: outside the week.
    const r = canISkip(
      WEEK,
      [cls("late", "fin", "2026-11-08T23:30:00Z")],
      courses,
      [],
      marks,
    );
    expect(r.state).toBe("none");
  });
});
