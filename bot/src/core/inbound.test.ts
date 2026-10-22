import { beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "../adapters/clock";
import { MemoryAccounts } from "../adapters/memory-accounts";
import { MemoryGate } from "../adapters/memory-gate";
import { processInbound } from "./inbound";
import { LINES, linkPrompt, waitlisted } from "./lines";
import type { Inbound } from "./types";

const FROM = "ES.1234567890";
let gate: MemoryGate;
let accounts: MemoryAccounts;
const deps = () => ({
  clock: fixedClock("2026-10-26T09:00:00Z"),
  gate,
  accounts,
});
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
  accounts = new MemoryAccounts(true);
  accounts.ages.set(FROM, true);
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

  it("sends an unlinked sender a one-time sign-in link", async () => {
    accounts.states.set(FROM, { state: "none" });
    expect(await replyTo("hi")).toEqual([
      linkPrompt("https://bot.test/link?t=token1"),
    ]);
  });

  it("links when the code from the sign-in page comes back from the same number", async () => {
    accounts.states.set(FROM, { state: "none" });
    accounts.pendingCode = "482913";
    expect(await replyTo("111111")).toEqual([LINES.wrongCode]);
    expect(await replyTo("482 913")).toEqual([LINES.linked]);
    expect((await accounts.state(FROM)).state).toBe("active");
  });

  it("sends a new link when a code arrives with nothing waiting for it", async () => {
    accounts.states.set(FROM, { state: "none" });
    expect(await replyTo("123456")).toEqual([
      linkPrompt("https://bot.test/link?t=token1"),
    ]);
  });

  it("tells a waitlisted student their place, and a suspended one what to do", async () => {
    accounts.states.set(FROM, { state: "waitlisted", place: 12 });
    expect(await replyTo("help")).toEqual([waitlisted(12)]);
    accounts.states.set(FROM, { state: "suspended" });
    expect(await replyTo("help")).toEqual([LINES.suspended]);
  });

  it("asks the age question once, then answers normally", async () => {
    accounts.ages.clear();
    const [ask] = await processInbound(text("help"), deps());
    expect(ask.text).toBe(LINES.askAge);
    expect(ask.buttons?.map((b) => b.id)).toEqual(["age.adult", "age.minor"]);
    const tap: Inbound = {
      ...text("x"),
      body: { kind: "button", id: "age.minor" },
    };
    expect((await processInbound(tap, deps())).map((r) => r.text)).toEqual([
      LINES.ageThanks,
    ]);
    expect(accounts.ages.get(FROM)).toBe(false);
    expect(await replyTo("help")).toEqual([LINES.help]);
    // An old age button later changes nothing.
    const later: Inbound = {
      ...text("y"),
      body: { kind: "button", id: "age.adult" },
    };
    expect(
      (await processInbound(later, deps())).map((r) => r.text),
    ).not.toEqual([LINES.ageThanks]);
    expect(accounts.ages.get(FROM)).toBe(false);
  });
});
