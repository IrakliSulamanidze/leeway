import { describe, expect, it } from "vitest";
import { dateIn, MADRID } from "@/lib/rules/dates";
import { livesFor } from "@/lib/rules/lives";

// The bot answers with the web app's own rule functions. If this import breaks,
// the two channels could start to disagree.
describe("shared rules", () => {
  it("resolves the web app's rules from the bot", () => {
    expect(dateIn(new Date("2026-10-25T23:30:00Z"), MADRID)).toBe("2026-10-26");
    expect(livesFor(30)).toBeGreaterThan(0);
  });
});
