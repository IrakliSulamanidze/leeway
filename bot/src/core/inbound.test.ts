import { beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "../adapters/clock";
import { MemoryAccounts } from "../adapters/memory-accounts";
import { MemoryGate } from "../adapters/memory-gate";
import { MemoryStudent, sampleSnapshot } from "../adapters/memory-student";
import { ScriptedReader } from "../adapters/memory-reader";
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
  student: new MemoryStudent(sampleSnapshot(new Date("2026-10-26T09:00:00Z"))),
  reader: new ScriptedReader(),
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
  accounts.voices.set(FROM, "straight");
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

  it("asks the age, then the voice, once each, then answers normally", async () => {
    accounts.ages.clear();
    accounts.voices.clear();
    const tap = (id: string): Inbound => ({
      ...text(id),
      body: { kind: "button", id },
    });
    const [age] = await processInbound(text("help"), deps());
    expect(age.text).toBe(LINES.askAge);
    expect(age.buttons?.map((b) => b.id)).toEqual(["age.adult", "age.minor"]);
    const [voice] = await processInbound(tap("age.minor"), deps());
    expect(voice.text).toBe(LINES.askVoice);
    expect(accounts.ages.get(FROM)).toBe(false);
    expect((await processInbound(tap("voice.friendly"), deps()))[0].text).toBe(
      LINES.voiceSet,
    );
    expect(accounts.voices.get(FROM)).toBe("friendly");
    // An old age button later changes nothing.
    await processInbound(tap("age.adult"), deps());
    expect(accounts.ages.get(FROM)).toBe(false);
    // "voice" asks again.
    expect(await replyTo("voice")).toEqual([LINES.askVoice]);
  });

  it("answers in Straight while no voice is picked, without asking again", async () => {
    accounts.voices.clear();
    expect(await replyTo("help")).toEqual([LINES.help]);
  });

  it("ignores button ids that only look like answers", async () => {
    accounts.ages.clear();
    const odd: Inbound = {
      ...text("odd"),
      body: { kind: "button", id: "toString" },
    };
    expect((await processInbound(odd, deps()))[0].text).toBe(LINES.askAge);
    expect(accounts.ages.has(FROM)).toBe(false);
  });

  it("adds a friendly line before the facts, and none for straight", async () => {
    accounts.voices.set(FROM, "friendly");
    const [friendly] = await processInbound(text("lives"), deps());
    expect(friendly.text.split("\n")[1]).toBe("Your lives:");
    expect(friendly).not.toHaveProperty("situation");
    accounts.voices.set(FROM, "straight");
    const [straight] = await processInbound(text("lives"), deps());
    expect(straight.text.startsWith("Your lives:")).toBe(true);
  });
});
