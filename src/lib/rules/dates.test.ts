import { describe, expect, it } from "vitest";
import { TERM } from "@/lib/config";
import {
  madridToday,
  madridTomorrow,
  termDates,
  weekOfTerm,
  weeksToGo,
  zonedToUtc,
} from "./dates";

const at = (iso: string) => new Date(iso);

describe("madridToday / madridTomorrow", () => {
  it("rolls over at 22:00 UTC in summer time (UTC+2)", () => {
    expect(madridToday(at("2026-10-20T21:59:00Z"))).toBe("2026-10-20");
    expect(madridToday(at("2026-10-20T23:30:00Z"))).toBe("2026-10-21");
    expect(madridTomorrow(at("2026-10-20T23:30:00Z"))).toBe("2026-10-22");
  });
  it("rolls over at 23:00 UTC in winter time (UTC+1)", () => {
    expect(madridToday(at("2026-11-10T22:59:00Z"))).toBe("2026-11-10");
    expect(madridToday(at("2026-11-10T23:30:00Z"))).toBe("2026-11-11");
  });
  it("handles the night clocks go back, 25 Oct 2026", () => {
    expect(madridToday(at("2026-10-24T23:30:00Z"))).toBe("2026-10-25");
    expect(madridTomorrow(at("2026-10-24T23:30:00Z"))).toBe("2026-10-26");
    expect(madridToday(at("2026-10-25T22:59:00Z"))).toBe("2026-10-25");
    expect(madridToday(at("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });
  it("handles the night clocks go forward, 28 Mar 2027", () => {
    expect(madridToday(at("2027-03-27T23:30:00Z"))).toBe("2027-03-28");
    expect(madridToday(at("2027-03-28T21:59:00Z"))).toBe("2027-03-28");
    expect(madridToday(at("2027-03-28T23:30:00Z"))).toBe("2027-03-29");
  });
  it("crosses month and year ends", () => {
    expect(madridTomorrow(at("2026-12-31T12:00:00Z"))).toBe("2027-01-01");
  });
});

describe("zonedToUtc", () => {
  it("maps Madrid wall time to UTC in summer and winter", () => {
    expect(zonedToUtc("2026-10-20T09:00", "Europe/Madrid").toISOString()).toBe(
      "2026-10-20T07:00:00.000Z",
    );
    expect(zonedToUtc("2026-11-02T09:00", "Europe/Madrid").toISOString()).toBe(
      "2026-11-02T08:00:00.000Z",
    );
  });
  it("is right on both clock-change days", () => {
    expect(zonedToUtc("2026-10-25T10:00", "Europe/Madrid").toISOString()).toBe(
      "2026-10-25T09:00:00.000Z",
    );
    expect(zonedToUtc("2027-03-28T10:00", "Europe/Madrid").toISOString()).toBe(
      "2027-03-28T08:00:00.000Z",
    );
  });
  it("moves a skipped time forward and takes the first of a repeated time", () => {
    expect(zonedToUtc("2027-03-28T02:30", "Europe/Madrid").toISOString()).toBe(
      "2027-03-28T01:30:00.000Z",
    );
    expect(zonedToUtc("2026-10-25T02:30", "Europe/Madrid").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });
  it("works for other zones and rejects bad input", () => {
    expect(
      zonedToUtc("2026-10-20T09:00:00", "America/New_York").toISOString(),
    ).toBe("2026-10-20T13:00:00.000Z");
    expect(() => zonedToUtc("20 Oct", "Europe/Madrid")).toThrow();
  });
});

describe("weeksToGo / weekOfTerm", () => {
  it("matches the mockup on 20 Oct: week 7 of 15, 8 weeks to go", () => {
    expect(weekOfTerm("2026-10-20", TERM.start)).toBe(7);
    expect(weekOfTerm(TERM.end, TERM.start)).toBe(15);
    expect(weeksToGo("2026-10-20", TERM.end)).toBe(8);
  });
  it("is 0 in the last week, on the last day and after the term", () => {
    expect(weeksToGo("2026-12-14", TERM.end)).toBe(0);
    expect(weeksToGo(TERM.end, TERM.end)).toBe(0);
    expect(weeksToGo("2026-12-19", TERM.end)).toBe(0);
    expect(weeksToGo("2027-02-01", TERM.end)).toBe(0);
  });
  it("counts week 1 from the first day and 0 before it", () => {
    expect(weekOfTerm("2026-09-07", TERM.start)).toBe(1);
    expect(weekOfTerm("2026-09-14", TERM.start)).toBe(2);
    expect(weekOfTerm("2026-09-01", TERM.start)).toBe(0);
  });
});

describe("termDates", () => {
  it("falls back to the fall 2026 term", () => {
    expect(termDates([])).toEqual({ start: "2026-09-07", end: "2026-12-18" });
  });
  it("uses the first and last Madrid date of the sessions", () => {
    const sessions = [
      { starts_at: "2026-12-17T23:30:00Z" }, // 18 Dec in Madrid
      { starts_at: "2026-09-08T08:00:00Z" },
      { starts_at: "2026-10-01T08:00:00Z" },
    ];
    expect(termDates(sessions)).toEqual({
      start: "2026-09-08",
      end: "2026-12-18",
    });
  });
});
