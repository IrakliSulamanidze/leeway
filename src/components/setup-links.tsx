"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const row =
  "flex min-h-11 items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0";

// Home's way into the calendar and syllabus imports, which otherwise sit
// behind the Calendar tab and each course page.
export function SetupLinks({
  calendar,
  courses,
}: {
  calendar: boolean;
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState(courses[0]?.id ?? "");
  return (
    <section className="grid gap-3">
      <h2 className="m-0 text-xl font-bold tracking-tight">
        Make your numbers exact
      </h2>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {!calendar && (
          <Link href="/app/calendar" className={row}>
            <span>
              <b className="block font-semibold">Connect your IE calendar</b>
              <span className="text-sm text-muted">
                Real session counts and a heads-up the night before.
              </span>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
        <div className={`${row} flex-wrap`}>
          <span className="w-full">
            <b className="block font-semibold">Import a syllabus</b>
            <span className="text-sm text-muted">
              {courses.length
                ? "Leeway reads the course's sessions and test days."
                : "Log a skip first, then import that course's syllabus."}
            </span>
          </span>
          {courses.length > 0 && (
            <>
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
