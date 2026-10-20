import { notFound, redirect } from "next/navigation";
import { syllabusReadEnabled } from "@/lib/server/gemini";
import { sessionDates, shortDate } from "@/lib/syllabus/dates";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";
import { ImportFlow } from "./import-flow";

export const metadata = { title: "Import a syllabus" };

export default async function SyllabusPage(
  props: PageProps<"/app/courses/[id]/syllabus">,
) {
  const { id } = await props.params;
  if (!hasSupabaseEnv()) redirect("/login");
  // Without a Gemini key the import is hidden and the rest of the app works.
  if (!syllabusReadEnabled()) notFound();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!course) notFound();

  const [tests, topics, classes] = await Promise.all([
    supabase
      .from("assessments")
      .select("session_number, title, weight, weight_assumed")
      .eq("course_id", id)
      .eq("source", "syllabus")
      .not("session_number", "is", null),
    supabase
      .from("syllabus_sessions")
      .select("session_number, topic, pre_reading, probably")
      .eq("course_id", id),
    supabase
      .from("class_sessions")
      .select("starts_at, session_numbers")
      .eq("course_id", id),
  ]);
  const dates = Object.fromEntries(
    [...sessionDates(classes.data ?? [])].map(([n, iso]) => [
      n,
      shortDate(iso),
    ]),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <h1 className="text-[28px] font-bold">Import a syllabus</h1>
      <p className="mt-1 text-[15px] text-muted">{course.name}</p>
      <ImportFlow
        courseId={course.id}
        courseName={course.name}
        dates={dates}
        saved={{
          tests: (tests.data ?? []).map((t) => ({
            session_number: t.session_number as number,
            title: t.title,
            weight: t.weight == null ? null : Number(t.weight),
            weight_assumed: t.weight_assumed,
          })),
          topics: topics.data ?? [],
        }}
      />
    </main>
  );
}
