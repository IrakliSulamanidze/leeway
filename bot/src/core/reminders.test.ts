import { describe, expect, it } from "vitest";
import { sampleSnapshot } from "../adapters/memory-student";
import { cleanParam, reminderFor } from "./reminders";

// The sample student: Statistics II is on its last life and has a quiz three
// days after the snapshot's date; classes every weekday.
const at = (iso: string) => new Date(iso);

describe("evening heads-up", () => {
  it("names tomorrow's risky class, in the web's own words", () => {
    const now = at("2026-10-26T19:00:00Z"); // Monday evening
    const r = reminderFor(sampleSnapshot(now), now, false)!;
    expect(r.kind).toBe("evening");
    expect(r.text).toBe(
      "Heads-up for tomorrow:\nTomorrow 11:00 Statistics II. Last life, don't skip.",
    );
    expect(r.template).toEqual({
      name: "leeway_evening",
      params: ["Tomorrow 11:00 Statistics II. Last life, don't skip."],
    });
  });

  it("calls out a test the next day", () => {
    const snapAt = at("2026-10-26T09:00:00Z");
    const r = reminderFor(
      sampleSnapshot(snapAt),
      at("2026-10-28T19:00:00Z"),
      false,
    )!;
    expect(r.text).toContain(
      "Tomorrow 11:00 Statistics II. Test day, don't skip.",
    );
  });

  it("shows counts only when the student hides details", () => {
    const now = at("2026-10-26T19:00:00Z");
    const r = reminderFor(sampleSnapshot(now), now, true)!;
    expect(r.text).toBe(
      'Heads-up for tomorrow: 1 thing to check. Send "tomorrow" for details.',
    );
    expect(r.text).not.toContain("Statistics");
    expect(r.template.name).toBe("leeway_evening_private");
  });

  it("sends nothing when tomorrow holds no risk", () => {
    const now = at("2026-10-26T19:00:00Z");
    const snap = sampleSnapshot(now);
    snap.courses = snap.courses.map((c) => ({ ...c, missed_before: 0 }));
    snap.assessments = [];
    expect(reminderFor(snap, now, false)).toBeNull();
  });
});

describe("Sunday look-ahead", () => {
  it("lists the week's tests and the courses to watch", () => {
    const now = at("2026-11-01T18:00:00Z"); // Sunday
    const r = reminderFor(sampleSnapshot(now), now, false)!;
    expect(r.kind).toBe("weekly");
    expect(r.text).toBe(
      "Your week, Mon 2 Nov to Sun 8 Nov:\nStatistics II Quiz, Wed 4 Nov\nStatistics II: last life",
    );
    expect(r.template.params).toEqual([
      "Mon 2 Nov to Sun 8 Nov",
      "Statistics II Quiz, Wed 4 Nov · Statistics II: last life",
    ]);
    expect(r.template.params.join("")).not.toMatch(/\n/);
  });

  it("gives counts only when details are hidden", () => {
    const now = at("2026-11-01T18:00:00Z");
    const r = reminderFor(sampleSnapshot(now), now, true)!;
    expect(r.text).toBe(
      'Your week, Mon 2 Nov to Sun 8 Nov: 1 test, 1 course to watch. Send "this week" for details.',
    );
  });
});

describe("template values", () => {
  it("never carry line breaks, tabs or long runs of spaces, and stay short", () => {
    expect(cleanParam("Stats\tII\n\nQuiz      Wed")).toBe("Stats II Quiz Wed");
    expect(cleanParam("x".repeat(1000)).length).toBe(400);
  });
});

describe("Sunday without anything to flag", () => {
  it("falls back to tomorrow's heads-up", () => {
    const now = at("2026-11-01T18:00:00Z");
    const snap = sampleSnapshot(now);
    snap.assessments = [];
    snap.courses = snap.courses.map((c) => ({ ...c, missed_before: 0 }));
    const monday = snap.sessions.find((s) =>
      s.starts_at.startsWith("2026-11-02"),
    )!;
    snap.skips.push({
      id: "k1",
      course_id: monday.course_id,
      class_session_id: monday.id,
      skip_date: "2026-11-02",
      sessions: 1,
      planned: true,
    });
    const r = reminderFor(snap, now, false)!;
    expect(r.kind).toBe("evening");
    expect(r.text).toContain("You planned to skip");
  });
});
