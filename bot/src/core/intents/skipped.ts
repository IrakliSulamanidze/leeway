import { addDays, madridToday } from "@/lib/rules/dates";
import { normName, nearMatch, partialMatches } from "@/lib/rules/match";
import {
  classCost,
  dedupeClasses,
  madridDate,
  skippable,
  testOn,
} from "@/lib/rules/week";
import type { Deps, Snapshot } from "../../ports";
import { dayName, weekCourses } from "../data";
import type { Button, Reply } from "../types";
import type { Intent, Outcome, Turn } from "./types";

// "skipped micro" saves today's skip; "skipping micro tomorrow" plans one.
const TODAY = /^(?:skipped|missed) (.{2,80}?)(?: today| this morning)?$/;
const TOMORROW = /^(?:skipping|will skip|gonna skip) (.{2,80}) tomorrow$/;
// Button ids: skip.pick:<course>:<day>, skip.yes:<course>:<class or ->:<day>,
// skip.no, skip.undo:<skip>.
const ID = "[0-9a-f-]{36}";
const DAY = "\\d{4}-\\d{2}-\\d{2}";
const PICK = new RegExp(`^skip\\.pick:(${ID}):(${DAY})$`);
const YES = new RegExp(`^skip\\.yes:(${ID}):(${ID}|-):(${DAY})$`);
const UNDO = new RegExp(`^skip\\.undo:(${ID})$`);

// Button titles are at most 20 characters; long names keep their start and
// end so "Financial Reporting I" and "II" stay apart.
const shortTitle = (name: string) =>
  name.length <= 20 ? name : `${name.slice(0, 12)}…${name.slice(-7)}`;
const livesWord = (n: number) => `${n} ${n === 1 ? "life" : "lives"}`;

function findCourses(typed: string, snap: Snapshot) {
  const names = snap.courses.map((c) => c.name);
  const byName = (n: string) => snap.courses.find((c) => c.name === n)!;
  const exact = snap.courses.filter(
    (c) => normName(c.name) === normName(typed),
  );
  if (exact.length) return exact;
  const partial = partialMatches(typed, names);
  if (partial.length) return partial.map(byName);
  const near = nearMatch(typed, names);
  return near ? [byName(near)] : [];
}

type Plan = {
  name: string;
  courseId: string;
  classId: string | null;
  day: string;
  sessions: 1 | 2;
  after: number;
  test: string | null;
  // The skip that already covers this course and day, if there is one.
  existing: string | null;
  // The student has a calendar, but no class of this course that day.
  noClass: boolean;
};

const startKey = (iso: string) => new Date(iso).toISOString();

// What skipping this course on this day would cost, by the web app's rules.
// The first class that day not already skipped is the one saved; the same
// class in two calendars counts once.
function plan(
  snap: Snapshot,
  courseId: string,
  day: string,
  today: string,
): Plan {
  const course = snap.courses.find((c) => c.id === courseId)!;
  const left = weekCourses(snap, today).find((c) => c.id === courseId)!.left;
  const dayClasses = snap.sessions.filter(
    (s) =>
      s.course_id === courseId &&
      skippable(s) &&
      madridDate(s.starts_at) === day,
  );
  const skipOf = (classId: string) =>
    snap.skips.find((k) => k.class_session_id === classId);
  const copies = (start: string) =>
    dayClasses.filter((c) => startKey(c.starts_at) === startKey(start));
  const distinct = dedupeClasses(dayClasses).sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );
  const free = distinct.find(
    (c) => !copies(c.starts_at).some((o) => skipOf(o.id)),
  );
  // A skip saved without a class covers the course's whole day, as on the web.
  const dayWide = snap.skips.find(
    (k) =>
      k.course_id === courseId &&
      k.skip_date === day &&
      k.class_session_id === null,
  );
  const existing =
    dayWide?.id ??
    (distinct.length && !free
      ? (copies(distinct[0].starts_at)
          .map((c) => skipOf(c.id))
          .find(Boolean)?.id ?? null)
      : null);
  const cls = existing ? undefined : free;
  const sessions = (cls ? classCost(cls) : 1) as 1 | 2;
  const test = cls
    ? testOn(cls, snap.assessments)
    : snap.assessments.find(
        (a) => a.course_id === courseId && a.on_date === day,
      );
  return {
    name: course.name,
    courseId,
    classId: cls?.id ?? null,
    day,
    sessions,
    after: existing ? left : left - sessions,
    test: test ? test.title || "Test" : null,
    existing,
    noClass: !existing && distinct.length === 0 && snap.sessions.length > 0,
  };
}

