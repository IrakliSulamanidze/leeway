// The night-before alert: one message for tomorrow's risky courses, or nothing.
// Pure: the cron job loads the rows and sends what this returns.
import { addDays, dateIn, MADRID } from "./dates";
import { livesLeft, type CourseRow, type SkipRow } from "./lives";

export type AlertCourse = CourseRow & { name: string };
export type AlertClass = {
  course_id: string;
  starts_at: string;
  kind: string;
  is_exam_slot: boolean;
};
// A test on a date, or on a class (the cron passes that class's start).
export type AlertTest = {
  course_id: string;
  on_date: string | null;
  class_starts_at: string | null;
};
export type AlertInput = {
  tomorrow: string;
  courses: AlertCourse[];
  skips: SkipRow[];
  // Upcoming classes from tomorrow on; empty without a calendar.
  classes: AlertClass[];
  tests: AlertTest[];
  // null: no calendar connected. failed: the last sync failed, so data is from syncedOn.
  calendar: { failed: boolean; syncedOn: string | null } | null;
};

function madridTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MADRID,
    hourCycle: "h23",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${Number(get("hour"))}:${get("minute")}`;
}

function weekday(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
}

const madridDay = (iso: string) => dateIn(new Date(iso), MADRID);

function lineFor(c: AlertCourse, i: AlertInput): string | null {
  const mine = i.classes
    .filter((k) => k.course_id === c.id)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const tomorrows = mine.filter((k) => madridDay(k.starts_at) === i.tomorrow);
  const testDays = new Set(
    i.tests
      .filter((t) => t.course_id === c.id)
      .map(
        (t) => t.on_date ?? (t.class_starts_at && madridDay(t.class_starts_at)),
      )
      .filter((d): d is string => !!d),
  );
  const planned = i.skips.some(
    (s) => s.course_id === c.id && s.planned && s.skip_date === i.tomorrow,
  );
  const test =
    testDays.has(i.tomorrow) ||
    tomorrows.some((k) => k.kind === "exam" || k.is_exam_slot);
  const next = mine.find((k) => madridDay(k.starts_at) > i.tomorrow);
  const beforeTest =
    tomorrows.length > 0 && !!next && testDays.has(madridDay(next.starts_at));
  // Lives as they will stand tomorrow morning: tomorrow's planned skip still counts.
  const { left } = livesLeft(c, i.skips, addDays(i.tomorrow, -1));
  // Without a class tomorrow (or a planned skip of one) lives are no news tonight.
  const attending = tomorrows.length > 0 || planned;

  // Copy from the spec table: "Tomorrow 9:00 Stats. Last life, don't skip." and
  // "You planned to skip Micro tomorrow. That leaves 1 life."
  const testNote = test
    ? "Test day, don't skip."
    : beforeTest
      ? "It's the class before the test."
      : "";
  if (planned) {
    const lives = `That leaves ${left} ${Math.abs(left) === 1 ? "life" : "lives"}.`;
    return [`You planned to skip ${c.name} tomorrow.`, lives, testNote]
      .filter(Boolean)
      .join(" ");
  }
  const lifeNote = !attending
    ? ""
    : left < 0
      ? "Over the limit. Talk to your professor."
      : left === 0
        ? "Out of lives. The next skip takes you below 80%."
        : left === 1
          ? "Last life, don't skip."
          : "";
  const note = test ? testNote : lifeNote;
  if (!note) return null;
  const first = tomorrows[0];
  const when = first ? ` ${madridTime(first.starts_at)}` : "";
  return `Tomorrow${when} ${c.name}. ${note}`;
}

export function nightAlert(i: AlertInput): string | null {
  const firstClass = (id: string) =>
    i.classes
      .filter(
        (k) => k.course_id === id && madridDay(k.starts_at) === i.tomorrow,
      )
      .map((k) => k.starts_at)
      .sort()[0] ?? "~";
  const lines = [...i.courses]
    .sort((a, b) => firstClass(a.id).localeCompare(firstClass(b.id)))
    .map((c) => lineFor(c, i))
    .filter((l): l is string => !!l);
  if (!lines.length) return null;
  if (i.calendar?.failed && i.calendar.syncedOn)
    lines.push(`Calendar as of ${weekday(i.calendar.syncedOn)}.`);
  return lines.join("\n");
}
