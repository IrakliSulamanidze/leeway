"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@/lib/config";

type Course = { id: string; name: string };

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-7 w-7 flex-none place-items-center rounded-full text-sm font-bold ${done ? "bg-ink text-on-primary" : "border border-line-input text-ink"}`}
    >
      {done ? (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <path
            d="M3.5 8.5 6.5 11.5 12.5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        n
      )}
    </span>
  );
}

// Setup on Home until it's done: the calendar adds every course with its real
// session count, and a syllabus fixes a course Leeway is still guessing at.
// Gone once there's a calendar and no guessed course left.
export function GetStarted({
  calendar,
  courses,
  guessed,
}: {
  calendar: boolean;
  courses: number;
  guessed: Course[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState(guessed[0]?.id ?? "");
  if (calendar && guessed.length === 0) return null;
  const chosen = guessed.some((c) => c.id === pick) ? pick : guessed[0]?.id;

  return (
    <section aria-labelledby="start-h" className="grid gap-3">
      <h2 id="start-h" className="m-0 text-xl font-bold tracking-tight">
        {courses === 0 ? "Start here" : "Make your numbers exact"}
      </h2>
      <ol className="m-0 overflow-hidden rounded-xl border border-line bg-surface p-0">
        <li className="flex gap-3 px-4 py-3.5">
          <Step n={1} done={calendar} />
          {calendar ? (
            <span className="grid">
              <b className="font-semibold">IE calendar connected</b>
              <span className="text-sm text-muted">
                Your courses and sessions come from it.
              </span>
            </span>
          ) : (
            <Link href="/app/calendar" className="grid flex-1">
              <b className="font-semibold underline">
                Connect your IE calendar
              </b>
              <span className="text-sm text-muted">
                Adds all your courses and counts their real sessions. Takes a
                minute, with the link from Blackboard.
              </span>
            </Link>
          )}
        </li>
        <li className="flex gap-3 border-t border-line px-4 py-3.5">
          <Step n={2} done={false} />
          <div className="grid min-w-0 flex-1 gap-2">
            <span className="grid">
              <b className="font-semibold">Import a syllabus</b>
              <span className="text-sm text-muted">
                {guessed.length
                  ? `For a course where ${APP_NAME} is guessing 30 sessions. It reads the real number and your test days.`
                  : "Once a course is here, its syllabus gives the real session count and test days."}
              </span>
            </span>
            {guessed.length > 0 && (
              <div className="flex gap-2">
                <select
                  aria-label="Course for the syllabus"
                  value={chosen}
                  onChange={(e) => setPick(e.target.value)}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-input bg-surface px-3 text-[15px] text-ink"
                >
                  {guessed.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => router.push(`/app/courses/${chosen}/syllabus`)}
                  className="min-h-11 rounded-xl border border-line-input bg-surface px-4 font-semibold"
                >
                  Import
                </button>
              </div>
            )}
          </div>
        </li>
      </ol>
      {courses === 0 && (
        <p className="m-0 text-sm text-muted">
          No calendar? The first time you log a skip for a class, {APP_NAME}{" "}
          adds the course.
        </p>
      )}
    </section>
  );
}
