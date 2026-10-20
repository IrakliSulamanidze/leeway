import {
  markTest,
  toggleSkipped,
  weeklyAllGood,
} from "@/app/app/calendar/actions";
import {
  dedupeClasses,
  isPlanned,
  isTestDay,
  type WeekAssessment,
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

const weekday = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
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

// One class with its Skipped switch. Exams and exam slots get no switch.
function ClassRow({
  c,
  name,
  on,
  when,
  testId,
  testDay,
}: {
  testDay?: boolean;
  c: WeekClass;
  name: string;
  on: boolean;
  when: string;
  testId: string;
}) {
  return (
    <li data-testid={testId} className="flex items-center gap-3 px-4 py-2">
      <span className="w-12 text-sm text-muted tabular-nums">{when}</span>
      <span className="grid min-w-0 flex-1">
        <span className="font-semibold">{name}</span>
        <span className="text-sm text-muted">
          {sessionLine(c)}
          {testDay ? " · Test day" : ""}
          {on ? " · missed" : ""}
        </span>
      </span>
      {testDay === false && skippable(c) && (
        <form action={markTest}>
          <input type="hidden" name="course" value={c.course_id} />
          <input type="hidden" name="class" value={c.id} />
          <button
            aria-label={`Mark a test in ${name} ${when}`}
            className="min-h-11 min-w-11 px-2 text-sm text-muted underline"
          >
            Test
          </button>
        </form>
      )}
      {skippable(c) && (
        <form action={toggleSkipped}>
          <input type="hidden" name="class" value={c.id} />
          <button
            role="switch"
            aria-checked={on}
            aria-label={`Skipped ${name} ${when}`}
            className="flex min-h-11 min-w-11 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={`relative h-7 w-12 rounded-full ${on ? "bg-primary" : "bg-used"}`}
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
}

type Props = {
  today: string;
  sessions: WeekClass[];
  courses: WeekCourse[];
  skips: WeekSkip[];
  assessments: WeekAssessment[];
  checkedThisWeek: boolean;
};

// Today's classes with a Skipped switch (async ones on their own day), and from
// Sunday the weekly check: the week's earlier classes, closed by "All good".
export function TodayList({
  today,
  sessions,
  courses,
  skips,
  assessments,
  checkedThisWeek,
}: Props) {
  const names = new Map(courses.map((c) => [c.id, c.name]));
  const all = dedupeClasses(sessions).filter((c) => names.has(c.course_id));
  const todays = all.filter(
    (c) => madridDate(c.starts_at) === today && c.kind !== "deadline",
  );

  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  const week = weekRange(today);
  const earlier = all.filter(
    (c) =>
      skippable(c) &&
      madridDate(c.starts_at) >= week.from &&
      madridDate(c.starts_at) < today,
  );

  return (
    <>
      {isSunday && !checkedThisWeek && earlier.length > 0 && (
        <section
          aria-labelledby="weekly-h"
          className="mt-5 grid gap-2 rounded-xl border border-line bg-surface py-3"
        >
          <h2 id="weekly-h" className="m-0 px-4 font-semibold">
            Skipped anything else this week?
          </h2>
          <ul className="divide-y divide-line">
            {earlier.map((c) => (
              <ClassRow
                key={c.id}
                c={c}
                name={names.get(c.course_id)!}
                on={isPlanned(c, skips)}
                when={weekday(c.starts_at)}
                testId="weekly-class"
              />
            ))}
          </ul>
          <form action={weeklyAllGood} className="px-4">
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
            {todays.map((c) => (
              <ClassRow
                key={c.id}
                c={c}
                name={names.get(c.course_id)!}
                on={isPlanned(c, skips)}
                when={c.kind === "async" ? "Online" : time(c.starts_at)}
                testId="today-class"
                testDay={isTestDay(c, assessments)}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
