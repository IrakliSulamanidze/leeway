import { describe, expect, it } from "vitest";
import { type PaceInput, paceLabel } from "./lives";

// Mid-term defaults: week 7, 8 weeks to go, no recent skips.
const pace = (over: Partial<PaceInput>) =>
  paceLabel({
    left: 4,
    lives: 6,
    skipsLast4Weeks: 0,
    weekOfTerm: 7,
    weeksToGo: 8,
    ...over,
  });

describe("paceLabel", () => {
  it("names each state from lives left", () => {
    expect(pace({ left: -1 })).toBe("over");
    expect(pace({ left: 0 })).toBe("out");
    expect(pace({ left: 1 })).toBe("last");
    expect(pace({ left: 4 })).toBe("safe");
  });
  it("puts over before out before last before burning", () => {
    expect(pace({ left: -2, skipsLast4Weeks: 5 })).toBe("over");
    expect(pace({ left: 0, skipsLast4Weeks: 5 })).toBe("out");
    expect(pace({ left: 1, skipsLast4Weeks: 5 })).toBe("last");
    expect(pace({ left: 3, skipsLast4Weeks: 5 })).toBe("burning");
  });
  it("is burning fast with 2+ skips in the last 4 weeks", () => {
    expect(pace({ skipsLast4Weeks: 2 })).toBe("burning");
    expect(pace({ skipsLast4Weeks: 1 })).toBe("safe");
  });
  it("is burning fast with 2 left and more than 4 weeks to go", () => {
    expect(pace({ left: 2, weeksToGo: 5 })).toBe("burning");
    expect(pace({ left: 2, weeksToGo: 4 })).toBe("safe");
    expect(pace({ left: 3, weeksToGo: 10 })).toBe("safe");
  });
  it("never says burning fast before week 4", () => {
    expect(pace({ weekOfTerm: 3, skipsLast4Weeks: 3 })).toBe("safe");
    expect(pace({ weekOfTerm: 3, left: 2, weeksToGo: 12 })).toBe("safe");
    expect(pace({ weekOfTerm: 4, skipsLast4Weeks: 2 })).toBe("burning");
  });
  it("is attendance safe when missing every remaining class stays within the limit", () => {
    expect(pace({ left: 2, remainingClasses: 2, skipsLast4Weeks: 3 })).toBe(
      "attendance-safe",
    );
    expect(pace({ left: 1, remainingClasses: 0 })).toBe("attendance-safe");
    expect(pace({ left: 0, remainingClasses: 0 })).toBe("attendance-safe");
    expect(pace({ left: 3, remainingClasses: 4 })).toBe("safe");
  });
  it("is never attendance safe when already over", () => {
    expect(pace({ left: -1, remainingClasses: 0 })).toBe("over");
  });
});
