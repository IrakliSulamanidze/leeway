// Preview syllabus cases (tech-plan 6): test names, participation line, exam prep,
// countdown and "probably". Copy from docs/spec.md.
import { describe, expect, it } from "vitest";
import {
  type TestRow,
  type TopicRow,
  countdown,
  isExamPrep,
  missLine,
  participationLine,
  syllabusPreview,
  testLine,
} from "./syllabus";

const tests: TestRow[] = [
  {
    session_number: 11,
    on_date: "2026-10-08",
    title: "Continuous Evaluation I",
    weight: 7.5,
  },
  {
    session_number: 16,
    on_date: "2026-10-22",
    title: "Continuous Evaluation II",
    weight: 7.5,
  },
  { session_number: 30, on_date: null, title: "Final exam", weight: 30 },
];
const topics: TopicRow[] = [
  {
    session_number: 9,
    topic: "Quicksort",
    pre_reading: "Grokking Algorithms, chapter 3",
    probably: false,
  },
  { session_number: 12, topic: "Heaps", pre_reading: null, probably: true },
  { session_number: 16, topic: "Test", pre_reading: null, probably: false },
];

describe("syllabus preview", () => {
  it("names the test on the session", () => {
    expect(testLine(16, tests)).toBe(
      "Session 16 is Continuous Evaluation II (7.5%). Skipping costs a life and the test.",
    );
    expect(testLine(15, tests)).toBeNull();
  });

  it("says what you'll miss, with the test link marked probably", () => {
    expect(missLine(9, topics, tests)).toBe(
      "Quicksort. Probably on the test in session 11. Catch up: Grokking Algorithms, chapter 3",
    );
  });

  it("marks a topic the syllabus doesn't say outright as probably", () => {
    expect(missLine(12, topics, tests)).toBe(
      "Probably Heaps. Probably on the test in session 16.",
    );
  });

  it("adds one quiet participation line", () => {
    expect(participationLine(10)).toBe(
      "Every skip also costs participation (10%).",
    );
    expect(participationLine(null)).toBeNull();
  });

  it("puts the lines together, test day first", () => {
    expect(
      syllabusPreview({ session: 16, tests, topics, participation: 10 }),
    ).toEqual([
      "Session 16 is Continuous Evaluation II (7.5%). Skipping costs a life and the test.",
      "Every skip also costs participation (10%).",
    ]);
    expect(
      syllabusPreview({ session: null, tests, topics, participation: null }),
    ).toEqual([]);
  });

  it("marks the session before a test as exam prep", () => {
    expect(isExamPrep(15, tests)).toBe(true);
    expect(isExamPrep(16, tests)).toBe(false);
    expect(isExamPrep(14, tests)).toBe(false);
  });

  it("counts down to the next dated test", () => {
    expect(countdown("2026-10-17", tests)).toBe(
      "Continuous Evaluation II in 5 days",
    );
    expect(countdown("2026-10-21", tests)).toBe(
      "Continuous Evaluation II tomorrow",
    );
    expect(countdown("2026-10-22", tests)).toBe(
      "Continuous Evaluation II today",
    );
    expect(countdown("2026-10-23", tests)).toBeNull();
  });
});
