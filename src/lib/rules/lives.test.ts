import { describe, expect, it } from "vitest";
import {
  type CourseRow,
  type SkipRow,
  livesFor,
  livesLeft,
  sessionsFor,
} from "./lives";

const course = (over: Partial<CourseRow> = {}): CourseRow => ({
  id: "c1",
  sessions_typed: null,
  sessions_syllabus: null,
  sessions_calendar: null,
  missed_before: 0,
  ...over,
});
const skip = (over: Partial<SkipRow> = {}): SkipRow => ({
  course_id: "c1",
  sessions: 1,
  skip_date: "2026-10-20",
  planned: false,
  ...over,
});
const TODAY = "2026-10-20";

describe("livesFor", () => {
  it("is 20% of sessions, rounded down", () => {
    expect(livesFor(30)).toBe(6);
    expect(livesFor(25)).toBe(5);
    expect(livesFor(15)).toBe(3);
    expect(livesFor(29)).toBe(5);
    expect(livesFor(4)).toBe(0);
  });
});

describe("sessionsFor", () => {
  it("uses typed > syllabus > calendar > 30", () => {
    const all = {
      sessions_typed: 20,
      sessions_syllabus: 25,
      sessions_calendar: 15,
    };
    expect(sessionsFor(course(all)).sessions).toBe(20);
    expect(sessionsFor(course({ ...all, sessions_typed: null })).sessions).toBe(
      25,
    );
    expect(
      sessionsFor(
        course({ ...all, sessions_typed: null, sessions_syllabus: null }),
      ).sessions,
    ).toBe(15);
    expect(sessionsFor(course()).sessions).toBe(30);
  });
  it("flags the 30 default as estimated, and only that", () => {
    expect(sessionsFor(course())).toEqual({ sessions: 30, estimated: true });
    expect(sessionsFor(course({ sessions_calendar: 30 }))).toEqual({
      sessions: 30,
      estimated: false,
    });
  });
});

describe("livesLeft", () => {
  it("starts at all lives", () => {
    expect(livesLeft(course(), [], TODAY)).toEqual({
      left: 6,
      planned: 0,
      used: 0,
    });
  });
  it("counts missed-before sessions as used", () => {
    expect(livesLeft(course({ missed_before: 2 }), [skip()], TODAY)).toEqual({
      left: 3,
      planned: 0,
      used: 3,
    });
  });
  it("counts a double class as 2", () => {
    expect(
      livesLeft(course(), [skip({ sessions: 2 }), skip()], TODAY).used,
    ).toBe(3);
  });
  it("keeps future planned skips apart, and counts them once their day comes", () => {
    const skips = [
      skip({ planned: true, skip_date: "2026-10-21" }),
      skip({ planned: true, skip_date: TODAY }),
      skip({ planned: true, skip_date: "2026-10-19" }),
    ];
    expect(livesLeft(course(), skips, TODAY)).toEqual({
      left: 3,
      planned: 1,
      used: 2,
    });
    expect(livesLeft(course(), skips, "2026-10-21")).toEqual({
      left: 3,
      planned: 0,
      used: 3,
    });
  });
  it("uses the session source for the total and ignores other courses", () => {
    const c = course({ sessions_typed: 15 });
    expect(
      livesLeft(c, [skip(), skip({ course_id: "other" })], TODAY).left,
    ).toBe(2);
  });
  it("goes below 0 when over the limit", () => {
    expect(
      livesLeft(course({ sessions_typed: 15, missed_before: 4 }), [], TODAY)
        .left,
    ).toBe(-1);
  });
});