const alreadySaved = (p: Plan): Outcome => ({
  replies: [
    {
      text: `Already saved: ${p.name}, ${dayName(p.day)}.`,
      buttons: [{ id: `skip.undo:${p.existing}`, title: "Undo" }],
    },
  ],
});

async function save(turn: Turn, deps: Deps, p: Plan): Promise<Outcome> {
  const id = await deps.student.logSkip(
    turn.msg.from,
    {
      courseId: p.courseId,
      classId: p.classId,
      day: p.day,
      sessions: p.sessions,
    },
    turn.msg.id,
  );
  const lives =
    p.after < 0
      ? "That's over the limit."
      : `${livesWord(p.after)} left in ${p.name}.`;
  return {
    replies: [
      {
        text: `Saved: ${p.name}, ${dayName(p.day)}. ${lives}`,
        buttons: [{ id: `skip.undo:${id}`, title: "Undo" }],
      },
    ],
  };
}

// A skip on a test day, or one that uses the last life or more, asks first.
function confirmOrSave(
  turn: Turn,
  deps: Deps,
  p: Plan,
): Promise<Outcome> | Outcome {
  if (p.existing) return alreadySaved(p);
  const reason = p.noClass
    ? `there's no ${p.name} class in your calendar that day`
    : p.test
      ? `that's the ${p.test} day`
      : p.after < 0
        ? "this takes you over the limit"
        : p.after === 0
          ? "this uses your last life"
          : null;
  if (!reason) return save(turn, deps, p);
  const yes: Button = {
    id: `skip.yes:${p.courseId}:${p.classId ?? "-"}:${p.day}`,
    title: "Save it",
  };
  return {
    replies: [
      {
        text: `${p.name}, ${dayName(p.day)}: ${reason}. Save the skip anyway?`,
        buttons: [yes, { id: "skip.no", title: "Don't save" }],
      },
    ],
  };
}

function parse(turn: Turn): { typed: string; tomorrow: boolean } | null {
  if (turn.text === null) return null;
  const today = TODAY.exec(turn.text);
  if (today) return { typed: today[1], tomorrow: false };
  const tomorrow = TOMORROW.exec(turn.text);
  return tomorrow ? { typed: tomorrow[1], tomorrow: true } : null;
}

const isSkipButton = (id: string | null) =>
  id !== null && id.startsWith("skip.");

export const skipped: Intent = {
  name: "skipped",
  matches: (t) => parse(t) !== null || isSkipButton(t.button),
  async run(turn, deps) {
    const today = madridToday(turn.now);
    const reply = (text: string): Outcome => ({ replies: [{ text }] });

    if (turn.button === "skip.no") return reply("Okay, nothing saved.");
    const undo = turn.button ? UNDO.exec(turn.button) : null;
    if (undo)
      return reply(
        (await deps.student.undoSkip(turn.msg.from, undo[1]))
          ? "Undone."
          : "Nothing to undo.",
      );

    const yes = turn.button ? YES.exec(turn.button) : null;
    const pick = turn.button ? PICK.exec(turn.button) : null;
    const asked = parse(turn);
    const day =
      yes?.[3] ?? pick?.[2] ?? (asked?.tomorrow ? addDays(today, 1) : today);
    // Only today and tomorrow, whatever an old button says.
    if (day < today || day > addDays(today, 1))
      return reply("That button has expired.");

    const snap = await deps.student.snapshot(turn.msg.from, {
      from: day,
      to: day,
    });
    const owned = (id: string) => snap.courses.some((c) => c.id === id);

    if (yes) {
      if (!owned(yes[1])) return reply("That button has expired.");
      const p = plan(snap, yes[1], day, today);
      return p.existing ? alreadySaved(p) : save(turn, deps, p);
    }
    if (pick) {
      if (!owned(pick[1])) return reply("That button has expired.");
      return confirmOrSave(turn, deps, plan(snap, pick[1], day, today));
    }
    if (!asked) return reply("That button has expired.");

    const found = findCourses(asked.typed, snap);
    if (found.length === 1)
      return confirmOrSave(turn, deps, plan(snap, found[0].id, day, today));
    if (found.length > 1 && found.length <= 3) {
      const buttons = found.map((c) => ({
        id: `skip.pick:${c.id}:${day}`,
        title: shortTitle(c.name),
      }));
      return { replies: [{ text: "Which course?", buttons } satisfies Reply] };
    }
    const names = snap.courses
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b))
      .join(", ");
    return reply(
      found.length > 3
        ? `That matches several courses. Type more of the name: ${names}.`
        : names
          ? `I couldn't find that course. Yours are: ${names}.`
          : "You have no courses yet. Add them on the Leeway website.",
    );
  },
};
