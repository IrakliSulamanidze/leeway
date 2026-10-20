// Turns one syllabus read into review lines, the lines into the rows the confirm
// action writes, and diffs them against the rows already saved (re-import).
// Pure: no I/O.
import { z } from "zod";
import type { SyllabusRead } from "./schema";

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

export function reviewFromRead(read: SyllabusRead): Review {
  const tests: TestLine[] = [];
  let participation: number | null = null;
  for (const a of read.assessments) {
    if (a.kind === "participation" || a.sessions.length === 0) {
      if (a.kind === "participation") participation = a.weight_percent;
      continue;
    }
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
        session_number: z.number().int().min(1).max(200),
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

function diffBy<T extends { session_number: number }>(
  what: Change["what"],
  before: T[],
  after: T[],
  text: (t: T) => string,
): Change[] {
  // A session can hold two lines (a presentation and the final), so join them.
  const bySession = (rows: T[]) => {
    const m = new Map<number, string[]>();
    for (const r of rows)
      m.set(r.session_number, [...(m.get(r.session_number) ?? []), text(r)]);
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
