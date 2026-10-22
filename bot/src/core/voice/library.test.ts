import { describe, expect, it } from "vitest";
import { applyVoice } from "./apply";
import { LIBRARY } from "./library";

const lines = Object.entries(LIBRARY).flatMap(([voice, bySituation]) =>
  Object.entries(bySituation).flatMap(([situation, list]) =>
    list.map((l) => ({ voice, situation, ...l })),
  ),
);

// Topics a joke must never touch (the plan's guardrails).
const OFF_LIMITS =
  /\b(fat|ugly|skinny|body|looks|gay|straight up|girl|boy|race|religio|sex|depress|anxiety|mental|crazy|stupid|dumb|idiot|poor|broke|money|kill|die|dead)\b/i;

describe("the line library", () => {
  it.each(lines)("$voice/$situation: $text", (l) => {
    expect(l.text.length).toBeLessThanOrEqual(80);
    expect(l.text).not.toMatch(/\d/); // facts come from code, never from a line
    expect(l.text).not.toMatch(/https?:|www\.|@/);
    expect(l.text).not.toMatch(/\{|\}/);
    expect(l.text).not.toMatch(OFF_LIMITS);
  });

  it("never swears in the friendly voice", () => {
    expect(lines.filter((l) => l.voice === "friendly" && l.swears)).toEqual([]);
  });
});

describe("applyVoice", () => {
  const reply = {
    text: "Your lives:\nMicro: 3 of 6 left",
    situation: "lives_ok" as const,
  };

  it("leaves straight and unset voices exactly as code wrote them", () => {
    expect(
      applyVoice([reply], { voice: "straight", adult: true }, "m1"),
    ).toEqual([{ text: reply.text }]);
    expect(applyVoice([reply], { voice: null, adult: true }, "m1")).toEqual([
      { text: reply.text },
    ]);
  });

  it("uses only approved lines", () => {
    // Roast lines wait for Irakli's approval.
    expect(applyVoice([reply], { voice: "roast", adult: true }, "m1")).toEqual([
      { text: reply.text },
    ]);
  });

  it("keeps the facts word for word after the voice line, and picks the same line for the same message", () => {
    const a = applyVoice([reply], { voice: "friendly", adult: true }, "m1")[0]
      .text;
    expect(a.endsWith(`\n${reply.text}`)).toBe(true);
    expect(
      applyVoice([reply], { voice: "friendly", adult: true }, "m1")[0].text,
    ).toBe(a);
  });

  it("never sends a swearing line to a student under 18 or who did not say", () => {
    for (const adult of [false, null])
      for (let i = 0; i < 50; i++) {
        const [r] = applyVoice(
          [{ text: "x", situation: "skip_saved" }],
          { voice: "roast", adult },
          `m${i}`,
        );
        const used = LIBRARY.roast.skip_saved.find((l) =>
          r.text.startsWith(l.text),
        );
        expect(used?.swears ?? false).toBe(false);
      }
  });
});
