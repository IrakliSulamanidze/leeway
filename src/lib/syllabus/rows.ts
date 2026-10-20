// Turns one syllabus read into review lines, the lines into the rows the confirm
// action writes, and diffs them against the rows already saved (re-import).
// Pure: no I/O.
import { z } from "zod";
import { MAX_SESSIONS, type SyllabusRead } from "./schema";

export type TestLine = {
  key: string;
  title: string;
  // The chosen session; null until a group question is answered.
  session: number | null;
  // More than one means "which one is your group's?".
  options: number[];
  weight: number | null;
  assumed: boolean;
  quote: string;
};

export type Review = {
  sessionsTotal: number | null;
  participation: number | null;
  tests: TestLine[];
  topics: {
    number: number;
    topic: string;
    pre_reading: string | null;
    probably: boolean;
  }[];
  conflicts: string[];
  penalty: string | null;
  retake: { general: string | null; statedHere: boolean };
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const round2 = (n: number) => Math.round(n * 100) / 100;

// Only tests matter here: quizzes, intermediate tests, midterms and finals,
// plus presentations the syllabus puts in a named session. Coursework
// (individual or group work) is a weight, never a dated row.
const TEST_NAME = /quiz|test|exam|midterm|final/i;
const isTest = (a: SyllabusRead["assessments"][number]) =>
  !a.continuous &&
  (a.kind === "test" ||
    a.kind === "exam" ||
    a.kind === "presentation" ||
    TEST_NAME.test(a.name));

const STOP = new Set(["session", "class", "group", "individual", "work"]);
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => w.replace(/s$/, ""))
    .filter((w) => w.length >= 4 && !STOP.has(w));

// "in session 30", "sessions 10 and 20": numbers the quote states outright.
function sessionsInQuote(quote: string, max: number): number[] {
  const out = new Set<number>();
  for (const m of quote.matchAll(
    /\bses(?:sion|ión|ion)?e?s?\.?\s*((?:\d{1,3}\s*(?:,|and|y|&|or|o|-|–)?\s*)+)/gi,
  ))
    for (const n of m[1].match(/\d{1,3}/g) ?? []) {
      const v = Number(n);
      if (v >= 1 && v <= max) out.add(v);
    }
  return [...out].sort((x, y) => x - y);
}

// Plan sessions whose title names this test ("Session 30: FINAL EXAM").
function plannedFor(name: string, sessions: SyllabusRead["sessions"]) {
  const want = new Set(words(name));
  return sessions
    .filter(
      (s) =>
        (s.kind === "test" ||
          s.kind === "exam" ||
          s.kind === "presentation" ||
          TEST_NAME.test(s.title)) &&
        words(s.title).some((w) => want.has(w)),
    )
    .map((s) => s.number);
}

export function reviewFromRead(read: SyllabusRead): Review {
  const tests: TestLine[] = [];
  let participation: number | null = null;
  const max = read.sessions_total ?? MAX_SESSIONS;
  for (const raw of read.assessments) {
    if (raw.kind === "participation") {
      participation = raw.weight_percent;
      continue;
    }
    if (!isTest(raw)) continue;
    // The session can sit in the grading table, the quote or the session
    // plan. When none of them names it, the item is left out, never guessed.
    let sessions = raw.sessions;
    if (sessions.length === 0) sessions = sessionsInQuote(raw.quote, max);
    if (sessions.length === 0) sessions = plannedFor(raw.name, read.sessions);
    if (sessions.length === 0) continue;
    const a = { ...raw, sessions };
    if (a.depends_on_group) {
      tests.push({
        key: `${a.name}|group`,
        title: a.name.slice(0, 200),
        session: a.sessions.length === 1 ? a.sessions[0] : null,
        options: a.sessions,
        weight: a.weight_percent,
        assumed: false,
        quote: a.quote,
      });
      continue;
    }
    const n = a.sessions.length;
    a.sessions.forEach((s, i) => {
      const title = n > 1 ? `${a.name} ${ROMAN[i] ?? i + 1}` : a.name;
      tests.push({
        key: `${a.name}|${s}`,
        title: title.slice(0, 200),
        session: s,
        options: [s],
        weight:
          a.weight_percent == null
            ? null
            : n > 1
              ? round2(a.weight_percent / n)
              : a.weight_percent,
        assumed: n > 1 && a.weight_percent != null,
        quote: a.quote,
      });
    });
  }
  return {
    sessionsTotal: read.sessions_total,
    participation,
    tests,
    topics: read.sessions.map((s) => ({
      number: s.number,
      topic: s.title.slice(0, 500),
      pre_reading: s.pre_reading,
      probably: s.inferred,
    })),
    conflicts: read.conflicts,
    penalty: read.attendance_penalty,
    retake: {
      general: read.retake_rule_general,
      statedHere: read.retake_rule_stated_here,
    },
  };
}

