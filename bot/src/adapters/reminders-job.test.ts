import { beforeEach, describe, expect, it } from "vitest";
import type { Reply } from "../core/types";
import { MetaSendError } from "./meta/cloud-api";
import { MemoryAccounts } from "./memory-accounts";
import { MemoryStudent, sampleSnapshot } from "./memory-student";
import { type ReminderJobDeps, runReminders } from "./reminders-job";

const NOW = new Date("2026-10-26T19:00:00Z");
const HOUR = 60 * 60 * 1000;
let texts: { to: string; reply: Reply }[];
let templates: { to: string; name: string }[];
let claimed: Set<string>;
let unclaimed: string[];

const deps = (over: Partial<ReminderJobDeps> = {}): ReminderJobDeps => ({
  now: NOW,
  targets: async () => [
    { waId: "ES.recent", lastSeenAt: new Date(NOW.getTime() - 2 * HOUR) },
    { waId: "ES.quiet", lastSeenAt: new Date(NOW.getTime() - 48 * HOUR) },
  ],
  optedOut: async () => false,
  claim: async (waId) =>
    claimed.has(waId) ? false : (claimed.add(waId), true),
  unclaim: async (waId) => void (unclaimed.push(waId), claimed.delete(waId)),
  student: new MemoryStudent(sampleSnapshot(NOW)),
  accounts: new MemoryAccounts(true),
  messenger: {
    send: async (to, reply) => void texts.push({ to, reply }),
    sendTemplate: async (to, name) => void templates.push({ to, name }),
  },
  templatesReady: true,
  ...over,
});

beforeEach(() => {
  texts = [];
  templates = [];
  claimed = new Set();
  unclaimed = [];
});

describe("runReminders", () => {
  it("sends plain text inside the 24-hour window and a template outside it", async () => {
    const r = await runReminders(deps());
    expect(r).toEqual({
      sent: 2,
      nothing: 0,
      skipped: 0,
      failed: 0,
      notReached: 0,
    });
    expect(texts.map((t) => t.to)).toEqual(["ES.recent"]);
    expect(templates).toEqual([{ to: "ES.quiet", name: "leeway_evening" }]);
  });

  it("only reaches students inside the window until Meta approves the templates", async () => {
    const r = await runReminders(deps({ templatesReady: false }));
    expect(r.sent).toBe(1);
    expect(templates).toEqual([]);
  });

  it("skips students who sent STOP", async () => {
    const r = await runReminders(
      deps({ optedOut: async (id) => id === "ES.quiet" }),
    );
    expect(r.skipped).toBe(1);
    expect(templates).toEqual([]);
  });

  it("sends once a day even if the job runs twice", async () => {
    await runReminders(deps());
    const again = await runReminders(deps());
    expect(again.sent).toBe(0);
    expect(texts.length + templates.length).toBe(2);
  });

  it("keeps going when one student fails", async () => {
    const d = deps();
    const real = d.student.snapshot.bind(d.student);
    d.student = {
      ...d.student,
      snapshot: async (s, r) =>
        s === "ES.recent" ? Promise.reject(new Error("x")) : real(s, r),
    };
    const r = await runReminders(d);
    expect(r).toMatchObject({ sent: 1, failed: 1 });
  });

  it("sends nothing in quiet hours, whoever calls", async () => {
    const r = await runReminders(
      deps({ now: new Date("2026-10-26T22:00:00Z") }),
    ); // 23:00 Madrid
    expect(r.sent).toBe(0);
    expect(texts.length + templates.length).toBe(0);
  });

  it("gives the day back when Meta refuses the message outright", async () => {
    const d = deps();
    d.messenger = {
      send: async () => Promise.reject(new MetaSendError(400, 131047)),
      sendTemplate: async () => undefined,
    };
    const r = await runReminders(d);
    expect(r.failed).toBe(1);
    expect(unclaimed).toEqual(["ES.recent"]);
  });

  it("stops starting students when time runs out, and says how many", async () => {
    const r = await runReminders(deps({ elapsed: () => 50_000 }));
    expect(r).toMatchObject({ sent: 0, notReached: 2 });
  });
});
