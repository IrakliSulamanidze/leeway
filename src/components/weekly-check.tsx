import { toggleSkipped, weeklyAllGood } from "@/app/app/calendar/actions";
import {
  dayLabel,
  dedupeClasses,
  isPlanned,
  madridDate,
  skippable,
  weekRange,
  weekStart,
  type WeekClass,
  type WeekCourse,
  type WeekSkip,
} from "@/lib/rules/week";

// From Sunday: the week's earlier classes with a Skipped switch, closed by
// "All good". Catches a skip nobody logged.
export function WeeklyCheck({
  today,
  sessions,
  courses,
  skips,
  checked,
}: {
  today: string;
  sessions: WeekClass[];
  courses: WeekCourse[];
  skips: WeekSkip[];
  checked: boolean;
}) {
  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  if (!isSunday || checked) return null;
  const names = new Map(courses.map((c) => [c.id, c.name]));
  const week = weekRange(today);
  const earlier = dedupeClasses(sessions).filter(
    (c) =>
      names.has(c.course_id) &&
      skippable(c) &&
      madridDate(c.starts_at) >= week.from &&
      madridDate(c.starts_at) < today,
  );
  if (earlier.length === 0) return null;
  return (
    <section
      aria-labelledby="weekly-h"
      className="grid gap-2 rounded-xl border border-line bg-surface py-3"
    >
      <h2 id="weekly-h" className="m-0 px-4 font-semibold">
        Skipped anything else this week?
      </h2>
      <ul className="m-0 divide-y divide-line p-0">
        {earlier.map((c) => {
          const on = isPlanned(c, skips);
          const name = names.get(c.course_id)!;
          const when = dayLabel(c.starts_at);
          return (
            <li
              key={c.id}
              data-testid="weekly-class"
              className="flex items-center gap-3 px-4 py-1"
            >
              <span className="w-14 text-sm text-muted">{when}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {name}
              </span>
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
            </li>
          );
        })}
      </ul>
      <form action={weeklyAllGood} className="px-4">
        <input type="hidden" name="week" value={weekStart(today)} />
        <button className="min-h-11 rounded-xl border border-line-input px-4 font-semibold">
          All good
        </button>
      </form>
    </section>
  );
}