// What the review screen posts to the confirm action.
export const confirmSchema = z.object({
  courseId: z.uuid(),
  sessionsTotal: z.number().int().min(1).max(200).nullable(),
  participation: z.number().min(0).max(100).nullable(),
  tests: z
    .array(
      z.object({
        // Null when the syllabus never says which session the test is in.
        session_number: z.number().int().min(1).max(200).nullable(),
        title: z.string().trim().min(1).max(200),
        weight: z.number().min(0).max(100).nullable(),
        weight_assumed: z.boolean(),
      }),
    )
    .max(60),
  topics: z
    .array(
      z.object({
        session_number: z.number().int().min(1).max(200),
        topic: z.string().trim().min(1).max(500),
        pre_reading: z.string().max(2000).nullable(),
        probably: z.boolean(),
      }),
    )
    .max(200),
});
export type Confirmed = z.infer<typeof confirmSchema>;
export type SavedTest = Confirmed["tests"][number];
export type SavedTopic = Confirmed["topics"][number];

export type Change = {
  kind: "added" | "changed" | "removed";
  what: "test" | "topic";
  session: number;
  text: string;
};

const testText = (t: SavedTest) =>
  `${t.title}${t.weight == null ? "" : ` · ${Number(t.weight)}%`}`;
const topicText = (t: SavedTopic) =>
  t.pre_reading ? `${t.topic} · ${t.pre_reading}` : t.topic;

function diffBy<T extends { session_number: number | null }>(
  what: Change["what"],
  before: T[],
  after: T[],
  text: (t: T) => string,
): Change[] {
  // A session can hold two lines (a presentation and the final), so join them.
  const bySession = (rows: T[]) => {
    const m = new Map<number, string[]>();
    // Session 0 holds the tests the syllabus gives no session for.
    for (const r of rows) {
      const n = r.session_number ?? 0;
      m.set(n, [...(m.get(n) ?? []), text(r)]);
    }
    return new Map([...m].map(([k, v]) => [k, v.sort().join(" + ")]));
  };
  const old = bySession(before);
  const now = bySession(after);
  const out: Change[] = [];
  for (const [session, t] of now) {
    if (!old.has(session)) out.push({ kind: "added", what, session, text: t });
    else if (old.get(session) !== t)
      out.push({ kind: "changed", what, session, text: t });
  }
  for (const [session, t] of old)
    if (!now.has(session))
      out.push({ kind: "removed", what, session, text: t });
  return out.sort((a, b) => a.session - b.session);
}

// Re-import: only the lines that differ from what is saved.
export function diffSaved(
  before: { tests: SavedTest[]; topics: SavedTopic[] },
  after: { tests: SavedTest[]; topics: SavedTopic[] },
): Change[] {
  return [
    ...diffBy("test", before.tests, after.tests, testText),
    ...diffBy("topic", before.topics, after.topics, topicText),
  ];
}
