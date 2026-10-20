import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyIE,
  classifyOther,
  cleanTitle,
  isIEFeed,
  sessionNumbers,
} from "./classify-ie";
import { parseFeed, type ParsedEvent } from "./parse";

const events = parseFeed(
  readFileSync(join(__dirname, "__fixtures__", "ie-public.ics"), "utf8"),
  {
    from: new Date("2026-01-01T00:00:00Z"),
    to: new Date("2028-01-01T00:00:00Z"),
  },
);
const classified = events.map((e) => ({ e, c: classifyIE(e)! }));

function course(title: string) {
  const rows = classified.filter(
    ({ c }) => c.title === title && c.kind !== "exam",
  );
  const numbers = new Set(
    rows
      .filter(({ c }) => c.kind === "class" || c.kind === "async")
      .flatMap(({ c }) => c.sessionNumbers),
  );
  return {
    rows,
    key: rows[0].c.courseKey,
    distinct: numbers.size,
    max: Math.max(...numbers),
  };
}

describe("classifyIE on the public fixture", () => {
  it("finds the kinds from spike S1", () => {
    const counts: Record<string, number> = {};
    for (const { c } of classified) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
    expect(counts).toEqual({ class: 169, async: 14, extra: 10, exam: 3 });
    expect(isIEFeed(events)).toBe(true);
  });

  it("uses the UID course part as the course key, one key per course", () => {
    const keys = new Map<string, Set<string>>();
    for (const { c } of classified.filter(({ c }) => c.kind !== "exam"))
      keys.set(c.title, (keys.get(c.title) ?? new Set()).add(c.courseKey!));
    for (const set of keys.values()) expect(set.size).toBe(1);
    expect(keys.size).toBe(18);
    expect(course("COURSE ALPHA").key).toBe("ie:P7468C782554S150631");
  });

  it("counts distinct session numbers, ranges expanded, gaps not filled", () => {
    expect(course("COURSE KILO").distinct).toBe(30);
    expect(course("COURSE LIMA").distinct).toBe(30);
    // The one with gaps at 10, 20 and 30: 30 numbers, not 33.
    expect(course("COURSE QUEBEC")).toMatchObject({ distinct: 30, max: 33 });
    expect(course("COURSE OSCAR").distinct).toBe(25);
    expect(course("COURSE MIKE").distinct).toBe(25);
    expect(course("COURSE PAPA").distinct).toBe(30);
    expect(course("COURSE NOVEMBER").distinct).toBe(30);
  });

  it("expands doubles and the triple 12-14, including messy '| | , null' titles", () => {
    const triple = classified.find(({ c }) => c.sessionNumbers.length === 3)!;
    expect(triple.c).toMatchObject({
      title: "COURSE NOVEMBER",
      sessionNumbers: [12, 13, 14],
    });
    expect(triple.e.end.getTime() - triple.e.start.getTime()).toBe(
      (4 * 60 + 20) * 60_000,
    );
    const messy = classified.find(({ e }) => e.summary.includes(", null"))!;
    expect(messy.c).toMatchObject({
      kind: "class",
      title: "COURSE MIKE",
      sessionNumbers: [9, 10],
    });
    expect(
      classified.filter(({ c }) => c.sessionNumbers.length === 2).length,
    ).toBeGreaterThan(20);
  });

  it("links each exam to its course by UID, and the exam covers the course's last session", () => {
    const exams = classified.filter(({ c }) => c.kind === "exam");
    expect(exams.map(({ c }) => c.title).sort()).toEqual([
      "Course Mike",
      "Course Oscar",
      "Course Papa",
    ]);
    for (const exam of exams) {
      const c = course(exam.c.title.toUpperCase());
      expect(exam.c.courseKey).toBe(c.key);
      // The slot: a class of the same course starting 30 minutes after the exam, inside it.
      const slot = c.rows.find(
        ({ e }) =>
          e.start.getTime() === exam.e.start.getTime() + 30 * 60_000 &&
          e.end.getTime() <= exam.e.end.getTime(),
      )!;
      expect(slot.c.sessionNumbers).toEqual([c.max]);
      expect(slot.e.location).toBe("IE TOWER");
    }
  });

  it("reads async sessions and extras", () => {
    const async = classified.find(({ c }) => c.kind === "async")!;
    expect(async.c.sessionNumbers).toHaveLength(1);
    const extra = classified.find(({ c }) => c.kind === "extra")!;
    expect(extra.c.sessionNumbers).toEqual([]);
    expect(extra.c.title).toMatch(/^COURSE [A-Z]+$/);
  });
});

const ev = (uid: string, summary: string, location = ""): ParsedEvent => ({
  uid,
  summary,
  location,
  start: new Date(0),
  end: new Date(0),
  originalStart: new Date(0),
  allDay: false,
});

describe("classify edge cases", () => {
  it("drops the meta event and keeps Blackboard items as course-less deadlines", () => {
    expect(
      classifyIE(ev("20_10_2026_14_56_00", "**Last Update (IE Calendar)**")),
    ).toBeNull();
    expect(
      classifyIE(ev("1234567", "COURSE X   Quiz 1A - Session 6")),
    ).toMatchObject({
      kind: "deadline",
      courseKey: null,
    });
  });

  it("parses session ranges and rejects nonsense", () => {
    expect(sessionNumbers("A | | , null (Ses. 9-10) T-1")).toEqual([9, 10]);
    expect(sessionNumbers("A (Ses.4) T-1")).toEqual([4]);
    expect(sessionNumbers("A (Ses. 5-3)")).toEqual([]);
    expect(sessionNumbers("A (Ses. 1-999)")).toEqual([]);
    expect(sessionNumbers("A")).toEqual([]);
  });

  it("cleans titles", () => {
    expect(cleanTitle("COURSE MIKE   | | , null (Ses. 9-10) T-79.38")).toBe(
      "COURSE MIKE",
    );
    expect(cleanTitle("COURSE ALPHA   Extra SB-075")).toBe("COURSE ALPHA");
    expect(cleanTitle("  X SEP-2026C-N.3.M.A: EXAM: Course Papa T-1|T-2")).toBe(
      "Course Papa",
    );
  });

  it("other feeds key courses by cleaned title, ignoring case and accents", () => {
    const a = classifyOther(ev("g1", "Microeconomía (Ses. 3)"));
    const b = classifyOther(ev("g2", "MICROECONOMIA"));
    expect(a.courseKey).toBe(b.courseKey);
    expect(a).toMatchObject({ kind: "class", sessionNumbers: [3] });
    expect(isIEFeed([ev("g1", "x")])).toBe(false);
  });
});
