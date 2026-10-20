import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";
import { loadFeeds, loadWeekData, requestTime } from "@/lib/calendar/load";
import { NoCalendar } from "@/components/no-calendar";
import {
  canISkip,
  ifYouHaveToMissOne,
  leftOutLine,
  madridDate,
  weekRange,
  type WeekRow,
} from "@/lib/rules/week";
import { markTest, saveTrip } from "../calendar/actions";

export const metadata = { title: "Plan" };

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
                ? "Test day"
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
      <NoCalendar title="Plan your skips">
        <p className="m-0 text-muted">
          See which class this week is the cheapest to miss, whether a trip away
          is safe, and save the skips ahead of time.
        </p>
      </NoCalendar>
    );

  const today = madridDate(new Date(requestTime()).toISOString());
  const week = weekRange(today);
  const sp = await searchParams;
  const from = typeof sp.from === "string" && DATE.test(sp.from) ? sp.from : "";
  const to = typeof sp.to === "string" && DATE.test(sp.to) ? sp.to : "";
  const trip = from && to && from <= to ? { from, to } : null;

  const data = await loadWeekData(trip ?? week);
  const thisWeek = trip ? await loadWeekData(week) : data;
  const args = [
    thisWeek.sessions,
    thisWeek.courses,
    thisWeek.skips,
    thisWeek.assessments,
  ] as const;
  const missOne = ifYouHaveToMissOne(week, ...args);
  const skipWeek = canISkip(week, ...args);
  const tripCheck = trip
    ? canISkip(trip, data.sessions, data.courses, data.skips, data.assessments)
    : null;
  const leftOut = leftOutLine(missOne.leftOut);
  const needsMarks = skipWeek.state === "mark" || tripCheck?.state === "mark";

  return (
    <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-6 px-5 py-6">
      <section aria-labelledby="miss-h" className="grid gap-3">
        <h1 id="miss-h" className="text-[28px] font-bold">
          If you have to miss one
        </h1>
        <p className="m-0 text-sm text-muted">
          This week&apos;s classes, by what they cost. Test days and last lives
          are left out.
        </p>
        {missOne.options.length > 0 ? (
          <Rows rows={missOne.options} />
        ) : (
          <p className="m-0">No class to suggest this week.</p>
        )}
        {leftOut && <p className="m-0 text-sm text-muted">{leftOut}</p>}
      </section>

      <section aria-labelledby="week-h" className="grid gap-3">
        <h2 id="week-h" className="text-xl font-bold">
          Can I skip this week?
        </h2>
        <p data-testid="week-verdict" className="m-0 font-semibold">
          {skipWeek.verdict}
        </p>
      </section>

      <section aria-labelledby="trip-h" className="grid gap-3">
        <h2 id="trip-h" className="text-xl font-bold">
          Trip check
        </h2>
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
          <button className="col-span-2 min-h-11 rounded-xl border border-line-input px-4 font-semibold">
            Check these dates
          </button>
        </form>
        {tripCheck && (
          <>
            <p data-testid="trip-verdict" className="m-0 font-semibold">
              {tripCheck.verdict}
            </p>
            {tripCheck.classes.length > 0 && <Rows rows={tripCheck.classes} />}
            {tripCheck.classes.some((r) => !r.planned) && (
              <form action={saveTrip} className="grid gap-2">
                {tripCheck.classes
                  .filter((r) => !r.planned)
                  .map((r) => (
                    <input
                      key={r.cls.id}
                      type="hidden"
                      name="class"
                      value={r.cls.id}
                    />
                  ))}
                <button className="min-h-[52px] rounded-xl bg-primary px-4 font-semibold text-on-primary">
                  Save as planned skips
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {(needsMarks || thisWeek.courses.length > 0) && (
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
