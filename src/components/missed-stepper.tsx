"use client";

import { useOptimistic, useTransition } from "react";
import { setMissedBefore } from "@/app/app/actions";

const round =
  "flex h-11 w-11 items-center justify-center rounded-full border border-line-input bg-surface text-[22px] leading-none font-semibold text-ink disabled:opacity-35";

// Classes missed so far: the number the student says they missed before
// using the app, plus the past classes they marked. − only takes back the
// first kind; a class marked in the calendar is undone there.
export function MissedStepper({
  id,
  name,
  before,
  marked,
}: {
  id: string;
  name: string;
  before: number;
  marked: number;
}) {
  const [shown, setShown] = useOptimistic(before);
  const [, startTransition] = useTransition();
  const set = (n: number) =>
    startTransition(async () => {
      setShown(n);
      await setMissedBefore(id, n);
    });
  const total = shown + marked;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`One fewer missed in ${name}`}
        disabled={shown === 0}
        onClick={() => set(shown - 1)}
        className={round}
      >
        −
      </button>
      <output
        aria-live="polite"
        aria-label={`${total} missed in ${name}`}
        data-testid="missed-count"
        className="w-8 text-center text-[22px] font-bold tabular-nums"
      >
        {total}
      </output>
      <button
        type="button"
        aria-label={`One more missed in ${name}`}
        disabled={shown >= 200}
        onClick={() => set(shown + 1)}
        className={round}
      >
        +
      </button>
    </div>
  );
}
