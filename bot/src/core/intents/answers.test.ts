import { beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "../../adapters/clock";
import { MemoryStudent, sampleSnapshot } from "../../adapters/memory-student";
import { handle } from "../pipeline";
import type { Inbound, Reply } from "../types";

// Monday 26 Oct 2026, 10:00 in Madrid. The sample student has Microeconomics
// (3 of 6 lives left), Statistics II (1 left) and Financial Reporting (6 left),
// classes every weekday, and a Statistics II quiz on Thursday.
const NOW = "2026-10-26T09:00:00Z";
let student: MemoryStudent;
let seq = 0;
const deps = () => ({ clock: fixedClock(NOW), student });
const send = (body: Inbound["body"]): Promise<Reply[]> =>
  handle(
    { id: `wamid.${++seq}`, from: "ES.a", at: new Date(NOW), body },
    deps(),
  );
const say = (text: string) => send({ kind: "text", text });
const tap = (id: string) => send({ kind: "button", id });

beforeEach(() => {
  student = new MemoryStudent(sampleSnapshot(new Date(NOW)));
});

describe("lives", () => {
  it("lists every course, the one closest to the limit first", async () => {
    const [r] = await say("my lives");
    expect(r.text).toBe(
      "Your lives:\nStatistics II: 1 of 6 left, last one\nMicroeconomics: 3 of 6 left\nFinancial Reporting: 6 of 6 left",
    );
  });
});

describe("week", () => {
  it("gives tomorrow's cost with the web app's verdict", async () => {
    const [r] = await say("tomorrow");
    expect(r.text).toMatch(
      /^Tomorrow: You'd miss 3 classes\. Statistics II would be out of lives\./,
    );
    expect(r.text).toContain("Tue 27 · Microeconomics");
  });

  it("flags the quiz in this week's list", async () => {
    const [r] = await say("this week");
    expect(r.text).toContain("Thu 29 · Statistics II, Quiz");
  });
});

describe("tests", () => {
  it("lists tests in the next three weeks", async () => {
    const [r] = await say("tests");
    expect(r.text).toBe(
      "Tests in the next three weeks:\nThu 29 Oct · Statistics II · Quiz",
    );
  });
});

describe("skipped", () => {
  it("saves today's skip at once when it is safe, with an undo button", async () => {
    const [r] = await say("skipped micro");
    expect(r.text).toBe(
      "Saved: Microeconomics, Mon 26 Oct. 2 lives left in Microeconomics.",
    );
    expect(student.data.skips).toHaveLength(1);
    const [undone] = await tap(r.buttons![0].id);
    expect(undone.text).toBe("Undone.");
    expect(student.data.skips).toHaveLength(0);
  });

  it("asks first before using a course's last life", async () => {
    const [ask] = await say("skipped statistics");
    expect(ask.text).toBe(
      "Statistics II, Mon 26 Oct: this uses your last life. Save the skip anyway?",
    );
    expect(student.data.skips).toHaveLength(0);
    const [saved] = await tap(ask.buttons![0].id);
    expect(saved.text).toBe(
      "Saved: Statistics II, Mon 26 Oct. 0 lives left in Statistics II.",
    );
    const [again] = await tap(ask.buttons![0].id);
    expect(again.text).toBe("Already saved: Statistics II, Mon 26 Oct.");
  });

  it("plans tomorrow's skip", async () => {
    const [r] = await say("skipping financial reporting tomorrow");
    expect(r.text).toBe(
      "Saved: Financial Reporting, Tue 27 Oct. 5 lives left in Financial Reporting.",
    );
    expect(student.data.skips[0]).toMatchObject({
      skip_date: "2026-10-27",
      planned: true,
    });
  });

  it("saves once per message even if the request runs twice", async () => {
    const msg: Inbound = {
      id: "wamid.same",
      from: "ES.a",
      at: new Date(NOW),
      body: { kind: "text", text: "skipped micro" },
    };
    await handle(msg, deps());
    await handle(msg, deps());
    expect(student.data.skips).toHaveLength(1);
  });

  it("says when a course is not found, without repeating what was typed", async () => {
    const [r] = await say("skipped underwater basket weaving");
    expect(r.text).toBe(
      "I couldn't find that course. Yours are: Financial Reporting, Microeconomics, Statistics II.",
    );
  });

  it("refuses buttons for other days or other students' courses", async () => {
    const [r] = await tap(
      "skip.yes:00000000-0000-4000-a000-000000000001:-:2026-10-20",
    );
    expect(r.text).toBe("That button has expired.");
    const [s] = await tap(
      "skip.yes:11111111-1111-4111-a111-111111111111:-:2026-10-26",
    );
    expect(s.text).toBe("That button has expired.");
  });
});
