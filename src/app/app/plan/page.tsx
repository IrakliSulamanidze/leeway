import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";
import { loadFeeds, loadWeekData, requestTime } from "@/lib/calendar/load";
import { NoCalendar } from "@/components/no-calendar";
import { TripResult } from "@/components/trip-result";
import {
  canISkip,
  ifYouHaveToMissOne,
  leftOutLine,
  madridDate,
  weekRange,
  type WeekRow,
} from "@/lib/rules/week";
import { markTest } from "../calendar/actions";

export const metadata = { title: "Plan a trip" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const costColor = (left: number) =>
  left <= 0 ? "var(--danger)" : left === 1 ? "var(--warn)" : "var(--safe)";

function Rows({ rows }: { rows: WeekRow[] }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {rows.map((r) => (
        <li
          key={r.cls.id}
          data-testid="plan-class"
          className="flex items-center gap-3 px-4 py-2"
        >
          <span className="w-14 text-sm text-muted">{r.day}</span>
          <span className="grid min-w-0 flex-1">
            <span className="font-semibold">{r.course}</span>
            <span className="text-sm text-muted">
              {r.testDay
                ? (r.test ?? "Test day")
                : r.planned
                  ? "Already planned"
                  : r.cls.session_numbers.length
                    ? `Ses. ${r.cls.session_numbers.join("–")}`
                    : "Class"}
            </span>
          </span>
          {r.planned ? (
            <span className="text-sm text-muted">Planned</span>
          ) : (
            <span
              className="text-sm font-semibold"
              style={{ color: costColor(r.leftAfter) }}
            >
              {r.leftAfter} left after
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function MarkTests({ courses }: { courses: { id: string; name: string }[] }) {
  return (
    <form action={markTest} className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm">
          Course
          <select
            name="course"
            className="min-h-11 rounded-xl border border-line-input bg-surface px-2 text-[17px]"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Test day
          <input
            type="date"
            name="date"
            required
            className="min-h-11 rounded-xl border border-line-input bg-surface px-2 text-[17px]"
          />
        </label>
      </div>
      <button className="min-h-11 rounded-xl border border-line-input px-4 font-semibold">
        Mark test day
      </button>
    </form>
  );
}

export default async function PlanPage({
  searchParams,
}: PageProps<"/app/plan">) {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  if ((await loadFeeds()).length === 0)
    return (
      <NoCalendar title="Plan a trip">
        <p className="m-0 text-muted">
          Pick the days you&apos;ll be away and see what each course has left.
        </p>
      </NoCalendar>
    );

  const today = madridDate(new Date(requestTime()).toISOString());
  const week = weekRange(today);
  const sp = await searchParams;
  const from = typeof sp.from === "string" && DATE.test(sp.from) ? sp.from : "";
  const to = typeof sp.to === "string" && DATE.test(sp.to) ? sp.to : "";
  // Dates picked the wrong way round still check the same days.
  const trip =
    from && to ? (from <= to ? { from, to } : { from: to, to: from }) : null;

  const data = await loadWeekData(trip ?? week);
  const thisWeek = trip ? await loadWeekData(week) : data;
  const args = [
    thisWeek.sessions,
    thisWeek.courses,
    thisWeek.skips,
    thisWeek.assessments,
  ] as const;
  // Days already gone can't be skipped any more.
  const missOne = ifYouHaveToMissOne({ from: today, to: week.to }, ...args);
  const skipWeek = canISkip(week, ...args);
  const tripCheck = trip
    ? canISkip(trip, data.sessions, data.courses, data.skips, data.assessments)
    : null;
  const leftOut = leftOutLine(missOne.leftOut);

  return (
    <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-8 px-5 py-6">
      <section aria-labelledby="trip-h" className="grid gap-3">
        <h1 id="trip-h" className="text-[28px] font-bold">
          Plan a trip
        </h1>
        <form method="get" className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              required
              className="min-h-11 rounded-xl border border-line-input bg-surface px-2 text-[17px]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              required
              className="min-h-11 rounded-xl border border-line-input bg-surface px-2 text-[17px]"
            />
          </label>
          <button
            className={`col-span-2 min-h-11 rounded-xl px-4 font-semibold ${tripCheck ? "border border-line-input" : "bg-primary text-on-primary"}`}
          >
            Check these dates
          </button>
        </form>
        {tripCheck && <TripResult {...tripCheck} allCourses={data.courses} />}
      </section>

      <section aria-labelledby="week-h" className="grid gap-3">
        <h2 id="week-h" className="text-xl font-bold">
          Can I skip this week?
        </h2>
        <p data-testid="week-verdict" className="m-0 font-semibold">
          {skipWeek.verdict}
        </p>
      </section>

      <section aria-labelledby="miss-h" className="grid gap-3">
        <h2 id="miss-h" className="text-xl font-bold">
          If you have to miss one
        </h2>
        {missOne.options.length > 0 ? (
          <Rows rows={missOne.options} />
        ) : (
          <p className="m-0">No class to suggest this week.</p>
        )}
        {leftOut && <p className="m-0 text-sm text-muted">{leftOut}</p>}
      </section>

      {thisWeek.courses.length > 0 && (
        <section aria-labelledby="tests-h" className="grid gap-3">
          <h2 id="tests-h" className="text-xl font-bold">
            Test days
          </h2>
          <MarkTests courses={thisWeek.courses} />
        </section>
      )}
    </main>
  );
}
