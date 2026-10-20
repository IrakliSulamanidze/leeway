import Link from "next/link";
import { redirect } from "next/navigation";
import { MissedStepper } from "@/components/missed-stepper";
import { courseColors, ink } from "@/lib/course-color";
import { madridToday } from "@/lib/rules/dates";
import { livesFor, livesLeft, sessionsFor } from "@/lib/rules/lives";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";

export const metadata = { title: "Missed so far" };

const leftColor = (n: number) =>
  n <= 0 ? "text-danger" : n === 1 ? "text-warn" : "text-muted";

// For a student who starts mid-term: one stepper per course for the classes
// already missed, so lives are right from the first day.
export default async function MissedPage({
  searchParams,
}: PageProps<"/app/courses/missed">) {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const [{ data: courses }, { data: skips }] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, sessions_typed, sessions_syllabus, sessions_calendar, missed_before",
      )
      .order("name"),
    supabase.from("skips").select("course_id, sessions, skip_date, planned"),
  ]);
  const { next } = await searchParams;
  const done = next === "schedule" ? "/app/schedule" : "/app/courses";
  const today = madridToday();
  const colors = courseColors(courses ?? []);

  return (
    <main className="mx-auto grid w-full max-w-2xl content-start gap-5 px-5 py-5">
      <div className="grid gap-1">
        <h1 className="m-0 text-[28px] leading-tight font-bold">
          Missed any classes yet?
        </h1>
        <p className="m-0 text-muted">
          Count the ones you&apos;ve missed this term so far.
        </p>
      </div>
      {courses?.length ? (
        <ul className="m-0 divide-y divide-line rounded-xl border border-line bg-surface p-0">
          {courses.map((c) => {
            const { left, used } = livesLeft(c, skips ?? [], today);
            const lives = livesFor(sessionsFor(c).sessions);
            const marked = used - c.missed_before;
            return (
              <li
                key={c.id}
                data-testid="missed-course"
                className="flex items-center gap-3 py-2.5 pr-3 pl-4"
              >
                <i
                  aria-hidden="true"
                  className="h-3 w-3 flex-none rounded-full"
                  style={{ background: ink(colors.get(c.id) ?? 8) }}
                />
                <span className="grid min-w-0 flex-1">
                  <b className="[overflow-wrap:anywhere]">{c.name}</b>
                  <span className={`text-sm ${leftColor(left)}`}>
                    {left < 0
                      ? "Over the limit"
                      : `${left} of ${lives} ${lives === 1 ? "life" : "lives"} left`}
                    {marked > 0 && ` · ${marked} logged`}
                  </span>
                </span>
                <MissedStepper
                  id={c.id}
                  name={c.name}
                  before={c.missed_before}
                  marked={marked}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0">Add a course first, then come back here.</p>
      )}
      <Link
        href={done}
        className="flex min-h-[52px] items-center justify-center rounded-xl bg-primary px-5 text-[17px] font-semibold text-on-primary"
      >
        Done
      </Link>
    </main>
  );
}
