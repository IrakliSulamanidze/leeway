import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RemoveCourse, SkipButton } from "@/components/course-actions";
import { courseMeta, courseViews, PACE_COLOR } from "@/components/course-list";
import { CourseNumbers } from "@/components/course-numbers";
import { Hearts } from "@/components/hearts";
import { skipMeta } from "@/components/recent-skips";
import { madridToday } from "@/lib/rules/dates";
import {
  EXAM_PREP,
  countdown,
  isExamPrep,
  participationLine,
} from "@/lib/rules/syllabus";
import { syllabusReadEnabled } from "@/lib/server/gemini";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";

export const metadata = { title: "Course" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One course: its numbers, every skip with Delete or Cancel, and Remove course.
export default async function CoursePage({
  params,
}: PageProps<"/app/courses/[id]">) {
  const { id } = await params;
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  if (!UUID.test(id)) notFound();

  const [{ data: course }, { data: skips }, { data: tests }] =
    await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, name, sessions_typed, sessions_syllabus, sessions_calendar, missed_before, participation_weight",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("skips")
        .select("id, course_id, text_typed, sessions, skip_date, planned")
        .eq("course_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("assessments")
        .select("session_number, on_date, title, weight")
        .eq("course_id", id)
        .order("session_number"),
    ]);
  if (!course) notFound();

  const today = madridToday();
  const [c] = courseViews([course], skips ?? [], today);
  const testRows = (tests ?? []).map((t) => ({
    ...t,
    weight: t.weight == null ? null : Number(t.weight),
  }));
  const next = countdown(today, testRows);
  const participation = participationLine(
    course.participation_weight == null
      ? null
      : Number(course.participation_weight),
  );

  return (
    <main className="mx-auto grid w-full max-w-2xl content-start gap-5 px-5 py-5">
      <Link
        href="/app"
        className="-my-2 justify-self-start py-3 text-[15px] font-semibold text-ink underline"
      >
        Back to your courses
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h1 className="m-0 text-[28px] leading-tight font-bold [overflow-wrap:anywhere]">
            {c.name}
          </h1>
          <p className="m-0 text-sm text-muted">{courseMeta(c)}</p>
        </div>
        <div className="flex-none text-right leading-none tabular-nums">
          <b
            className={`block text-[34px] font-bold tracking-tight ${PACE_COLOR[c.pace]}`}
          >
            {c.left}
          </b>{" "}
          <small className="text-[12.5px] text-muted">of {c.lives} left</small>
        </div>
      </div>
      <Hearts lives={c.lives} left={c.left} planned={c.planned} />

      <section className="grid gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
        <h2 className="m-0 text-base font-semibold">Course numbers</h2>
        {c.missedBefore === 0 && (
          <p className="m-0 text-sm text-muted">Counting from today</p>
        )}
        <CourseNumbers
          id={c.id}
          name={c.name}
          sessions={c.sessions}
          missedBefore={c.missedBefore}
        />
      </section>

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="m-0 text-xl font-bold tracking-tight">Skips</h2>
          <span className="text-sm text-muted">
            {skips?.length ?? 0} logged
          </span>
        </div>
        {skips?.length ? (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {skips.map((s) => (
              <li
                key={s.id}
                data-testid="course-skip"
                className="flex min-h-14 items-center gap-2 border-t border-line py-2 pr-2 pl-4 first:border-t-0"
              >
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  {s.text_typed}
                  {s.sessions === 2 && (
                    <span className="ml-1.5 font-semibold">x2</span>
                  )}
                  <span className="block text-[13.5px] text-muted">
                    {skipMeta(s, today)}
                  </span>
                </div>
                <SkipButton
                  id={s.id}
                  planned={s.planned && s.skip_date > today}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">
            No skips in this course. It keeps all {c.lives} lives.
          </p>
        )}
      </section>

      {(testRows.length > 0 || syllabusReadEnabled()) && (
        <section className="grid gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="m-0 text-xl font-bold tracking-tight">Tests</h2>
            {next && (
              <span data-testid="test-countdown" className="text-sm">
                {next}
              </span>
            )}
          </div>
          {testRows.length > 0 && (
            <ul className="overflow-hidden rounded-xl border border-line bg-surface">
              {testRows.map((t) => (
                <li
                  key={`${t.session_number}-${t.title}`}
                  data-testid="course-test"
                  className="border-t border-line px-4 py-3 first:border-t-0"
                >
                  <b>
                    {t.session_number
                      ? `Session ${t.session_number}`
                      : t.on_date}
                  </b>{" "}
                  · {t.title}
                  {t.weight != null && ` · ${t.weight}%`}
                  {t.session_number != null &&
                    isExamPrep(t.session_number - 1, testRows) && (
                      <span className="block text-[13.5px] text-muted">
                        Session {t.session_number - 1}: {EXAM_PREP}
                      </span>
                    )}
                </li>
              ))}
            </ul>
          )}
          {participation && (
            <p className="m-0 text-sm text-muted">{participation}</p>
          )}
          {syllabusReadEnabled() && (
            <Link
              href={`/app/courses/${c.id}/syllabus`}
              data-testid="syllabus-import"
              className="flex min-h-11 items-center justify-center rounded-xl border border-line-input bg-surface px-4 font-semibold"
            >
              {testRows.length
                ? "Import a newer syllabus"
                : "Import a syllabus"}
            </Link>
          )}
        </section>
      )}

      <RemoveCourse id={c.id} name={c.name} />
    </main>
  );
}
