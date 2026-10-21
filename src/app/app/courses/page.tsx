import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseList, courseViews } from "@/components/course-list";
import { GetStarted } from "@/components/get-started";
import { Notices } from "@/components/notices";
import { RiskLine } from "@/components/risk-line";
import { SyllabusImport } from "@/components/syllabus-import";
import { TERM } from "@/lib/config";
import { courseColors } from "@/lib/course-color";
import {
  loadCourseCalendar,
  loadFeeds,
  loadNotices,
  requestTime,
} from "@/lib/calendar/load";
import { madridToday, weekOfTerm } from "@/lib/rules/dates";
import { syllabusReadEnabled } from "@/lib/server/gemini";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";

export const metadata = { title: "Courses" };

const TERM_WEEKS = weekOfTerm(TERM.end, TERM.start);

// Every course with its lives, fewest left first. Courses with no class this
// term fold into "Past courses".
export default async function CoursesPage() {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const [{ data: courses }, { data: skips }, feeds, notices] =
    await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, name, sessions_typed, sessions_syllabus, sessions_calendar, missed_before",
        ),
      supabase
        .from("skips")
        .select("id, course_id, text_typed, sessions, skip_date, planned"),
      loadFeeds(),
      loadNotices(),
    ]);

  const today = madridToday();
  const calendar = feeds.length
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
  const colors = courseColors(courses ?? []);
  const week = weekOfTerm(today, TERM.start);

  return (
    <main className="mx-auto grid w-full max-w-2xl content-start gap-5 px-5 py-5">
      <div
        className="flex items-baseline justify-between gap-2"
        data-tour="courses-title"
      >
        <h1 className="m-0 text-[28px] font-bold">Courses</h1>
        {week > 0 && week <= TERM_WEEKS && (
          <span className="text-sm text-muted">
            Week {week} of {TERM_WEEKS}
          </span>
        )}
      </div>
      <Notices notices={notices} />
      <RiskLine courses={views} />
      {views.length === 0 && calendar && (
        <Link
          href="/app/calendar"
          className="flex min-h-[52px] items-center justify-center rounded-xl bg-primary px-5 font-semibold text-on-primary"
        >
          Check the courses your calendar found
        </Link>
      )}
      {current.length > 0 && (
        <div data-tour="courses">
          <CourseList courses={current} linked colors={colors} />
        </div>
      )}
      {current.length > 0 && (
        <Link
          href="/app/courses/missed"
          className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4"
        >
          <span>
            {current.some((c) => c.missedBefore > 0)
              ? "Classes you missed before joining"
              : "Missed classes before you joined?"}
          </span>
          <span className="font-semibold underline">
            {current.some((c) => c.missedBefore > 0) ? "Edit" : "Add them"}
          </span>
        </Link>
      )}
      {past.length > 0 && (
        <details className="grid gap-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
            Past courses
          </summary>
          <CourseList courses={past} linked colors={colors} />
        </details>
      )}
      {syllabusReadEnabled() && (
        <SyllabusImport
          courses={[...current]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ id, name }) => ({ id, name }))}
        />
      )}
      <GetStarted
        calendar={calendar !== null}
        syllabus={false}
        courses={views.length}
        guessed={current
          .filter((c) => c.estimated)
          .map(({ id, name }) => ({ id, name }))}
      />
    </main>
  );
}
