import { redirect } from "next/navigation";
import { CourseList, courseViews } from "@/components/course-list";
import { RecentSkips } from "@/components/recent-skips";
import { RiskLine } from "@/components/risk-line";
import { SkipForm } from "@/components/skip-form";
import { TERM } from "@/lib/config";
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
  const views = courseViews(courses ?? [], skips ?? [], today);
  const week = weekOfTerm(today, TERM.start);

  return (
    <main className="mx-auto grid w-full max-w-5xl content-start gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12 lg:px-12">
      <h1 className="sr-only">Your courses</h1>
      <div className="grid content-start gap-5">
        <RiskLine courses={views} />
        <SkipForm
          courses={views.map(({ name, lives, left }) => ({
            name,
            lives,
            left,
          }))}
          weeksToGo={weeksToGo(today, TERM.end)}
          weekOfTerm={week}
        />
      </div>
      <div className="grid content-start gap-5">
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
            <CourseList courses={views} />
          ) : (
            <>
              <p className="m-0 text-sm text-muted">
                No skips yet. Type a class to see what skipping it would cost.
              </p>
              <div aria-hidden="true">
                <CourseList
                  courses={[
                    {
                      id: "example",
                      name: "Example course",
                      lives: 6,
                      left: 6,
                      planned: 0,
                      pace: "safe",
                      weeksToGo: weeksToGo(today, TERM.end),
                      estimated: false,
                    },
                  ]}
                />
              </div>
            </>
          )}
        </section>
        <RecentSkips skips={skips ?? []} />
      </div>
    </main>
  );
}
