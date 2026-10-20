// Lives (allowed absences) and the pace label. Pure: no I/O.
import { madridToday } from "./dates";

// Row stubs: the columns these rules read. Switch to src/lib/db/types.ts when PR 2 merges.
export type CourseRow = {
  id: string;
  sessions_typed: number | null;
  sessions_syllabus: number | null;
  sessions_calendar: number | null;
  missed_before: number;
};
export type SkipRow = {
  course_id: string;
  sessions: number;
  skip_date: string;
  planned: boolean;
};

export type Pace =
  "over" | "out" | "last" | "burning" | "safe" | "attendance-safe";

export const DEFAULT_SESSIONS = 30;

// Source order: typed > syllabus > calendar > 30. Estimated when none is set.
export function sessionsFor(c: CourseRow): {
  sessions: number;
  estimated: boolean;
} {
  const known = c.sessions_typed ?? c.sessions_syllabus ?? c.sessions_calendar;
  return known == null
    ? { sessions: DEFAULT_SESSIONS, estimated: true }
    : { sessions: known, estimated: false };
}

// The 80% rule: a student may miss 20% of sessions, rounded down.
export function livesFor(sessions: number): number {
  return Math.floor(sessions * 0.2);
}

// A planned skip whose day has come counts as a normal skip. A double class
// costs 2. Missed-before sessions are used lives. `left` can go below 0.
export function livesLeft(
  c: CourseRow,
  skips: SkipRow[],
  today: string = madridToday(),
): { left: number; planned: number; used: number } {
  let used = c.missed_before;
  let planned = 0;
  for (const s of skips) {
    if (s.course_id !== c.id) continue;
    if (s.planned && s.skip_date > today) planned += s.sessions;
    else used += s.sessions;
  }
  const lives = livesFor(sessionsFor(c).sessions);
  return { left: lives - used - planned, planned, used };
}

export type PaceInput = {
  left: number;
  lives: number;
  skipsLast4Weeks: number;
  weekOfTerm: number;
  weeksToGo: number;
  remainingClasses?: number;
};

// First match wins: over, attendance safe (missing every class still left keeps
// you within the limit), out, last, burning, safe. Burning fast only from week 4:
// 2+ skips in the last 4 weeks, or only 2 left with more than 4 weeks to go.
export function paceLabel(i: PaceInput): Pace {
  if (i.left < 0) return "over";
  if (i.remainingClasses !== undefined && i.remainingClasses <= i.left)
    return "attendance-safe";
  if (i.left === 0) return "out";
  if (i.left === 1) return "last";
  if (
    i.weekOfTerm >= 4 &&
    (i.skipsLast4Weeks >= 2 || (i.left === 2 && i.weeksToGo > 4))
  )
    return "burning";
  return "safe";
}
