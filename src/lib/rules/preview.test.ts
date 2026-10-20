import { describe, expect, it } from "vitest";
import { previewLine } from "./preview";

// Mid-term: week 7, 8 weeks to go (the mockup's 20 Oct).
const base = { weeksToGo: 8, weekOfTerm: 7, skipsLast4Weeks: 0 };
const existing = (left: number, lives = 6) => ({ lives, left });

describe("previewLine: copy from the signed-off mockups, verbatim", () => {
  it("prompts before anything is typed", () => {
    expect(previewLine({ ...base, typed: "  ", course: null })).toEqual({
      text: "Type a class to see what skipping it would cost.",
      state: null,
    });
  });
  it("existing course with lives to spare", () => {
    expect(
      previewLine({
        ...base,
        typed: "Financial Accounting",
        course: existing(5),
      }),
    ).toEqual({
      text: "This uses 1 life. 4 left, 8 weeks to go: about one skip every two weeks.",
      state: "safe",
    });
  });
  it("last spare", () => {
    expect(
      previewLine({ ...base, typed: "Statistics II", course: existing(1) }),
    ).toEqual({
      text: "This uses your last spare. After it, the next skip takes you below 80%.",
      state: "out",
    });
  });
});

describe("previewLine: drafted copy (not in the mockups)", () => {
  it("new course assumes 30 sessions", () => {
    expect(
      previewLine({
        ...base,
        typed: "QA-7F3K2A grading bot test",
        course: null,
      }),
    ).toEqual({
      text: "New course: 30 sessions assumed, so 6 lives. This uses 1 life.",
      state: "safe",
    });
  });
  it("out of lives", () => {
    expect(
      previewLine({ ...base, typed: "Statistics II", course: existing(0) }),
    ).toEqual({
      text: "You're out of lives. This skip takes you below 80%.",
      state: "over",
    });
  });
  it("over the limit", () => {
    expect(
      previewLine({ ...base, typed: "Statistics II", course: existing(-1) }),
    ).toEqual({
      text: "You're already below 80%. This adds another absence.",
      state: "over",
    });
  });
  it("double class with one life left", () => {
    const line = previewLine({
      ...base,
      typed: "Micro",
      course: existing(1),
      sessions: 2,
    });
    expect(line).toEqual({
      text: "This uses 2 lives. You have 1, so it takes you below 80%.",
      state: "over",
    });
  });
});

describe("previewLine: numbers and state", () => {
  it("a double class costs 2", () => {
    expect(
      previewLine({ ...base, typed: "Micro", course: existing(5), sessions: 2 })
        .text,
    ).toBe(
      "This uses 2 lives. 3 left, 8 weeks to go: about one skip every two weeks.",
    );
  });
  it("says one skip a week, drops the rhythm with 1 left or more lives than weeks", () => {
    expect(
      previewLine({ ...base, typed: "M", course: existing(3), weeksToGo: 3 })
        .text,
    ).toBe("This uses 1 life. 2 left, 3 weeks to go: about one skip a week.");
    expect(previewLine({ ...base, typed: "M", course: existing(2) }).text).toBe(
      "This uses 1 life. 1 left, 8 weeks to go.",
    );
    expect(
      previewLine({ ...base, typed: "M", course: existing(6), weeksToGo: 2 })
        .text,
    ).toBe("This uses 1 life. 5 left, 2 weeks to go.");
  });
  it("says 1 week, and drops weeks after the term", () => {
    expect(
      previewLine({ ...base, typed: "M", course: existing(2), weeksToGo: 1 })
        .text,
    ).toBe("This uses 1 life. 1 left, 1 week to go.");
    expect(
      previewLine({ ...base, typed: "M", course: existing(5), weeksToGo: 0 })
        .text,
    ).toBe("This uses 1 life. 4 left.");
  });
  it("colours by the pace after this skip", () => {
    expect(
      previewLine({ ...base, typed: "M", course: existing(2) }).state,
    ).toBe("last");
    expect(
      previewLine({ ...base, typed: "M", course: existing(3) }).state,
    ).toBe("burning");
    expect(
      previewLine({
        ...base,
        typed: "M",
        course: existing(5),
        skipsLast4Weeks: 1,
      }).state,
    ).toBe("burning");
  });
});
