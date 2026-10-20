// Week tools (tech-plan 5): Today, Trip check, Can I skip this week? and
// If you have to miss one. Pure functions, no I/O. Dates are Madrid dates.

const TZ = "Europe/Madrid";

export type ClassKind = "class" | "async" | "extra" | "exam" | "deadline";

export type WeekClass = {
  id: string;
  course_id: string;
  starts_at: string;
  kind: ClassKind;
  is_exam_slot: boolean;
  session_numbers: number[];
  // Loaded for the calendar grid only.
  ends_at?: string;
  all_day?: boolean;
};

// `left` is lives left after logged and planned skips (lives.ts livesLeft).
export type WeekCourse = {
  id: string;
  name: string;
  left: number;
  // Classes counted as missed before the student started marking them.
  missedBefore?: number;
};

export type WeekSkip = {
  course_id: string;
  class_session_id: string | null;
  skip_date: string;
};

export type WeekAssessment = {
  course_id: string;
  class_session_id: string | null;
  session_number: number | null;
  on_date: string | null;
  title?: string;
};

export type Range = { from: string; to: string };

export type WeekRow = {
  cls: WeekClass;
  course: string;
  day: string;
  cost: number;
  leftAfter: number;
  testDay: boolean;
  // "Midterm", "Quiz"… when the test is marked with a name.
  test: string | null;
  planned: boolean;
};

// One course on a trip: lives before and after, and the tests it would miss.
export type TripCourse = {
  id: string;
  name: string;
  before: number;
  after: number;
  missing: number;
  planned: number;
  tests: { day: string; title: string }[];
  noTests: boolean;
  rows: WeekRow[];
};

export type Verdict = "none" | "safe" | "last" | "out" | "test";

export type LeftOut = {
  course: string;
  reason: "last" | "test" | "mark";
  day?: string;
};

export function madridDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// "Thu 5" for a class row, from its start time.
export function dayLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")}`;
}

// Monday of the week holding `day` ('YYYY-MM-DD'), the key of weekly_checks.
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function weekRange(day: string): Range {
  const from = weekStart(day);
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return { from, to: d.toISOString().slice(0, 10) };
}

