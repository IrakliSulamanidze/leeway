import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassSheet } from "@/components/class-sheet";
import { NoCalendar } from "@/components/no-calendar";
import { SyncStatus } from "@/components/sync-status";
import { WeeklyCheck } from "@/components/weekly-check";
import { courseColors, ink, tint } from "@/lib/course-color";
import {
  hasUnsyncedCourses,
  loadFeeds,
  loadWeekData,
  requestTime,
} from "@/lib/calendar/load";
import { addDays } from "@/lib/rules/dates";
import { clock, hourRange, lanes, madridMinutes } from "@/lib/rules/grid";
import {
  dedupeClasses,
  isPlanned,
  isTestDay,
  madridDate,
  weekRange,
  weekStart,
  type WeekClass,
} from "@/lib/rules/week";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";

export const metadata = { title: "Calendar" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const HOUR = 56;

type View = "day" | "week" | null;

const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(
    new Date(`${day}T12:00:00Z`),
  );

function href(day: string, view: View, c?: string) {
  const q = new URLSearchParams({ day });
  if (view) q.set("view", view);
  if (c) q.set("c", c);
  return `/app/schedule?${q}`;
}

// Day view shows the picked day only. Week view shows every day. With no
// choice yet: one day on a phone, the week on a laptop.
function shown(view: View, on: boolean, display: "block" | "flex") {
  const laptop = display === "block" ? "hidden lg:block" : "hidden lg:flex";
  if (view === "week") return display;
  if (view === "day") return on ? display : "hidden";
  return on ? display : laptop;
}

// A week of classes on a time grid, a colour per course. Tapping a class opens
// a sheet with what skipping it costs.
export default async function CalendarPage({
  searchParams,
}: PageProps<"/app/schedule">) {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const feeds = await loadFeeds();
  if (feeds.length === 0)
    return (
      <NoCalendar title="Calendar">
        <p className="m-0 text-muted">
          See your week of classes, and tap one to skip it.
        </p>
      </NoCalendar>
    );

  const now = new Date(requestTime()).toISOString();
  const today = madridDate(now);
  const sp = await searchParams;
  const day = typeof sp.day === "string" && DATE.test(sp.day) ? sp.day : today;
  const view: View = sp.view === "day" || sp.view === "week" ? sp.view : null;
  const picked = typeof sp.c === "string" && UUID.test(sp.c) ? sp.c : null;

  const week = weekRange(day);
  const [data, checks, unsynced] = await Promise.all([
    loadWeekData(week),
    supabase
      .from("weekly_checks")
      .select("week_start")
      .eq("week_start", weekStart(today)),
    hasUnsyncedCourses(),
  ]);
  const courses = new Map(data.courses.map((c) => [c.id, c]));
  const colors = courseColors(data.courses);
  const classes = dedupeClasses(data.sessions).filter(
    (c) =>
      c.kind !== "deadline" &&
      courses.has(c.course_id) &&
      madridDate(c.starts_at) >= week.from &&
      madridDate(c.starts_at) <= week.to,
  );
  const allDay = (c: WeekClass) => c.all_day || !c.ends_at;
  const timed = classes
    .filter((c) => !allDay(c))
    .map((c) => ({
      id: c.id,
      start: madridMinutes(c.starts_at),
      end: Math.max(madridMinutes(c.ends_at!), madridMinutes(c.starts_at) + 30),
    }));
  const span = new Map(timed.map((t) => [t.id, t]));
  const hours = hourRange(timed);
  const lane = new Map<string, { lane: number; lanes: number }>();

  const all = Array.from({ length: 7 }, (_, i) => addDays(week.from, i));
  const busy = new Set(classes.map((c) => madridDate(c.starts_at)));
  // Weekends only when something is on, or that day is the one picked.
  const days = all.filter((d, i) => i < 5 || busy.has(d) || d === day);
  const byDay = new Map(
    days.map((d) => {
      const list = classes.filter((c) => madridDate(c.starts_at) === d);
      for (const [id, l] of lanes(
        list.filter((c) => span.has(c.id)).map((c) => span.get(c.id)!),
      ))
        lane.set(id, l);
      return [d, list];
    }),
  );
  const hasAllDay = classes.some(allDay);
  const nowMin = madridMinutes(now);
  const nowTop =
    nowMin >= hours.from * 60 && nowMin <= hours.to * 60
      ? ((nowMin - hours.from * 60) / 60) * HOUR
      : null;

  const sheetClass = picked ? classes.find((c) => c.id === picked) : undefined;
  const pill =
    "flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line-input bg-surface px-3 text-[15px] font-semibold";
  const toggle = (v: "day" | "week") =>
    view === v
      ? "bg-ink text-on-primary"
      : view !== null
        ? ""
        : v === "day"
          ? "bg-ink text-on-primary lg:bg-transparent lg:text-ink"
          : "lg:bg-ink lg:text-on-primary";

  const block = (c: WeekClass, d: string) => {
    const course = courses.get(c.course_id)!;
    const n = colors.get(c.course_id) ?? 8;
    const taken = isPlanned(c, data.skips);
    const test = isTestDay(c, data.assessments);
    const past = c.starts_at <= now;
    const t = span.get(c.id);
    const l = lane.get(c.id) ?? { lane: 0, lanes: 1 };
    const tag = taken
      ? past
        ? "Missed"
        : "Skipping"
      : test
        ? "Test"
        : c.kind === "exam" || c.is_exam_slot
          ? "Exam"
          : null;
    const n0 = c.session_numbers;
    const ses =
      n0.length === 0
        ? ""
        : n0.length === 1
          ? ` · Ses. ${n0[0]}`
          : ` · Ses. ${n0[0]}-${n0[n0.length - 1]}`;
    const style = t
      ? {
          top: ((t.start - hours.from * 60) / 60) * HOUR + 1,
          height: ((t.end - t.start) / 60) * HOUR - 3,
          left: `calc(${(100 / l.lanes) * l.lane}% + 2px)`,
          width: `calc(${100 / l.lanes}% - 4px)`,
        }
      : {};
    return (
      <Link
        key={c.id}
        href={href(d, view, c.id)}
        scroll={false}
        data-testid="schedule-class"
        aria-label={`${course.name}, ${fmt(d, { weekday: "long" })} ${t ? clock(c.starts_at) : "online"}${tag ? `, ${tag.toLowerCase()}` : ""}`}
        className={`${t ? "absolute" : "block"} overflow-hidden rounded-lg border px-2 py-1 text-left text-[12.5px] leading-tight ${taken ? "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(255,255,255,.6)_6px_10px)]" : ""}`}
        style={{
          ...style,
          // A class already taught keeps its colour on the edge only.
          backgroundColor: past && !taken ? "var(--surface)" : tint(n),
          borderColor: tint(n),
          color: ink(n),
        }}
      >
        <b className="line-clamp-2 font-semibold">{course.name}</b>
        <span className="block whitespace-nowrap">
          {t ? clock(c.starts_at) : "Online"}
          {ses}
        </span>
        {tag && (
          <span className="mt-0.5 inline-block rounded bg-surface px-1 text-[11px] font-bold">
            {tag}
          </span>
        )}
      </Link>
    );
  };

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-4 px-4 py-5 lg:px-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="m-0 text-[26px] font-bold">
          {fmt(day, { month: "long", year: "numeric" })}
        </h1>
        <Link href="/app/plan" className={pill} data-tour="trip-button">
          Plan a trip
        </Link>
      </div>
      <div className="-mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={href(addDays(day, -7), view)}
            aria-label="Previous week"
            className={pill}
          >
            ‹
          </Link>
          <Link
            href={href(addDays(day, 7), view)}
            aria-label="Next week"
            className={pill}
          >
            ›
          </Link>
          {day !== today && (
            <Link href={href(today, view)} className={pill}>
              Today
            </Link>
          )}
          <span className="mx-1 flex rounded-xl border border-line-input p-0.5">
            <Link
              href={href(day, "day")}
              className={`flex min-h-11 items-center rounded-[10px] px-3 text-[15px] font-semibold ${toggle("day")}`}
            >
              Day
            </Link>
            <Link
              href={href(day, "week")}
              className={`flex min-h-11 items-center rounded-[10px] px-3 text-[15px] font-semibold ${toggle("week")}`}
            >
              Week
            </Link>
          </span>
        </div>
      </div>

      <WeeklyCheck
        today={today}
        sessions={data.sessions}
        courses={data.courses}
        skips={data.skips}
        checked={(checks.data ?? []).length > 0}
      />

      <nav
        aria-label="Days"
        className={`${view === "week" ? "hidden" : view === "day" ? "grid" : "grid lg:hidden"} grid-cols-7 gap-1 text-center`}
      >
        {all.map((d) => (
          <Link
            key={d}
            href={href(d, view)}
            aria-current={d === day ? "date" : undefined}
            className="grid min-h-14 justify-items-center gap-0.5 text-xs text-muted"
          >
            {fmt(d, { weekday: "short" })}
            <b
              className={`grid h-8 w-8 place-items-center rounded-full text-base font-semibold ${d === day ? "bg-ink text-on-primary" : "text-ink"} ${d === today ? "ring-2 ring-danger" : ""}`}
            >
              {fmt(d, { day: "numeric" })}
            </b>
            <i
              aria-hidden="true"
              className={`h-1 w-1 rounded-full ${busy.has(d) ? "bg-muted" : ""}`}
            />
          </Link>
        ))}
      </nav>

      {unsynced && classes.length === 0 ? (
        <section
          role="status"
          data-tour="grid"
          className="grid justify-items-center gap-2 rounded-xl border border-line bg-surface px-5 py-12 text-center"
        >
          <span
            aria-hidden="true"
            className="h-6 w-6 animate-spin rounded-full border-2 border-line-input border-t-ink motion-reduce:animate-none"
          />
          <b className="text-lg">Loading your classes</b>
          <span className="text-muted">
            The first time takes about a minute.
          </span>
        </section>
      ) : (
        <div
          className="rounded-xl border border-line bg-surface"
          data-tour="grid"
        >
          <div
            className={`${view === "day" ? "hidden" : view === "week" ? "flex" : "hidden lg:flex"} border-b border-line pl-12`}
          >
            {days.map((d) => (
              <Link
                key={d}
                href={href(d, "day")}
                className="grid min-w-0 flex-1 justify-items-center py-2 text-xs text-muted"
              >
                {fmt(d, { weekday: "short" })}
                <b
                  className={`text-xl font-semibold ${d === today ? "text-danger" : "text-ink"}`}
                >
                  {fmt(d, { day: "numeric" })}
                </b>
              </Link>
            ))}
          </div>
          {hasAllDay && (
            <div className="flex border-b border-line pl-12">
              {days.map((d) => (
                <div
                  key={d}
                  className={`${shown(view, d === day, "block")} grid min-w-0 flex-1 content-start gap-1 p-1`}
                >
                  {(byDay.get(d) ?? []).filter(allDay).map((c) => block(c, d))}
                </div>
              ))}
            </div>
          )}
          <div
            className="relative flex"
            style={{ height: (hours.to - hours.from) * HOUR + 12 }}
          >
            <div className="relative w-12 flex-none">
              {Array.from({ length: hours.to - hours.from + 1 }, (_, i) => (
                <span
                  key={i}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular-nums"
                  style={{ top: i * HOUR + 6 }}
                >
                  {String(hours.from + i).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((d) => (
              <div
                key={d}
                data-day={d}
                className={`${shown(view, d === day, "block")} relative min-w-0 flex-1 border-l border-line`}
                style={{
                  marginTop: 6,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${HOUR}px)`,
                }}
              >
                {(byDay.get(d) ?? [])
                  .filter((c) => !allDay(c))
                  .map((c) => block(c, d))}
                {d === today && nowTop !== null && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 h-0.5 bg-danger before:absolute before:-top-1 before:-left-1 before:h-2.5 before:w-2.5 before:rounded-full before:bg-danger"
                    style={{ top: nowTop }}
                  />
                )}
                {(byDay.get(d) ?? []).length === 0 && (
                  <p className="m-0 p-3 text-sm text-muted">No classes</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SyncStatus feeds={feeds} now={requestTime()} unsynced={unsynced} />
      </div>

      {sheetClass && (
        <ClassSheet
          cls={sheetClass}
          course={courses.get(sheetClass.course_id)!}
          color={colors.get(sheetClass.course_id) ?? 8}
          skips={data.skips}
          assessments={data.assessments}
          now={now}
          closeHref={href(day, view)}
        />
      )}
    </main>
  );
}
