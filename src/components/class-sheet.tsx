import Link from "next/link";
import {
  markTest,
  toggleSkipped,
  unmarkTest,
} from "@/app/app/calendar/actions";
import { ink } from "@/lib/course-color";
import { clock } from "@/lib/rules/grid";
import {
  classCost,
  isPlanned,
  isTestDay,
  madridDate,
  skippable,
  type WeekAssessment,
  type WeekClass,
  type WeekCourse,
  type WeekSkip,
} from "@/lib/rules/week";
import { PlanClassButton } from "./plan-class-button";

const DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function sessionText(c: WeekClass): string {
  const n = c.session_numbers;
  if (c.kind === "exam" || c.is_exam_slot) return "Exam";
  if (c.kind === "extra") return "Extra session";
  const ses =
    n.length === 0
      ? ""
      : n.length === 1
        ? `Session ${n[0]}`
        : `Sessions ${n[0]} to ${n[n.length - 1]}`;
  if (c.kind === "async") return ses ? `${ses} · online` : "Online";
  return ses;
}

const costColor = (left: number) =>
  left <= 0 ? "text-danger" : left === 1 ? "text-warn" : "text-safe";

const big =
  "flex min-h-[52px] w-full items-center justify-center rounded-xl px-5 text-[17px] font-semibold";

// What one tapped class costs, and the one thing to do about it: skip it
// ahead of time, mark it missed afterwards, or undo either.
export function ClassSheet({
  cls,
  course,
  color,
  skips,
  assessments,
  now,
  closeHref,
}: {
  cls: WeekClass;
  course: WeekCourse;
  color: number;
  skips: WeekSkip[];
  assessments: WeekAssessment[];
  now: string;
  closeHref: string;
}) {
  const started = cls.starts_at <= now;
  const taken = isPlanned(cls, skips);
  const test = isTestDay(cls, assessments);
  const day = madridDate(cls.starts_at);
  // Marked on this class or its date, so "Not a test" can take it back.
  const marked = assessments.some(
    (a) =>
      a.class_session_id === cls.id ||
      (a.course_id === cls.course_id && a.on_date === day),
  );
  const canSkip = skippable(cls);
  const cost = classCost(cls);
  const after = course.left - cost;
  const when = cls.all_day
    ? `${DATE.format(new Date(cls.starts_at))} · all day`
    : `${DATE.format(new Date(cls.starts_at))} · ${clock(cls.starts_at)}${cls.ends_at ? ` to ${clock(cls.ends_at)}` : ""}`;
  const label = `${course.name} ${DATE.format(new Date(cls.starts_at))}`;

  return (
    <div className="fixed inset-0 z-30">
      <Link
        href={closeHref}
        scroll={false}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 bg-ink/30"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-h"
        className="absolute inset-x-0 bottom-0 grid gap-4 rounded-t-2xl bg-surface px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] lg:inset-x-auto lg:top-24 lg:right-8 lg:bottom-auto lg:w-[380px] lg:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <i
            aria-hidden="true"
            className="mt-2 h-3 w-3 flex-none rounded-full"
            style={{ background: ink(color) }}
          />
          <div className="grid min-w-0 gap-0.5">
            <h2
              id="sheet-h"
              className="m-0 text-xl font-bold [overflow-wrap:anywhere]"
            >
              {course.name}
            </h2>
            <p className="m-0 text-sm text-muted">
              {when}
              {sessionText(cls) && ` · ${sessionText(cls)}`}
            </p>
          </div>
        </div>

        {!canSkip ? (
          <p className="m-0">
            {cls.kind === "extra"
              ? "Extra sessions don't count toward the 80% rule."
              : "Exams aren't skippable classes."}
          </p>
        ) : test ? (
          <div className="grid gap-2">
            <p className="m-0 font-semibold">
              Test day. Skip a different class instead.
            </p>
            {marked && (
              <form action={unmarkTest}>
                <input type="hidden" name="course" value={cls.course_id} />
                <input type="hidden" name="class" value={cls.id} />
                <input type="hidden" name="date" value={day} />
                <button className="min-h-11 rounded-xl border border-line-input px-4 font-semibold">
                  Not a test
                </button>
              </form>
            )}
          </div>
        ) : taken ? (
          <p className="m-0 text-[17px]">
            {started ? "Marked as missed." : "You're skipping this one."}{" "}
            <b className={costColor(course.left)}>
              {course.left < 0 ? "Over the limit" : `${course.left} left`}
            </b>
          </p>
        ) : (
          <p
            data-testid="sheet-cost"
            className="m-0 flex items-baseline gap-3 rounded-xl bg-bg px-4 py-3"
          >
            <b className="text-[30px] tabular-nums">{course.left}</b>
            <span aria-hidden="true" className="text-muted">
              →
            </span>
            <b className={`text-[30px] tabular-nums ${costColor(after)}`}>
              {after < 0 ? "over" : after}
            </b>
            <span className="text-sm text-muted">
              {after < 0
                ? "past the 80% limit"
                : started
                  ? "lives left if you missed it"
                  : "lives left if you skip"}
            </span>
          </p>
        )}

        {canSkip && !test && (
          <>
            {!taken && !started && (
              <PlanClassButton
                classId={cls.id}
                label={label}
                risk={after < 0 ? "over" : after === 0 ? "last" : null}
              />
            )}
            {(taken || started) && (
              <form action={toggleSkipped}>
                <input type="hidden" name="class" value={cls.id} />
                <button
                  className={`${big} ${taken ? "border border-line-input bg-surface" : "bg-primary text-on-primary"}`}
                >
                  {taken
                    ? started
                      ? "I was there"
                      : "Undo skip"
                    : "I missed it"}
                </button>
              </form>
            )}
            {started && !taken && (course.missedBefore ?? 0) > 0 && (
              <form action={toggleSkipped}>
                <input type="hidden" name="class" value={cls.id} />
                <input type="hidden" name="counted" value="1" />
                <button
                  className={`${big} border border-line-input bg-surface`}
                >
                  One of the {course.missedBefore} I already counted
                </button>
              </form>
            )}
          </>
        )}

        <div className="flex items-center justify-between gap-3">
          {canSkip && !test ? (
            <form
              action={markTest}
              role="group"
              aria-label="Mark a test in this class"
              className="flex flex-wrap items-center gap-1.5"
            >
              <input type="hidden" name="course" value={cls.course_id} />
              <input type="hidden" name="class" value={cls.id} />
              <span className="text-sm text-muted">Test?</span>
              {["Quiz", "Midterm", "Final"].map((t) => (
                <button
                  key={t}
                  name="title"
                  value={t}
                  className="min-h-11 rounded-full border border-line-input px-3 text-[15px]"
                >
                  {t}
                </button>
              ))}
            </form>
          ) : (
            <span />
          )}
          <Link
            href={closeHref}
            scroll={false}
            className="flex min-h-11 items-center px-2 text-[15px] font-semibold underline"
          >
            Close
          </Link>
        </div>
      </section>
    </div>
  );
}
