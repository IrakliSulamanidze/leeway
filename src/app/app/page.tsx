import Link from "next/link";
import { redirect } from "next/navigation";
import { courseViews } from "@/components/course-list";
import { RecentSkips } from "@/components/recent-skips";
import { SkipForm } from "@/components/skip-form";
import { SyncStatus } from "@/components/sync-status";
import { TERM } from "@/lib/config";
import {
  hasUnsyncedCourses,
  loadFeeds,
  requestTime,
} from "@/lib/calendar/load";
import { madridToday, weekOfTerm, weeksToGo } from "@/lib/rules/dates";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";

export const metadata = { title: "Skip a class" };

// The skip box and every skip logged. Courses, the calendar and settings each
// have their own tab.
export default async function SkipPage() {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const [{ data: courses }, { data: skips }, feeds, unsynced] =
    await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, name, sessions_typed, sessions_syllabus, sessions_calendar, missed_before",
        ),
      supabase
        .from("skips")
        .select("id, course_id, text_typed, sessions, skip_date, planned")
        .order("created_at", { ascending: false }),
      loadFeeds(),
      hasUnsyncedCourses(),
    ]);

  const today = madridToday();
  const views = courseViews(courses ?? [], skips ?? [], today);

  return (
    <main className="mx-auto grid w-full max-w-xl content-start gap-6 px-5 py-5">
      <div className="grid gap-4">
        <h1 className="m-0 text-[28px] font-bold">Skip a class</h1>
        <SkipForm
          courses={views.map(({ name, lives, left, planned }) => ({
            name,
            lives,
            left,
            planned,
          }))}
          weeksToGo={weeksToGo(today, TERM.end)}
          weekOfTerm={weekOfTerm(today, TERM.start)}
        />
      </div>
      {feeds.length === 0 && (
        <p className="m-0 text-[15px] text-muted">
          <Link
            href="/app/calendar"
            className="-my-2 inline-flex min-h-11 items-center font-semibold text-ink underline"
          >
            Connect your IE calendar
          </Link>{" "}
          to add every course and see your classes.
        </p>
      )}
      {skips?.length ? (
        <RecentSkips skips={skips} />
      ) : (
        <p className="m-0 text-[15px] text-muted">
          No skips yet. Each one you log shows up here.
        </p>
      )}
      {feeds.length > 0 && (
        <SyncStatus feeds={feeds} now={requestTime()} unsynced={unsynced} />
      )}
    </main>
  );
}
