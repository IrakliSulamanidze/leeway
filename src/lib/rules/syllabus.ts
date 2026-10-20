// What a syllabus adds to the skip preview and the course page (spec "Syllabus
// and tests", "What you'll miss"). Pure: no I/O. Dates are 'YYYY-MM-DD'.

export type TestRow = {
  session_number: number | null;
  on_date: string | null;
  title: string;
  weight: number | null;
};
export type TopicRow = {
  session_number: number;
  topic: string;
  pre_reading: string | null;
  probably: boolean;
};

export const EXAM_PREP = "Exam prep";

const pct = (w: number) => `${Number(w.toFixed(2))}%`;
const withWeight = (t: TestRow) =>
  t.weight == null ? t.title : `${t.title} (${pct(t.weight)})`;
const end = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

export function testOn(session: number, tests: TestRow[]): TestRow | null {
  return tests.find((t) => t.session_number === session) ?? null;
}

// "Session 16 is Continuous Evaluation II (7.5%). Skipping costs a life and the test."
export function testLine(session: number, tests: TestRow[]): string | null {
  const t = testOn(session, tests);
  return t
    ? `Session ${session} is ${withWeight(t)}. Skipping costs a life and the test.`
    : null;
}

// "Every skip also costs participation (10%)."
export function participationLine(weight: number | null): string | null {
  return weight
    ? `Every skip also costs participation (${pct(weight)}).`
    : null;
}

// "Quicksort. Probably on the test in session 11. Catch up: Grokking Algorithms, chapter 3"
// Syllabi rarely say what a test covers, so the link to the next test is "probably".
export function missLine(
  session: number,
  topics: TopicRow[],
  tests: TestRow[],
): string | null {
  const s = topics.find((t) => t.session_number === session);
  if (!s || testOn(session, tests)) return null;
  const topic = s.probably ? `Probably ${s.topic}` : s.topic;
  const next = tests
    .map((t) => t.session_number)
    .filter((n): n is number => n != null && n > session)
    .sort((a, b) => a - b)[0];
  const parts = [end(topic)];
  if (next) parts.push(`Probably on the test in session ${next}.`);
  if (s.pre_reading) parts.push(`Catch up: ${s.pre_reading}`);
  return parts.join(" ");
}

// The session right before a test is "Exam prep".
export function isExamPrep(session: number, tests: TestRow[]): boolean {
  return !testOn(session, tests) && testOn(session + 1, tests) !== null;
}

const DAY_MS = 86_400_000;
const days = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

// The course card countdown to the next dated test: "Final exam in 5 days".
export function countdown(today: string, tests: TestRow[]): string | null {
  const next = tests
    .filter((t): t is TestRow & { on_date: string } => !!t.on_date)
    .filter((t) => t.on_date >= today)
    .sort((a, b) => a.on_date.localeCompare(b.on_date))[0];
  if (!next) return null;
  const n = days(today, next.on_date);
  if (n === 0) return `${next.title} today`;
  if (n === 1) return `${next.title} tomorrow`;
  return `${next.title} in ${n} days`;
}

// The extra preview lines under the main one when the course has a syllabus.
export function syllabusPreview(i: {
  session: number | null;
  tests: TestRow[];
  topics: TopicRow[];
  participation: number | null;
}): string[] {
  const lines =
    i.session == null
      ? []
      : [testLine(i.session, i.tests), missLine(i.session, i.topics, i.tests)];
  return [...lines, participationLine(i.participation)].filter(
    (l): l is string => l !== null,
  );
}
