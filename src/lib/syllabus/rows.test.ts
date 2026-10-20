import { describe, expect, it } from "vitest";
import { SYLLABUS_READ } from "../../../tests/fixtures/synthetic-syllabus";
import { diffSaved, reviewFromRead } from "./rows";

describe("reviewFromRead", () => {
  const review = reviewFromRead(SYLLABUS_READ);

  it("splits a shared weight evenly and labels it assumed", () => {
    const ce = review.tests.filter((t) => t.title.startsWith("Continuous"));
    expect(ce.map((t) => [t.title, t.session, t.weight, t.assumed])).toEqual([
      ["Continuous Evaluation I", 5, 10, true],
      ["Continuous Evaluation II", 8, 10, true],
      ["Continuous Evaluation III", 10, 10, true],
    ]);
  });

  it("asks which session a group-dependent item is in", () => {
    const g = review.tests.find((t) => t.title === "Group presentation");
    expect(g).toMatchObject({ session: null, options: [11, 12], weight: 20 });
  });

  it("keeps participation out of the test lines", () => {
    expect(review.participation).toBe(10);
    expect(review.tests.some((t) => /participation/i.test(t.title))).toBe(
      false,
    );
  });

  it("dates only tests the syllabus puts in a session", () => {
    const item = (
      name: string,
      kind: "test" | "exam" | "other" | "presentation",
      quote: string,
      extra: { sessions?: number[]; continuous?: boolean } = {},
    ) => ({
      name,
      kind,
      sessions: extra.sessions ?? [],
      weight_percent: 10,
      weight_is_assumed_split: false,
      depends_on_group: false,
      continuous: extra.continuous ?? false,
      quote,
    });
    const r = reviewFromRead({
      ...SYLLABUS_READ,
      assessments: [
        // Grading table only: the session comes from the session plan.
        item("Final exam", "exam", "Final exam 30%"),
        // The quote names the sessions.
        item("Intermediate tests", "test", "Two tests, in sessions 4 and 9"),
        // Coursework: a weight, never a row.
        item("Group work", "other", "Group work 15%", { continuous: true }),
        item("Individual work", "other", "Individual work 20%"),
        // A presentation with no session anywhere: left out, not guessed.
        item("Individual presentation", "presentation", "Presentation 5%"),
      ],
      sessions: [
        ...SYLLABUS_READ.sessions.filter((s) => s.number !== 12),
        {
          number: 12,
          title: "FINAL EXAM",
          kind: "class",
          pre_reading: null,
          inferred: false,
        },
      ],
    });
    expect(r.tests.map((t) => [t.title, t.session])).toEqual([
      ["Final exam", 12],
      ["Intermediate tests I", 4],
      ["Intermediate tests II", 9],
    ]);
  });

  it("keeps the retake rule as not stated", () => {
    expect(review.retake).toEqual({ general: null, statedHere: false });
  });
});

describe("diffSaved", () => {
  const before = {
    tests: [
      { session_number: 5, title: "Test I", weight: 10, weight_assumed: true },
      {
        session_number: 12,
        title: "Final exam",
        weight: 40,
        weight_assumed: false,
      },
    ],
    topics: [
      {
        session_number: 1,
        topic: "Widgets",
        pre_reading: null,
        probably: false,
      },
    ],
  };

  it("shows nothing when the syllabus is the same", () => {
    expect(diffSaved(before, before)).toEqual([]);
  });

  it("shows only the lines that changed", () => {
    const after = {
      tests: [
        {
          session_number: 5,
          title: "Test I",
          weight: 10,
          weight_assumed: true,
        },
        {
          session_number: 12,
          title: "Final exam",
          weight: 50,
          weight_assumed: false,
        },
        {
          session_number: 9,
          title: "Test II",
          weight: 10,
          weight_assumed: true,
        },
      ],
      topics: [],
    };
    expect(diffSaved(before, after)).toEqual([
      { kind: "added", what: "test", session: 9, text: "Test II · 10%" },
      { kind: "changed", what: "test", session: 12, text: "Final exam · 50%" },
      { kind: "removed", what: "topic", session: 1, text: "Widgets" },
    ]);
  });
});
