import { redirect } from "next/navigation";
import { CourseList, courseViews } from "@/components/course-list";
import { RecentSkips } from "@/components/recent-skips";
import { CalendarHome } from "@/components/calendar-home";
import { RiskLine } from "@/components/risk-line";
import { GetStarted } from "@/components/get-started";
import { SkipForm } from "@/components/skip-form";
import { TERM } from "@/lib/config";
import { syllabusReadEnabled } from "@/lib/server/gemini";
import {
  loadCourseCalendar,
  loadFeeds,
  requestTime,
} from "@/lib/calendar/load";
import { madridToday, weekOfTerm, weeksToGo } from "@/lib/rules/dates";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";

export const metadata = { title: "Your courses" };

const TERM_WEEKS = weekOfTerm(TERM.end, TERM.start);

export default async function AppHome() {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const [{ data: courses }, { data: skips }] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, sessions_typed, sessions_syllabus, sessions_calendar, missed_before",
      ),
    supabase
      .from("skips")
      .select("id, course_id, text_typed, sessions, skip_date, planned")
      .order("created_at", { ascending: false }),
  ]);

  const today = madridToday();
  // With a calendar: "Attendance safe" from the classes still ahead, and courses
  // with no class this term move to a collapsed "Past courses" group.
  const calendar = (await loadFeeds()).length
    ? await loadCourseCalendar(new Date(requestTime()).toISOString(), TERM)
    : null;
  const views = courseViews(
    courses ?? [],
    skips ?? [],
    today,
    calendar?.remaining,
  );
  const past = views.filter((c) => calendar?.thisTerm.get(c.id) === false);
  const current = views.filter((c) => !past.includes(c));
  const week = weekOfTerm(today, TERM.start);
  const setup = (
    <GetStarted
      calendar={calendar !== null}
      syllabus={syllabusReadEnabled()}
      courses={views.length}
      guessed={current
        .filter((c) => c.estimated)
        .map(({ id, name }) => ({ id, name }))}
    />
  );

  return (
    <main className="mx-auto grid w-full max-w-5xl content-start gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12 lg:px-12">
      <h1 className="sr-only">Your courses</h1>
      <div className="grid content-start gap-5">
        <RiskLine courses={views} />
        <SkipForm
          courses={views.map(({ name, lives, left, planned }) => ({
            name,
            lives,
            left,
            planned,
          }))}
          weeksToGo={weeksToGo(today, TERM.end)}
          weekOfTerm={week}
        />
      </div>
      <div className="grid content-start gap-5">
        {views.length === 0 && setup}
        <CalendarHome />
        <section className="grid gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="m-0 text-xl font-bold tracking-tight">
              Your courses
            </h2>
            {week > 0 && week <= TERM_WEEKS && (
              <span className="text-sm text-muted">
                Week {week} of {TERM_WEEKS}
              </span>
            )}
          </div>
          {views.length ? (
            <>
              {current.length > 0 && <CourseList courses={current} linked />}
              {past.length > 0 && (
                <details className="grid gap-3">
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                    Past courses
                  </summary>
                  <CourseList courses={past} linked />
                </details>
              )}
            </>
          ) : (
            <p className="m-0 text-sm text-muted">
              No skips yet. Your courses show up here with their lives.
            </p>
          )}
        </section>
        {views.length > 0 && setup}
        <RecentSkips skips={skips ?? []} />
      </div>
    </main>
  );
}
