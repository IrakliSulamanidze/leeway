import { describe, expect, it } from "vitest";
import { normalise } from "./normalise";

describe("normalise", () => {
  it("lowercases, collapses spaces and drops trailing punctuation", () => {
    expect(normalise("  Help   ME?! ")).toBe("help me");
  });

  it("removes zero-width characters that would defeat exact commands", () => {
    expect(normalise("he​lp")).toBe("help");
  });

  it("folds full-width letters", () => {
    expect(normalise("ＨＥＬＰ")).toBe("help");
  });

  it("keeps inner punctuation", () => {
    expect(normalise("10-17 nov.")).toBe("10-17 nov");
  });
});