// The same class in two calendars counts once (tech-plan 5.2 rule 9).
export function dedupeClasses(classes: WeekClass[]): WeekClass[] {
  const seen = new Set<string>();
  return classes.filter((c) => {
    const key = `${c.course_id}|${new Date(c.starts_at).toISOString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Only real classes can be skipped: never exams, deadlines, extras or exam slots.
export function skippable(c: WeekClass): boolean {
  return (c.kind === "class" || c.kind === "async") && !c.is_exam_slot;
}

export function isTestDay(
  c: WeekClass,
  assessments: WeekAssessment[],
): boolean {
  return testOn(c, assessments) !== undefined;
}

export function testOn(
  c: WeekClass,
  assessments: WeekAssessment[],
): WeekAssessment | undefined {
  const day = madridDate(c.starts_at);
  return assessments.find(
    (a) =>
      a.class_session_id === c.id ||
      (a.course_id === c.course_id &&
        (a.on_date === day ||
          (a.session_number !== null &&
            c.session_numbers.includes(a.session_number)))),
  );
}

// A double class (two session numbers) costs two lives.
export function classCost(c: WeekClass): number {
  return Math.max(1, Math.min(2, c.session_numbers.length));
}

function inRange(c: WeekClass, range: Range): boolean {
  const day = madridDate(c.starts_at);
  return day >= range.from && day <= range.to;
}

export function isPlanned(c: WeekClass, skips: WeekSkip[]): boolean {
  return skips.some(
    (s) =>
      s.class_session_id === c.id ||
      (s.class_session_id === null &&
        s.course_id === c.course_id &&
        s.skip_date === madridDate(c.starts_at)),
  );
}

function rowsFor(
  range: Range,
  sessions: WeekClass[],
  courses: WeekCourse[],
  skips: WeekSkip[],
  assessments: WeekAssessment[],
): WeekRow[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const left = new Map(courses.map((c) => [c.id, c.left]));
  return dedupeClasses(sessions)
    .filter((c) => skippable(c) && inRange(c, range) && byId.has(c.course_id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((cls) => {
      const planned = isPlanned(cls, skips);
      const cost = planned ? 0 : classCost(cls);
      const after = (left.get(cls.course_id) ?? 0) - cost;
      left.set(cls.course_id, after);
      const test = testOn(cls, assessments);
      return {
        cls,
        course: byId.get(cls.course_id)!.name,
        day: dayLabel(cls.starts_at),
        cost,
        leftAfter: after,
        testDay: test !== undefined,
        test: test ? test.title || "Test" : null,
        planned,
      };
    });
}

function hasTestMarks(courseId: string, assessments: WeekAssessment[]) {
  return assessments.some((a) => a.course_id === courseId);
}

// Each course a trip touches, with what the trip costs it: tests first, then
// the fewest lives left, so the course to worry about is on top.
function byCourse(
  rows: WeekRow[],
  courses: WeekCourse[],
  assessments: WeekAssessment[],
): TripCourse[] {
  return courses
    .map((c) => {
      const mine = rows.filter((r) => r.cls.course_id === c.id);
      const cost = mine.reduce((n, r) => n + r.cost, 0);
      return {
        id: c.id,
        name: c.name,
        before: c.left,
        after: c.left - cost,
        missing: mine.filter((r) => !r.planned).length,
        planned: mine.filter((r) => r.planned).length,
        tests: mine
          .filter((r) => r.test)
          .map((r) => ({ day: r.day, title: r.test! })),
        noTests: !hasTestMarks(c.id, assessments),
        rows: mine,
      };
    })
    .filter((c) => c.rows.length > 0)
    .sort(
      (a, b) =>
        Number(b.tests.length > 0) - Number(a.tests.length > 0) ||
        a.after - b.after ||
        a.name.localeCompare(b.name),
    );
}

// Trip check and Can I skip this week?: verdict first, then each course.
// A course with no test days marked doesn't block the answer; its card says so.
export function canISkip(
  range: Range,
  sessions: WeekClass[],
  courses: WeekCourse[],
  skips: WeekSkip[],
  assessments: WeekAssessment[],
): {
  verdict: string;
  lead: string;
  detail: string;
  state: Verdict;
  classes: WeekRow[];
  courses: TripCourse[];
} {
  const classes = rowsFor(range, sessions, courses, skips, assessments);
  const trip = byCourse(classes, courses, assessments);
  const answer = (lead: string, detail: string, state: Verdict) => ({
    verdict: detail ? `${lead} ${detail}` : lead,
    lead,
    detail,
    state,
    classes,
    courses: trip,
  });
  if (classes.length === 0)
    return answer("No classes on these dates.", "", "none");

  const missed = classes.filter((r) => !r.planned).length;
  const lead =
    missed === 0
      ? "Already planned."
      : `You'd miss ${missed} ${missed === 1 ? "class" : "classes"}.`;
  const lowest = [...trip].sort((a, b) => a.after - b.after)[0];
  const lives =
    lowest.after < 0
      ? `${lowest.name} would be over the limit.`
      : lowest.after === 0
        ? `${lowest.name} would be out of lives.`
        : lowest.after === 1
          ? `${lowest.name} would be on its last life.`
          : "";
  const tests = classes.filter((r) => r.testDay);
  const test =
    tests.length > 1
      ? `${tests.length} of them are tests.`
      : tests.length === 1
        ? `${tests[0].course} has a test on ${tests[0].day}.`
        : "";
  // A test is the worst news, but a course running out still gets said.
  if (test) return answer(lead, lives ? `${test} ${lives}` : test, "test");
  if (lives) return answer(lead, lives, lowest.after <= 0 ? "out" : "last");
  return answer(lead, "Every course stays safe.", "safe");
}

// This week's classes by what they cost, cheapest first. Never test days, never
// exam slots, never a course on its last life or one without test marks.
export function ifYouHaveToMissOne(
  week: Range,
  sessions: WeekClass[],
  courses: WeekCourse[],
  skips: WeekSkip[],
  assessments: WeekAssessment[],
): { options: WeekRow[]; leftOut: LeftOut[] } {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const rows = rowsFor(week, sessions, courses, skips, assessments);
  const leftOut: LeftOut[] = [];
  const out = (o: LeftOut) => {
    if (!leftOut.some((x) => x.course === o.course && x.reason === o.reason))
      leftOut.push(o);
  };
  const options = rows.filter((r) => {
    const course = byId.get(r.cls.course_id)!;
    if (!hasTestMarks(course.id, assessments)) {
      out({ course: course.name, reason: "mark" });
      return false;
    }
    if (course.left <= 1) {
      out({ course: course.name, reason: "last" });
      return false;
    }
    if (r.testDay) {
      out({ course: course.name, reason: "test", day: r.day });
      return false;
    }
    return true;
  });
  // Each option on its own: lives left if only this class is missed.
  const solo = options.map((r) => ({
    ...r,
    leftAfter: byId.get(r.cls.course_id)!.left - r.cost,
  }));
  solo.sort(
    (a, b) =>
      Number(a.planned) - Number(b.planned) ||
      b.leftAfter - a.leftAfter ||
      a.cls.starts_at.localeCompare(b.cls.starts_at),
  );
  return { options: solo, leftOut };
}

export function leftOutLine(leftOut: LeftOut[]): string | null {
  if (leftOut.length === 0) return null;
  const parts = leftOut.map((o) =>
    o.reason === "last"
      ? `${o.course} (last life)`
      : o.reason === "test"
        ? `${o.course} on ${o.day} (test day)`
        : `${o.course} (mark test days first)`,
  );
  return `Left out: ${parts.join(", ")}.`;
}
