import { TERM } from "@/lib/config";
import { addDays, madridToday, weekOfTerm, weeksToGo } from "@/lib/rules/dates";
import {
  type CourseRow,
  type Pace,
  type SkipRow,
  livesFor,
  livesLeft,
  paceLabel,
  sessionsFor,
} from "@/lib/rules/lives";
import Link from "next/link";
import { CourseNumbers } from "./course-numbers";
import { HeartLegend, Hearts } from "./hearts";

export type CourseView = {
  id: string;
  name: string;
  lives: number;
  left: number;
  planned: number;
  pace: Pace;
  weeksToGo: number;
  estimated: boolean;
  sessions: number;
  missedBefore: number;
};

export const PACE_WORDS: Record<Pace, string> = {
  over: "Over the limit",
  out: "Out of lives",
  last: "Last life",
  burning: "Burning fast",
  safe: "Safe",
  "attendance-safe": "Attendance safe",
};

export const PACE_COLOR: Record<Pace, string> = {
  over: "text-danger",
  out: "text-danger",
  last: "text-danger",
  burning: "text-warn",
  safe: "text-safe",
  "attendance-safe": "text-safe",
};

// Derives lives, lives left and the pace label for every course, sorted by
// fewest lives left. Nothing here is stored.
export function courseViews(
  courses: (CourseRow & { name: string })[],
  skips: SkipRow[],
  today: string = madridToday(),
  remaining?: Map<string, number>,
): CourseView[] {
  const toGo = weeksToGo(today, TERM.end);
  const week = weekOfTerm(today, TERM.start);
  const since = addDays(today, -28);
  return courses
    .map((c) => {
      const { sessions, estimated } = sessionsFor(c);
      const lives = livesFor(sessions);
      const { left, planned } = livesLeft(c, skips, today);
      const recent = skips.filter(
        (s) =>
          s.course_id === c.id && s.skip_date > since && s.skip_date <= today,
      ).length;
      const pace = paceLabel({
        left,
        lives,
        skipsLast4Weeks: recent,
        weekOfTerm: week,
        weeksToGo: toGo,
        remainingClasses: remaining?.get(c.id),
      });
      return {
        id: c.id,
        name: c.name,
        lives,
        left,
        planned,
        pace,
        weeksToGo: toGo,
        estimated,
        sessions,
        missedBefore: c.missed_before,
      };
    })
    .sort((a, b) => a.left - b.left || a.name.localeCompare(b.name));
}

function weeksText(n: number) {
  return `${n} ${n === 1 ? "week" : "weeks"} to go`;
}

// "Estimated · 8 weeks to go" etc. Shared with the course page header.
export function courseMeta(c: CourseView) {
  return (
    <>
      <span className={`font-semibold ${PACE_COLOR[c.pace]}`}>
        {PACE_WORDS[c.pace]}
      </span>{" "}
      · {weeksText(c.weeksToGo)}
      {c.planned > 0 && ` · ${c.planned} planned`}
      {c.estimated && " · estimated"}
    </>
  );
}

// `linked` (on /app): names open the course page, and a new course's card
// shows the inline sessions row until its number is set.
export function CourseList({
  courses,
  linked = false,
}: {
  courses: CourseView[];
  linked?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <ul>
        {courses.map((c) => (
          <li
            key={c.id}
            data-course={c.name}
            className="grid gap-2.5 border-t border-line px-4 py-3.5 first:border-t-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid min-w-0 gap-[3px]">
                {linked ? (
                  <Link
                    href={`/app/courses/${c.id}`}
                    className="-my-2.5 min-w-11 py-2.5 text-[17px] font-semibold [overflow-wrap:anywhere]"
                  >
                    {c.name}
                  </Link>
                ) : (
                  <span className="text-[17px] font-semibold [overflow-wrap:anywhere]">
                    {c.name}
                  </span>
                )}
                <span className="text-sm text-muted">{courseMeta(c)}</span>
              </div>
              <div className="flex-none text-right leading-none tabular-nums">
                <b
                  className={`block text-[34px] font-bold tracking-tight ${PACE_COLOR[c.pace]}`}
                >
                  {c.left}
                </b>{" "}
                <small className="text-[12.5px] text-muted">
                  of {c.lives} left
                </small>
              </div>
            </div>
            <Hearts lives={c.lives} left={c.left} planned={c.planned} />
            {linked && c.estimated && (
              <CourseNumbers
                id={c.id}
                name={c.name}
                sessions={c.sessions}
                missedBefore={c.missedBefore}
              />
            )}
          </li>
        ))}
      </ul>
      <HeartLegend />
    </div>
  );
}
