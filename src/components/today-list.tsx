import { toggleSkipped, weeklyAllGood } from "@/app/app/calendar/actions";
import {
  dedupeClasses,
  madridDate,
  skippable,
  weekRange,
  weekStart,
  type WeekClass,
  type WeekCourse,
  type WeekSkip,
} from "@/lib/rules/week";

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function sessionLine(c: WeekClass): string {
  const n = c.session_numbers;
  const ses =
    n.length === 0
      ? ""
      : n.length === 1
        ? `Ses. ${n[0]}`
        : `Ses. ${n[0]}–${n[n.length - 1]} · double class`;
  if (c.kind === "async") return ses ? `${ses} · async` : "Async";
  if (c.kind === "exam" || c.is_exam_slot) return "Exam";
  return ses;
}

type Props = {
  today: string;
  sessions: WeekClass[];
  courses: WeekCourse[];
  skips: WeekSkip[];
  checkedThisWeek: boolean;
};

// Today's classes with a Skipped switch. Async classes show on their own day;
// exams and exam slots show without a switch. Then the Sunday weekly check.
export function TodayList({
  today,
  sessions,
  courses,
  skips,
  checkedThisWeek,
}: Props) {
  const names = new Map(courses.map((c) => [c.id, c.name]));
  const all = dedupeClasses(sessions).filter((c) => names.has(c.course_id));
  const todays = all.filter(
    (c) => madridDate(c.starts_at) === today && c.kind !== "deadline",
  );
  const linked = new Set(skips.map((s) => s.class_session_id));

  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  const week = weekRange(today);
  const toCheck = all.filter(
    (c) =>
      skippable(c) &&
      madridDate(c.starts_at) >= week.from &&
      madridDate(c.starts_at) <= today &&
      !linked.has(c.id),
  ).length;

  return (
    <>
      {isSunday && !checkedThisWeek && toCheck > 0 && (
        <section
          aria-label="Weekly check"
          className="mt-5 grid gap-2 rounded-xl border border-line bg-surface px-4 py-3"
        >
          <p className="m-0">
            Skipped anything else this week? {toCheck}{" "}
            {toCheck === 1 ? "class" : "classes"} left to check.
          </p>
          <form action={weeklyAllGood}>
            <input type="hidden" name="week" value={weekStart(today)} />
            <button className="min-h-11 rounded-xl border border-line-input px-4 font-semibold">
              All good
            </button>
          </form>
        </section>
      )}
      {todays.length > 0 && (
        <section aria-labelledby="today-h" className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 id="today-h" className="text-lg font-bold">
              Today
            </h2>
            <span className="text-sm text-muted">Missed?</span>
          </div>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
            {todays.map((c) => {
              const on = linked.has(c.id);
              const name = names.get(c.course_id)!;
              return (
                <li
                  key={c.id}
                  data-testid="today-class"
                  className="flex items-center gap-3 px-4 py-2"
                >
                  <span className="w-12 text-sm text-muted tabular-nums">
                    {time(c.starts_at)}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="font-semibold">{name}</span>
                    <span className="text-sm text-muted">
                      {sessionLine(c)}
                      {on ? " · missed" : ""}
                    </span>
                  </span>
                  {skippable(c) && (
                    <form action={toggleSkipped}>
                      <input type="hidden" name="class" value={c.id} />
                      <button
                        role="switch"
                        aria-checked={on}
                        aria-label={`Skipped ${name}`}
                        className="flex min-h-11 min-w-11 items-center justify-center"
                      >
                        <span
                          aria-hidden="true"
                          className={`relative h-7 w-12 rounded-full ${on ? "bg-primary" : "bg-[var(--switch-off)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface ${on ? "left-[22px]" : "left-0.5"}`}
                          />
                        </span>
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
