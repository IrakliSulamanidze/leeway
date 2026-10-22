// What Leeway sends on its own: on Sundays a look at the week ahead, on other
// days a heads-up for tomorrow built from the web's night alert (the web adds
// a "calendar as of" line the bot leaves out). At most one a day; nothing
// when there is nothing to say.
import { addDays, madridToday } from "@/lib/rules/dates";
import { nightAlert } from "@/lib/rules/alert";
import { madridDate, skippable } from "@/lib/rules/week";
import type { Snapshot } from "../ports";
import { courseLives, dayName } from "./data";

// Meta refuses template values with line breaks, tabs or long runs of
// spaces, and caps a body at 1024 characters.
const MAX_PARAM = 400;
export function cleanParam(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= MAX_PARAM ? flat : `${flat.slice(0, MAX_PARAM - 1)}…`;
}

const MAX_ITEMS = 6;
function capped(items: string[]): string[] {
  return items.length <= MAX_ITEMS
    ? items
    : [...items.slice(0, MAX_ITEMS), `and ${items.length - MAX_ITEMS} more`];
}

export type Reminder = {
  kind: "evening" | "weekly";
  // The message as plain text, for a student who wrote in the last day.
  text: string;
  // The same, as values for Meta's approved template (no line breaks allowed).
  template: { name: string; params: string[] };
};

function testDays(snap: Snapshot) {
  const names = new Map(snap.courses.map((c) => [c.id, c.name]));
  const startOf = new Map(snap.sessions.map((s) => [s.id, s.starts_at]));
  return snap.assessments
    .map((a) => {
      const start = a.class_session_id
        ? startOf.get(a.class_session_id)
        : undefined;
      const day = a.on_date ?? (start ? madridDate(start) : null);
      return day
        ? {
            day,
            course: names.get(a.course_id) ?? "Course",
            title: a.title || "Test",
          }
        : null;
    })
    .filter(
      (t): t is { day: string; course: string; title: string } => t !== null,
    )
    .sort((a, b) => a.day.localeCompare(b.day));
}

function evening(
  snap: Snapshot,
  today: string,
  hide: boolean,
): Reminder | null {
  const startOf = new Map(snap.sessions.map((s) => [s.id, s.starts_at]));
  const alert = nightAlert({
    tomorrow: addDays(today, 1),
    courses: snap.courses,
    skips: snap.skips,
    classes: snap.sessions.filter((s) => madridDate(s.starts_at) > today),
    tests: snap.assessments.map((a) => ({
      course_id: a.course_id,
      on_date: a.on_date,
      class_starts_at: a.class_session_id
        ? (startOf.get(a.class_session_id) ?? null)
        : null,
    })),
    calendar: null,
  });
  if (!alert) return null;
  const lines = alert.split("\n");
  if (hide) {
    const count = `${lines.length} ${lines.length === 1 ? "thing" : "things"} to check`;
    return {
      kind: "evening",
      text: `Heads-up for tomorrow: ${count}. Send "tomorrow" for details.`,
      template: { name: "leeway_evening_private", params: [cleanParam(count)] },
    };
  }
  return {
    kind: "evening",
    text: `Heads-up for tomorrow:\n${alert}`,
    template: {
      name: "leeway_evening",
      params: [cleanParam(capped(lines).join(" · "))],
    },
  };
}

function weekly(snap: Snapshot, today: string, hide: boolean): Reminder | null {
  const from = addDays(today, 1);
  const to = addDays(today, 7);
  const tests = testDays(snap).filter((t) => t.day >= from && t.day <= to);
  // Only courses with a class still to come this week are worth watching.
  const hasClass = new Set(
    snap.sessions
      .filter(
        (s) =>
          skippable(s) &&
          madridDate(s.starts_at) >= from &&
          madridDate(s.starts_at) <= to,
      )
      .map((s) => s.course_id),
  );
  const watch = courseLives(snap, today).filter(
    (c) => c.left <= 1 && hasClass.has(c.id),
  );
  if (!tests.length && !watch.length) return null;
  const range = `${dayName(from)} to ${dayName(to)}`;
  const n = (k: number, one: string, many: string) =>
    `${k} ${k === 1 ? one : many}`;
  if (hide) {
    const summary = [
      tests.length ? n(tests.length, "test", "tests") : "",
      watch.length
        ? n(watch.length, "course to watch", "courses to watch")
        : "",
    ]
      .filter(Boolean)
      .join(", ");
    return {
      kind: "weekly",
      text: `Your week, ${range}: ${summary}. Send "this week" for details.`,
      template: {
        name: "leeway_weekly_private",
        params: [cleanParam(range), cleanParam(summary)],
      },
    };
  }
  const parts = [
    ...tests.map((t) => `${t.course} ${t.title}, ${dayName(t.day)}`),
    ...watch.map(
      (c) => `${c.name}: ${c.left <= 0 ? "out of lives" : "last life"}`,
    ),
  ];
  return {
    kind: "weekly",
    text: `Your week, ${range}:\n${capped(parts).join("\n")}`,
    template: {
      name: "leeway_weekly",
      params: [cleanParam(range), cleanParam(capped(parts).join(" · "))],
    },
  };
}

export function reminderFor(
  snap: Snapshot,
  now: Date,
  hide: boolean,
): Reminder | null {
  const today = madridToday(now);
  const sunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  // On Sundays the week ahead, or tomorrow's heads-up when the week holds
  // nothing to flag (a planned skip on Monday still gets said).
  return (
    (sunday ? weekly(snap, today, hide) : null) ?? evening(snap, today, hide)
  );
}
