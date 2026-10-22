import { beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "../../adapters/clock";
import { ScriptedReader } from "../../adapters/memory-reader";
import { MemorySharing } from "../../adapters/memory-sharing";
import { MemoryStudent, sampleSnapshot } from "../../adapters/memory-student";
import { handle } from "../pipeline";
import type { Inbound } from "../types";

const NOW = "2026-10-26T09:00:00Z";
let sharing: MemorySharing;
const deps = () => ({
  clock: fixedClock(NOW),
  student: new MemoryStudent(sampleSnapshot(new Date(NOW))),
  reader: new ScriptedReader(),
  sharing,
  newCode: () => "K7Q2M9XZ",
});
const send = (body: Inbound["body"]) =>
  handle({ id: "w", from: "ES.a", at: new Date(NOW), body }, deps());
const say = (text: string) => send({ kind: "text", text });

beforeEach(() => {
  sharing = new MemorySharing();
});

describe("share", () => {
  it("gives a code to pass to one classmate", async () => {
    const [r] = await say("share");
    expect(r.text).toContain("share K7Q2M9XZ");
    expect(sharing.codes).toEqual(["K7Q2M9XZ"]);
  });

  it("shows the classmate exactly what would be shared, with three choices", async () => {
    sharing.preview_ = { outcome: "ok", courses: ["Statistics II"] };
    const [r] = await say("share k7q2m9xz");
    expect(r.text).toContain("courses you both take: Statistics II.");
    expect(r.text).toContain("Never your timetable, absences, skips or notes, and no course you add later.");
    expect(r.buttons?.map((b) => b.id)).toEqual([
      "share.allow:K7Q2M9XZ",
      "share.not_now:K7Q2M9XZ",
      "share.block:K7Q2M9XZ",
    ]);
  });

  it("records the answer the classmate taps", async () => {
    const [r] = await send({ kind: "button", id: "share.allow:K7Q2M9XZ" });
    expect(r.text).toMatch(/^Done. They'll see your test dates/);
    expect(sharing.answers).toEqual(["K7Q2M9XZ:allow"]);
  });

  it("stays closed until sharing in chat is switched on", async () => {
    sharing.preview_ = { outcome: "closed" };
    expect((await say("share k7q2m9xz"))[0].text).toMatch(/isn't open yet/);
  });

  it("says nothing about the asker for a used or blocked code", async () => {
    sharing.preview_ = { outcome: "expired" };
    expect((await say("share k7q2m9xz"))[0].text).toBe(
      "That code has expired or was already used.",
    );
  });
});

describe("tests with classmates' dates", () => {
  const stats = "00000000-0000-4000-a000-000000000002";
  const micro = "00000000-0000-4000-a000-000000000001";

  it("adds classmates' tests by date, keeps one classmate's repeats apart, and shows disagreement", async () => {
    sharing.shared = [
      { courseId: stats, title: "Quiz", onDate: "2026-10-29", source: 1 }, // the student has this one
      { courseId: micro, title: "Midterm", onDate: "2026-11-04", source: 1 },
      { courseId: micro, title: "Midterm", onDate: "2026-11-05", source: 2 },
      { courseId: stats, title: "Lab", onDate: "2026-11-02", source: 1 },
      { courseId: stats, title: "Lab", onDate: "2026-11-09", source: 1 },
    ];
    const [r] = await say("tests");
    expect(r.text).toBe(
      [
        "Tests in the next three weeks:",
        "Thu 29 Oct · Statistics II · Quiz",
        "Mon 2 Nov · Statistics II · Lab (from a classmate)",
        "Microeconomics · Midterm: classmates say Wed 4 Nov or Thu 5 Nov",
        "Mon 9 Nov · Statistics II · Lab (from a classmate)",
      ].join("\n"),
    );
  });

  it("says classmates agree when they do", async () => {
    sharing.shared = [
      { courseId: micro, title: "Midterm", onDate: "2026-11-04", source: 1 },
      { courseId: micro, title: "Midterm", onDate: "2026-11-04", source: 2 },
    ];
    const [r] = await say("tests");
    expect(r.text).toContain(
      "Wed 4 Nov · Microeconomics · Midterm (from classmates)",
    );
  });
});
