import { describe, expect, it } from "vitest";
import { applyVoice } from "./apply";
import { LIBRARY } from "./library";
import type { Library } from "./types";

const lines = Object.entries(LIBRARY).flatMap(([voice, bySituation]) =>
  Object.entries(bySituation).flatMap(([situation, list]) =>
    list.map((l) => ({ voice, situation, ...l })),
  ),
);

// Topics a joke must never touch (the plan's guardrails), and words that
// assume why a class was missed.
const OFF_LIMITS =
  /\b(fat|ugly|skinny|body|looks|race|religio|sex|depress|anxiety|mental|crazy|stupid|dumb|idiot|poor|broke|money|kill|die|dead|alive|sick|bed|lazy|hangover|drunk)\b/i;

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

// A small library with approved lines, so the rules are tested whatever
// Irakli has approved so far.
const FIXTURE = {
  friendly: { ...LIBRARY.friendly },
  roast: {
    ...LIBRARY.roast,
    skip_saved: [
      { text: "Clean line.", approved: true },
      { text: "Damn line.", approved: true, swears: true },
    ],
    lives_ok: [{ text: "Not approved yet.", approved: false }],
  },
} satisfies Library;

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
    expect(
      applyVoice([reply], { voice: "roast", adult: true }, "m1", FIXTURE),
    ).toEqual([{ text: reply.text }]);
  });

  it("keeps the facts word for word after the line, and picks the same line for the same message", () => {
    const a = applyVoice([reply], { voice: "friendly", adult: true }, "m1")[0]
      .text;
    expect(a.endsWith(`\n${reply.text}`)).toBe(true);
    expect(
      applyVoice([reply], { voice: "friendly", adult: true }, "m1")[0].text,
    ).toBe(a);
  });

  it("sends swearing lines to adults only", () => {
    const used = (adult: boolean | null) =>
      new Set(
        Array.from(
          { length: 60 },
          (_, i) =>
            applyVoice(
              [{ text: "x", situation: "skip_saved" }],
              { voice: "roast", adult },
              `m${i}`,
              FIXTURE,
            )[0].text.split("\n")[0],
        ),
      );
    expect(used(true)).toContain("Damn line.");
    for (const adult of [false, null])
      expect(used(adult)).toEqual(new Set(["Clean line."]));
  });

  it("drops the line rather than break WhatsApp's limits", () => {
    const long = {
      text: "x".repeat(1020),
      buttons: [{ id: "a", title: "Ok" }],
      situation: "skip_ask" as const,
    };
    expect(
      applyVoice([long], { voice: "friendly", adult: true }, "m1")[0].text,
    ).toBe(long.text);
  });
});
