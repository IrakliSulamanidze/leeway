import { toggleSkipped } from "@/app/app/calendar/actions";
import { PlanClassButton } from "./plan-class-button";
import {
  classCost,
  dedupeClasses,
  isPlanned,
  isTestDay,
  madridDate,
  skippable,
  type WeekAssessment,
  type WeekClass,
  type WeekCourse,
  type WeekSkip,
} from "@/lib/rules/week";

export type DayData = {
  sessions: WeekClass[];
  courses: WeekCourse[];
  skips: WeekSkip[];
  assessments: WeekAssessment[];
};

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const costColor = (left: number) =>
  left <= 0 ? "text-danger" : left === 1 ? "text-warn" : "text-safe";

function sessionText(c: WeekClass): string {
  const n = c.session_numbers;
  const ses =
    n.length === 0
      ? ""
      : n.length === 1
        ? `Session ${n[0]}`
        : `Sessions ${n[0]}–${n[n.length - 1]}`;
  if (c.kind === "async") return ses ? `${ses} · online` : "Online";
  if (c.kind === "exam" || c.is_exam_slot) return "Exam";
  return ses;
}

// One day of classes. Each class says what skipping it would leave, and the
// button does the obvious thing for its day: plan a skip ahead, or mark a
// class already taught as missed. Test days are never offered as a skip.
export function ScheduleDay({
  day,
  today,
  data,
  empty = "No classes.",
}: {
  day: string;
  today: string;
  data: DayData;
  empty?: string;
}) {
  const course = new Map(data.courses.map((c) => [c.id, c]));
  const classes = dedupeClasses(data.sessions)
    .filter(
      (c) =>
        madridDate(c.starts_at) === day &&
        c.kind !== "deadline" &&
        course.has(c.course_id),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (classes.length === 0)
    return <p className="m-0 px-1 text-sm text-muted">{empty}</p>;

  const ahead = day > today;
  return (
    <div className="grid gap-1">
      {!ahead && classes.some(skippable) && (
        <p className="m-0 pr-3 text-right text-[13px] text-muted">Missed it?</p>
      )}
      <ul className="m-0 overflow-hidden rounded-xl border border-line bg-surface p-0">
        {classes.map((c) => {
          const info = course.get(c.course_id)!;
          const test = isTestDay(c, data.assessments);
          const taken = isPlanned(c, data.skips);
          const canSkip = skippable(c);
          const after = info.left - classCost(c);
          const note = test ? (
            <b className="font-semibold text-ink">Test day</b>
          ) : !canSkip ? null : taken ? (
            <span className="font-semibold text-ink">
              {ahead ? "Planned skip" : "Missed"}
            </span>
          ) : ahead ? (
            <span>
              If skipped:{" "}
              <b
                className={`font-semibold whitespace-nowrap ${costColor(after)}`}
              >
                {after < 0 ? "over the limit" : `${after} left`}
              </b>
            </span>
          ) : null;
          const label = `${info.name} ${time(c.starts_at)}`;
          const ses = sessionText(c);
          return (
            <li
              key={c.id}
              data-testid="schedule-class"
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-2.5 first:border-t-0"
            >
              <span className="w-11 flex-none text-sm text-muted tabular-nums">
                {time(c.starts_at)}
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-semibold">{info.name}</span>
                <span className="text-sm text-muted">
                  {ses}
                  {ses && note ? " · " : ""}
                  {note}
                </span>
              </span>
              {canSkip && !test && ahead && (
                <PlanClassButton
                  classId={c.id}
                  label={label}
                  taken={taken}
                  risk={after < 0 ? "over" : after === 0 ? "last" : null}
                />
              )}
              {canSkip && !ahead && (
                <form action={toggleSkipped}>
                  <input type="hidden" name="class" value={c.id} />
                  <button
                    role="switch"
                    aria-checked={taken}
                    aria-label={`Missed ${label}`}
                    className="flex min-h-11 min-w-11 items-center justify-center"
                  >
                    <span
                      aria-hidden="true"
                      className={`relative h-7 w-12 rounded-full ${taken ? "bg-primary" : "bg-used"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface ${taken ? "left-[22px]" : "left-0.5"}`}
                      />
                    </span>
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
