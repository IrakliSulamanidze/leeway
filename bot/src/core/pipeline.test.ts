import { describe, expect, it } from "vitest";
import { fixedClock } from "../adapters/clock";
import { MemoryStudent, sampleSnapshot } from "../adapters/memory-student";
import { INTENTS } from "./intents/registry";
import { LINES } from "./lines";
import { handle } from "./pipeline";
import { replyProblems } from "./reply";
import type { Inbound, InboundBody } from "./types";

const deps = {
  clock: fixedClock("2026-10-26T09:00:00Z"),
  student: new MemoryStudent(sampleSnapshot(new Date("2026-10-26T09:00:00Z"))),
};
const msg = (body: InboundBody): Inbound => ({
  id: "wamid.1",
  from: "34600000000",
  at: new Date("2026-10-26T09:00:00Z"),
  body,
});
const text = (t: string) => msg({ kind: "text", text: t });

describe("handle", () => {
  it("answers help in any case and with punctuation", async () => {
    for (const t of ["help", "HELP!", " Menu ", "hi"])
      expect((await handle(text(t), deps))[0].text).toBe(LINES.help);
  });

  it("answers the help button", async () => {
    expect(
      (await handle(msg({ kind: "button", id: "help" }), deps))[0].text,
    ).toBe(LINES.help);
  });

  it("points unknown text and unknown buttons to help", async () => {
    expect(await handle(text("can i skip micro tmrw"), deps)).toEqual([
      { text: LINES.notUnderstood },
    ]);
    expect(await handle(msg({ kind: "button", id: "gone" }), deps)).toEqual([
      { text: LINES.notUnderstood },
    ]);
  });

  it("says it reads text only for voice and other media", async () => {
    for (const body of [
      { kind: "voice", mediaId: "m1" },
      { kind: "unsupported" },
    ] as const)
      expect(await handle(msg(body), deps)).toEqual([{ text: LINES.textOnly }]);
  });
});

describe("registry and lines", () => {
  it("has unique intent names", () => {
    const names = INTENTS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps every fixed line sendable", () => {
    for (const text of Object.values(LINES))
      expect(replyProblems({ text })).toEqual([]);
  });
});
