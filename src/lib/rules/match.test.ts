import { describe, expect, it } from "vitest";
import { nearMatch, normName, partialMatches } from "./match";

const NAMES = [
  "Microeconomics",
  "Statistics II",
  "Financial Accounting",
  "Ética Empresarial",
];

describe("normName", () => {
  it("ignores case, accents and extra spaces", () => {
    expect(normName("  ÉTICA   empresarial ")).toBe("etica empresarial");
  });
});

describe("nearMatch", () => {
  it("suggests the closest name for a typo", () => {
    expect(nearMatch("Microeconomcs", NAMES)).toBe("Microeconomics");
    expect(nearMatch("statistcs ii", NAMES)).toBe("Statistics II");
    expect(nearMatch("Financial Acounting", NAMES)).toBe(
      "Financial Accounting",
    );
  });
  it("returns null for an exact match, ignoring case, accents and spaces", () => {
    expect(nearMatch("microeconomics", NAMES)).toBeNull();
    expect(nearMatch("  etica  EMPRESARIAL ", NAMES)).toBeNull();
    expect(nearMatch("Statistics II", NAMES)).toBeNull();
  });
  it("returns null when nothing is close or the text is too short", () => {
    expect(nearMatch("Algorithms", NAMES)).toBeNull();
    expect(nearMatch("QA-7F3K2A grading bot test", NAMES)).toBeNull();
    expect(nearMatch("Mic", NAMES)).toBeNull();
    expect(nearMatch("Microeconomics", [])).toBeNull();
  });
  it("prefers an exact match over a near one in the list", () => {
    expect(
      nearMatch("Statistics I", ["Statistics II", "Statistics I"]),
    ).toBeNull();
  });
});

describe("partialMatches", () => {
  const COURSES = [
    "Algorithms & Data Structures",
    "Financial Reporting & Analysis",
    "Computer Programming 2",
    "Computer Architecture",
  ];
  it("finds a course from the start of its name or its words", () => {
    expect(partialMatches("algo", COURSES)).toEqual([
      "Algorithms & Data Structures",
    ]);
    expect(partialMatches("fin rep", COURSES)).toEqual([
      "Financial Reporting & Analysis",
    ]);
    expect(partialMatches("data", COURSES)).toEqual([
      "Algorithms & Data Structures",
    ]);
  });
  it("lists every course that fits, best first", () => {
    expect(partialMatches("comp", COURSES)).toEqual([
      "Computer Architecture",
      "Computer Programming 2",
    ]);
  });
  it("is empty for an exact name, one letter or no fit", () => {
    expect(partialMatches("computer architecture", COURSES)).toEqual([]);
    expect(partialMatches("a", COURSES)).toEqual([]);
    expect(partialMatches("biology", COURSES)).toEqual([]);
  });
});
