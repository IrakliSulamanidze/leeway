import { describe, expect, it } from "vitest";
import { nearMatch, normName } from "./match";

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
