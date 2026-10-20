import Link from "next/link";
import { saveTrip } from "@/app/app/calendar/actions";
import { courseColors, ink } from "@/lib/course-color";
import { clock } from "@/lib/rules/grid";
import type { TripCourse, Verdict, WeekRow } from "@/lib/rules/week";
import { Heart } from "./hearts";

const tone: Record<Verdict, string> = {
  none: "var(--muted)",
  safe: "var(--safe)",
  last: "var(--warn)",
  out: "var(--danger)",
  test: "var(--danger)",
};

const leftColor = (n: number) =>
  n <= 0 ? "text-danger" : n === 1 ? "text-warn" : "text-safe";

// Hearts the trip keeps (filled) and the ones it uses (outline). Too many to
// count at a glance above 10, so the numbers carry it alone.
function TripHearts({ before, after }: { before: number; after: number }) {
  if (before <= 0 || before > 10) return null;
  const keep = Math.max(0, after);
  return (
    <span aria-hidden="true" className="flex flex-wrap gap-1">
      {Array.from({ length: before }, (_, i) => (
        <Heart key={i} kind={i < keep ? "left" : "planned"} size={16} />
      ))}
    </span>
  );
}

function ClassRow({ r }: { r: WeekRow }) {
  const ses = r.cls.session_numbers;
  return (
    <li
      data-testid="plan-class"
      className="flex items-center gap-3 px-4 py-2 text-[15px]"
    >
      <span className="w-12 text-muted">{r.day}</span>
      <span className="min-w-0 flex-1 text-muted">
        {r.cls.all_day ? "All day" : clock(r.cls.starts_at)}
        {ses.length > 0 && ` · Ses. ${ses.join("–")}`}
      </span>
      {r.test ? (
        <span className="rounded-full bg-danger px-2 py-0.5 text-[13px] font-semibold text-on-primary">
          {r.test}
        </span>
      ) : r.planned ? (
        <span className="text-[13px] text-muted">Planned</span>
      ) : (
        <span className="text-[13px] text-muted">
          {r.cost === 2 ? "2 lives" : "1 life"}
        </span>
      )}
    </li>
  );
}

function CourseCard({ c, color }: { c: TripCourse; color: number }) {
  const what =
    c.missing === 0
      ? "Already planned"
      : `Misses ${c.missing} ${c.missing === 1 ? "class" : "classes"}${c.planned ? ` · ${c.planned} planned` : ""}`;
  const changed = c.after !== c.before;
  return (
    <li
      data-testid="trip-course"
      className="rounded-xl border border-line bg-surface"
    >
      <details className="group">
        <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <i
            aria-hidden="true"
            className="h-3 w-3 flex-none rounded-full"
            style={{ background: ink(color) }}
          />
          <span className="grid min-w-0 flex-1 gap-1">
            <b className="[overflow-wrap:anywhere]">{c.name}</b>
            <span className="text-sm text-muted">{what}</span>
            <TripHearts before={c.before} after={c.after} />
          </span>
          <span className="grid justify-items-end">
            <span className="flex items-baseline gap-1.5 tabular-nums">
              {changed && (
                <>
                  <span className="text-[17px] text-muted">{c.before}</span>
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                </>
              )}
              <b className={`text-[24px] ${leftColor(c.after)}`}>
                {c.after < 0 ? `−${-c.after}` : c.after}
              </b>
            </span>
            <span className="text-[13px] text-muted">
              {c.after < 0 ? "over the limit" : "lives left"}
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            className="flex-none text-muted transition-transform group-open:rotate-180"
          >
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </summary>
        <ul className="m-0 divide-y divide-line border-t border-line p-0">
          {c.rows.map((r) => (
            <ClassRow key={r.cls.id} r={r} />
          ))}
        </ul>
      </details>
      {c.tests.length > 0 && (
        <p className="m-0 flex flex-wrap gap-x-3 border-t border-line px-4 py-2 text-[15px] font-semibold text-danger">
          {c.tests.map((t) => (
            <span key={t.day + t.title}>
              {t.title} on {t.day}
            </span>
          ))}
        </p>
      )}
      {c.noTests && (
        <p className="m-0 flex items-center justify-between gap-3 border-t border-line px-4 text-sm text-muted">
          No test dates marked yet.
          <Link
            href={`/app/courses/${c.id}`}
            className="flex min-h-11 items-center font-semibold text-ink underline"
          >
            Add them
          </Link>
        </p>
      )}
    </li>
  );
}

// Trip check answer: one verdict, then a card per course with lives before
// and after and any test in the dates. Tap a card for its classes.
export function TripResult({
  lead,
  detail,
  state,
  courses,
  classes,
  allCourses,
}: {
  lead: string;
  detail: string;
  state: Verdict;
  courses: TripCourse[];
  classes: WeekRow[];
  allCourses: { id: string; name: string }[];
}) {
  const colors = courseColors(allCourses);
  const toSave = classes.filter((r) => !r.planned);
  const lives = toSave.reduce((n, r) => n + r.cost, 0);
  return (
    <div className="grid gap-3">
      <p
        data-testid="trip-verdict"
        className="m-0 grid gap-0.5 rounded-xl border-l-4 bg-surface px-4 py-3"
        style={{ borderLeftColor: tone[state] }}
      >
        <b className="text-[20px]">{lead}</b>{" "}
        {detail && (
          <span
            className="text-[17px] font-semibold"
            style={{ color: tone[state] }}
          >
            {detail}
          </span>
        )}
      </p>
      {courses.length > 0 && (
        <ul className="m-0 grid gap-2 p-0">
          {courses.map((c) => (
            <CourseCard key={c.id} c={c} color={colors.get(c.id) ?? 8} />
          ))}
        </ul>
      )}
      {toSave.length > 0 && (
        <form action={saveTrip} className="grid gap-1.5">
          {toSave.map((r) => (
            <input key={r.cls.id} type="hidden" name="class" value={r.cls.id} />
          ))}
          <button className="min-h-[52px] rounded-xl bg-primary px-4 text-[17px] font-semibold text-on-primary">
            Save as planned skips
          </button>
          <p className="m-0 text-center text-sm text-muted">
            Uses {lives} {lives === 1 ? "life" : "lives"}. Undo any of them from
            the calendar.
          </p>
        </form>
      )}
    </div>
  );
}
