"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@/lib/config";

// Pick a course, then its syllabus page reads the session count and the
// quiz, midterm and final dates.
export function SyllabusImport({
  courses,
}: {
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState(courses[0]?.id ?? "");
  if (courses.length === 0) return null;
  return (
    <section aria-labelledby="syllabus-h" className="grid gap-2">
      <h2 id="syllabus-h" className="m-0 text-lg font-bold">
        Import a syllabus
      </h2>
      <p className="m-0 text-sm text-muted">
        {APP_NAME} reads the real session count and your test dates.
      </p>
      <div className="flex gap-2">
        <select
          aria-label="Course for the syllabus"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-input bg-surface px-3 text-[15px] text-ink"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => router.push(`/app/courses/${pick}/syllabus`)}
          className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary"
        >
          Import
        </button>
      </div>
    </section>
  );
}
