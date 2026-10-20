import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFeed, resolveZone } from "./parse";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "__fixtures__", name), "utf8");
const ALL = {
  from: new Date("2026-01-01T00:00:00Z"),
  to: new Date("2028-01-01T00:00:00Z"),
};

describe("parseFeed on the IE public fixture", () => {
  const events = parseFeed(fixture("ie-public.ics"), ALL);

  it("reads all 196 events with unique UIDs", () => {
    expect(events).toHaveLength(196);
    expect(new Set(events.map((e) => e.uid)).size).toBe(196);
  });

  it("reads TZID=Europe/Madrid times without a VTIMEZONE", () => {
    const e = events.find(
      (x) => x.uid === "F439563PLANI3530829P7468C782554S150631A175954",
    )!;
    expect(e.start.toISOString()).toBe("2026-04-27T12:00:00.000Z");
    expect(e.end.toISOString()).toBe("2026-04-27T13:20:00.000Z");
    expect(e.allDay).toBe(false);
    expect(e.summary).toBe("COURSE ALPHA    (Ses. 27) SB-787");
    expect(e.location).toBe("SB-787");
  });

  it("treats a bare date with a TZID as an all-day Madrid date (async sessions)", () => {
    const async = events.filter((e) => e.location === "Asynchronous");
    expect(async).toHaveLength(14);
    expect(async.every((e) => e.allDay)).toBe(true);
    const first = async[0];
    expect(first.start.toISOString()).toBe("2026-09-08T22:00:00.000Z");
    expect(first.end.toISOString()).toBe("2026-09-09T22:00:00.000Z");
  });

  it("keeps Madrid wall times right across the 25 Oct clock change", () => {
    const at = (prefix: string) =>
      events.find((e) => e.summary.startsWith(prefix))!.start.toISOString();
    // Fri 23 Oct 18:00 CEST (+2) and Mon 26 Oct 15:00 CET (+1).
    expect(
      events
        .find((e) => e.summary.startsWith("COURSE ROMEO    (Ses. 2)"))!
        .start.toISOString(),
    ).toBe("2026-10-23T16:00:00.000Z");
    expect(at("COURSE KILO    (Ses. 18)")).toBe("2026-10-26T14:00:00.000Z");
    // An all-day async date after the change starts at Madrid midnight, +1.
    expect(at("COURSE NOVEMBER    (Ses. 20)")).toBe("2026-10-29T23:00:00.000Z");
  });

  it("filters to the range by overlap", () => {
    const fall = parseFeed(fixture("ie-public.ics"), {
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2027-01-01T00:00:00Z"),
    });
    expect(fall.length).toBeLessThan(196);
    expect(fall.every((e) => e.start >= new Date("2026-08-31T00:00:00Z"))).toBe(
      true,
    );
  });

  it("refuses text that is not a calendar", () => {
    expect(() => parseFeed("<html></html>", ALL)).toThrow();
  });
});

describe("parseFeed on a Google-style recurring calendar", () => {
  const events = parseFeed(fixture("google-recurring.ics"), ALL);
  const micro = events.filter(
    (e) => e.uid === "synthetic-micro-series@example.com",
  );

  it("expands RRULE, drops EXDATE and cancelled instances, applies RECURRENCE-ID moves", () => {
    // COUNT=6 on Mon/Wed from 19 Oct: 19, 21, 26, 28 Oct, 2, 4 Nov. 21 is an EXDATE,
    // 28 is cancelled, 26 is moved to 12:00.
    expect(micro.map((e) => e.originalStart.toISOString())).toEqual([
      "2026-10-19T08:00:00.000Z",
      "2026-10-26T09:00:00.000Z",
      "2026-11-02T09:00:00.000Z",
      "2026-11-04T09:00:00.000Z",
    ]);
    const moved = micro[1];
    expect(moved.start.toISOString()).toBe("2026-10-26T11:00:00.000Z");
    expect(moved.end.toISOString()).toBe("2026-10-26T12:20:00.000Z");
    expect(moved.summary).toBe("Microeconomics (moved)");
    expect(moved.location).toBe("Room 2");
    // 10:00 Madrid on both sides of the clock change.
    expect(micro[2].start.toISOString()).toBe("2026-11-02T09:00:00.000Z");
    expect(micro[0].end.getTime() - micro[0].start.getTime()).toBe(80 * 60_000);
  });

  it("reads VALUE=DATE all-day events, UTC times and escaped text", () => {
    const day = events.find((e) => e.uid === "synthetic-holiday@example.com")!;
    expect(day.allDay).toBe(true);
    expect(day.start.toISOString()).toBe("2026-10-29T23:00:00.000Z");
    const dentist = events.find(
      (e) => e.uid === "synthetic-dentist@example.com",
    )!;
    expect(dentist.start.toISOString()).toBe("2026-11-02T09:00:00.000Z");
    expect(dentist.summary).toBe("Dentist, then lunch");
  });
});

describe("parseFeed on an Outlook calendar with Windows zone names", () => {
  const events = parseFeed(fixture("outlook-windows-tz.ics"), ALL);

  it("maps Romance Standard Time and expands a weekly rule up to UNTIL", () => {
    const lectures = events.filter((e) => e.summary === "Statistics lecture");
    expect(lectures.map((e) => e.start.toISOString())).toEqual([
      "2026-10-22T07:00:00.000Z",
      "2026-10-29T08:00:00.000Z",
      "2026-11-05T08:00:00.000Z",
    ]);
    const midterm = events.find((e) => e.summary === "Statistics midterm")!;
    expect(midterm.start.toISOString()).toBe("2026-11-12T15:00:00.000Z");
  });

  it("resolves zone names", () => {
    expect(resolveZone("Romance Standard Time")).toBe("Europe/Paris");
    expect(resolveZone('"W. Europe Standard Time"')).toBe("Europe/Berlin");
    expect(resolveZone("/mozilla.org/20070129_1/Europe/Madrid")).toBe(
      "Europe/Madrid",
    );
    expect(resolveZone("Something Unknown")).toBe("Europe/Madrid");
    expect(resolveZone(undefined)).toBe("Europe/Madrid");
  });
});
