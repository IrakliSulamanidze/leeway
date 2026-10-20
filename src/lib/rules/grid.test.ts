import { describe, expect, it } from "vitest";
import { clock, hourRange, lanes, madridMinutes } from "./grid";

describe("madridMinutes and clock", () => {
  it("reads Madrid time across the October clock change", () => {
    expect(madridMinutes("2026-10-20T13:00:00Z")).toBe(15 * 60);
    expect(clock("2026-10-20T13:00:00Z")).toBe("15:00");
    expect(clock("2026-10-26T14:00:00Z")).toBe("15:00");
  });
});

describe("hourRange", () => {
  it("covers the earliest start and the latest end", () => {
    expect(
      hourRange([
        { id: "a", start: 13 * 60 + 30, end: 14 * 60 + 50 },
        { id: "b", start: 18 * 60, end: 19 * 60 + 20 },
      ]),
    ).toEqual({ from: 13, to: 20 });
  });
  it("falls back to 9 to 18 for an empty week", () => {
    expect(hourRange([])).toEqual({ from: 9, to: 18 });
  });
});

describe("lanes", () => {
  it("puts overlapping classes side by side and others full width", () => {
    const out = lanes([
      { id: "exam", start: 600, end: 750 },
      { id: "slot", start: 630, end: 710 },
      { id: "later", start: 800, end: 880 },
    ]);
    expect(out.get("exam")).toEqual({ lane: 0, lanes: 2 });
    expect(out.get("slot")).toEqual({ lane: 1, lanes: 2 });
    expect(out.get("later")).toEqual({ lane: 0, lanes: 1 });
  });
  it("reuses a lane once it is free", () => {
    const out = lanes([
      { id: "a", start: 0, end: 100 },
      { id: "b", start: 50, end: 200 },
      { id: "c", start: 120, end: 180 },
    ]);
    expect(out.get("c")).toEqual({ lane: 0, lanes: 2 });
  });
});
