"use client";

import { useState, useTransition } from "react";
import { setCourseNumbers } from "@/app/app/actions";

// "Sessions in this course: 30", editable in place on the course page.
export function CourseNumbers({
  id,
  name,
  sessions,
}: {
  id: string;
  name: string;
  sessions: number;
}) {
  const [s, setS] = useState(String(sessions));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await setCourseNumbers(id, Number(s));
      setMessage(res.ok ? "Saved." : (res.message ?? "Couldn't save."));
    });
  }

  const field =
    "h-11 w-16 rounded-lg border border-line-input bg-surface px-2 text-center text-[16px] tabular-nums";
  return (
    <form
      onSubmit={onSubmit}
      aria-label={`${name} numbers`}
      data-testid="course-numbers"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted"
      noValidate
    >
      <label className="flex items-center gap-2">
        Sessions in this course:
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          value={s}
          onChange={(e) => setS(e.target.value)}
          className={field}
        />
      </label>
      <button
        type="submit"
        aria-disabled={pending}
        className="min-h-11 min-w-11 rounded-lg border border-line-input bg-surface px-3 font-semibold text-ink"
      >
        Save
      </button>
      <span role="status" className="min-w-0 font-semibold text-ink">
        {message}
      </span>
    </form>
  );
}
