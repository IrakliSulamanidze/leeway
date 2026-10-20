import { describe, expect, it } from "vitest";
import { nightAlert, type AlertCourse, type AlertInput } from "./alert";

const TOMORROW = "2026-10-21"; // Wednesday; Madrid is UTC+2 until 25 Oct
const course = (id: string, name: string, used = 0): AlertCourse => ({
  id,
  name,
  sessions_typed: 30, // 6 lives
  sessions_syllabus: null,
  sessions_calendar: null,
  missed_before: used,
});
const cls = (course_id: string, starts_at: string, kind = "class") => ({
  course_id,
  starts_at,
  kind,
  is_exam_slot: false,
});
const base = (over: Partial<AlertInput>): AlertInput => ({
  tomorrow: TOMORROW,
  courses: [],
  skips: [],
  classes: [],
  tests: [],
  calendar: { failed: false, syncedOn: "2026-10-20" },
  ...over,
});

describe("nightAlert", () => {
  it("warns about a course on its last life with a class tomorrow", () => {
    const msg = nightAlert(
      base({
        courses: [course("s", "Statistics II", 5)],
        classes: [cls("s", "2026-10-21T09:00:00Z")],
      }),
    );
    expect(msg).toBe("Statistics II at 11:00 tomorrow. It's on its last life.");
  });

  it("warns when out of lives", () => {
    const msg = nightAlert(
      base({
        courses: [course("s", "Statistics II", 6)],
        classes: [cls("s", "2026-10-21T09:00:00Z")],
      }),
    );
    expect(msg).toBe("Statistics II at 11:00 tomorrow. You're out of lives.");
  });

  it("warns about a test tomorrow", () => {
    const msg = nightAlert(
      base({
        courses: [course("m", "Microeconomics")],
        classes: [cls("m", "2026-10-21T07:00:00Z")],
        tests: [{ course_id: "m", on_date: TOMORROW, class_starts_at: null }],
      }),
    );
    expect(msg).toBe("Microeconomics at 9:00 tomorrow. It's a test day.");
  });

  it("reminds a planned skip of the class before the test (mockup copy)", () => {
    const msg = nightAlert(
      base({
        courses: [course("m", "Microeconomics")],
        skips: [
          {
            course_id: "m",
            sessions: 1,
            skip_date: TOMORROW,
            planned: true,
          },
        ],
        classes: [
          cls("m", "2026-10-21T07:00:00Z"),
          cls("m", "2026-10-23T07:00:00Z"),
        ],
        tests: [
          {
            course_id: "m",
            on_date: null,
            class_starts_at: "2026-10-23T07:00:00Z",
          },
        ],
      }),
    );
    expect(msg).toBe(
      "Microeconomics at 9:00 tomorrow. You planned to skip it, and it's the class before the test.",
    );
  });

  it("returns null on a night with no risk", () => {
    const msg = nightAlert(
      base({
        courses: [
          course("m", "Microeconomics"),
          course("s", "Statistics II", 5),
        ],
        classes: [
          cls("m", "2026-10-21T07:00:00Z"),
          cls("s", "2026-10-22T09:00:00Z"), // last life, but not tomorrow
        ],
      }),
    );
    expect(msg).toBeNull();
  });

  it("without a calendar, alerts only planned skips and dated tests", () => {
    const courses = [
      course("m", "Microeconomics"),
      course("s", "Statistics II", 5),
    ];
    expect(nightAlert(base({ calendar: null, courses }))).toBeNull();
    const msg = nightAlert(
      base({
        calendar: null,
        courses,
        skips: [
          { course_id: "m", sessions: 1, skip_date: TOMORROW, planned: true },
        ],
      }),
    );
    expect(msg).toBe("Microeconomics tomorrow. You planned to skip it.");
  });

  it("combines several courses into one message, earliest class first", () => {
    const msg = nightAlert(
      base({
        courses: [
          course("s", "Statistics II", 5),
          course("m", "Microeconomics"),
        ],
        classes: [
          cls("s", "2026-10-21T09:00:00Z"),
          cls("m", "2026-10-21T07:00:00Z"),
        ],
        tests: [{ course_id: "m", on_date: TOMORROW, class_starts_at: null }],
      }),
    );
    expect(msg).toBe(
      "Microeconomics at 9:00 tomorrow. It's a test day.\nStatistics II at 11:00 tomorrow. It's on its last life.",
    );
  });

  it("says which day the data is from when the sync failed", () => {
    const msg = nightAlert(
      base({
        calendar: { failed: true, syncedOn: "2026-10-20" },
        courses: [course("s", "Statistics II", 5)],
        classes: [cls("s", "2026-10-21T09:00:00Z")],
      }),
    );
    expect(msg).toBe(
      "Statistics II at 11:00 tomorrow. It's on its last life.\nCalendar as of Tue.",
    );
  });
});
