import { beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "../adapters/clock";
import { MemoryGate } from "../adapters/memory-gate";
import { processInbound } from "./inbound";
import { LINES } from "./lines";
import type { Inbound } from "./types";

const FROM = "ES.1234567890";
let gate: MemoryGate;
const deps = () => ({ clock: fixedClock("2026-10-26T09:00:00Z"), gate });
const text = (t: string): Inbound => ({
  id: `wamid.${t}`,
  from: FROM,
  at: new Date("2026-10-26T09:00:00Z"),
  body: { kind: "text", text: t },
});
const replyTo = async (t: string) =>
  (await processInbound(text(t), deps())).map((r) => r.text);

beforeEach(() => {
  gate = new MemoryGate();
});

describe("processInbound", () => {
  it("answers crisis words first, even when paused or over the cap", async () => {
    gate.isPaused = true;
    gate.cap = 0;
    expect(await replyTo("I want to kill myself")).toEqual([LINES.crisis]);
    expect(gate.counts.size).toBe(0);
  });

  it("records STOP and START", async () => {
    expect(await replyTo("STOP")).toEqual([LINES.stopped]);
    expect(gate.optedOut.has(FROM)).toBe(true);
    expect(await replyTo("start")).toEqual([LINES.started]);
    expect(gate.optedOut.has(FROM)).toBe(false);
  });

  it("ignores requests Meta delivers more than a day late, but not STOP", async () => {
    const late = { ...text("help"), at: new Date("2026-10-25T08:00:00Z") };
    expect(await processInbound(late, deps())).toEqual([]);
    const lateStop = { ...text("STOP"), at: late.at };
    expect(await processInbound(lateStop, deps())).toEqual([
      { text: LINES.stopped },
    ]);
  });

  it("answers every request with one line while paused", async () => {
    gate.isPaused = true;
    expect(await replyTo("help")).toEqual([LINES.paused]);
  });

  it("sends one notice past the daily cap, then nothing", async () => {
    gate.cap = 2;
    expect(await replyTo("help")).toEqual([LINES.help]);
    expect(await replyTo("help")).toEqual([LINES.help]);
    expect(await replyTo("help")).toEqual([LINES.tooMany]);
    expect(await replyTo("help")).toEqual([]);
  });
});
