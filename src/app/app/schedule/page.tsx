import Link from "next/link";
import { redirect } from "next/navigation";
import { NoCalendar } from "@/components/no-calendar";
import { ScheduleDay } from "@/components/schedule-day";
import { loadFeeds, loadWeekData, requestTime } from "@/lib/calendar/load";
import { addDays } from "@/lib/rules/dates";
import { madridDate, weekRange } from "@/lib/rules/week";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";

export const metadata = { title: "Schedule" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(
    new Date(`${day}T12:00:00Z`),
  );

function dayTitle(day: string, today: string) {
  const date = fmt(day, { weekday: "long", day: "numeric", month: "short" });
  if (day === today) return `Today · ${date}`;
  if (day === addDays(today, 1)) return `Tomorrow · ${date}`;
  return date;
}

// The week's classes, a day at a time, with what each skip would cost.
export default async function SchedulePage({
  searchParams,
}: PageProps<"/app/schedule">) {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  if ((await loadFeeds()).length === 0)
    return (
      <NoCalendar title="Your schedule">
        <p className="m-0 text-muted">
          Every class this week, today and tomorrow first, with what skipping
          each one would cost. Plan a skip or mark a missed class in one tap.
        </p>
      </NoCalendar>
    );

  const today = madridDate(new Date(requestTime()).toISOString());
  const sp = await searchParams;
  const picked =
    typeof sp.week === "string" && DATE.test(sp.week) ? sp.week : today;
  const week = weekRange(picked);
  const thisWeek = week.from === weekRange(today).from;
  const data = await loadWeekData(week);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.from, i));
  const hasClasses = new Set(data.sessions.map((c) => madridDate(c.starts_at)));
  // This week starts at today; earlier days fold away.
  const shown = thisWeek ? days.filter((d) => d >= today) : days;
  const earlier = thisWeek ? days.filter((d) => d < today) : [];

  const nav =
    "flex min-h-11 items-center rounded-xl px-3 text-[15px] font-semibold";
  return (
    <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-5 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-[28px] font-bold">Schedule</h1>
        <nav aria-label="Weeks" className="flex items-center gap-1">
          <Link
            href={`/app/schedule?week=${addDays(week.from, -7)}`}
            aria-label="Previous week"
            className={`${nav} border border-line-input bg-surface`}
          >
            ‹
          </Link>
          {!thisWeek && (
            <Link href="/app/schedule" className={`${nav} underline`}>
              This week
            </Link>
          )}
          <Link
            href={`/app/schedule?week=${addDays(week.from, 7)}`}
            aria-label="Next week"
            className={`${nav} border border-line-input bg-surface`}
          >
            ›
          </Link>
        </nav>
      </div>

      <ol
        aria-label="Days"
        className="m-0 grid grid-cols-7 gap-1 p-0 text-center"
      >
        {days.map((d) => (
          <li key={d} className="list-none">
            <a
              href={`#d-${d}`}
              aria-current={d === today ? "date" : undefined}
              className={`grid min-h-14 place-content-center rounded-xl text-[13px] ${d === today ? "bg-ink text-on-primary" : d < today ? "text-muted" : "bg-surface"}`}
            >
              {fmt(d, { weekday: "narrow" })}
              <b className="text-[17px]">{fmt(d, { day: "numeric" })}</b>
              <span
                aria-hidden="true"
                className={`mx-auto mt-0.5 h-1 w-1 rounded-full ${hasClasses.has(d) ? (d === today ? "bg-on-primary" : "bg-ink") : ""}`}
              />
            </a>
          </li>
        ))}
      </ol>

      {shown.map((d) => (
        <section key={d} id={`d-${d}`} className="grid scroll-mt-4 gap-2">
          <h2 className="m-0 text-lg font-bold">{dayTitle(d, today)}</h2>
          <ScheduleDay day={d} today={today} data={data} />
        </section>
      ))}

      {earlier.length > 0 && (
        <details className="grid gap-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
            Earlier this week
          </summary>
          {earlier.map((d) => (
            <section key={d} id={`d-${d}`} className="mt-3 grid gap-2">
              <h2 className="m-0 text-lg font-bold">{dayTitle(d, today)}</h2>
              <ScheduleDay day={d} today={today} data={data} />
            </section>
          ))}
        </details>
      )}
    </main>
  );
}
