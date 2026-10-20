"use client";

import { useState } from "react";
import { saveTrip, toggleSkipped } from "@/app/app/calendar/actions";

// "Skip it" on a class ahead. When the skip would spend the last spare or go
// past the limit it asks first, with the same words as the skip box.
export function PlanClassButton({
  classId,
  label,
  taken,
  risk,
}: {
  classId: string;
  label: string;
  taken: boolean;
  risk: "last" | "over" | null;
}) {
  const [asking, setAsking] = useState(false);
  if (taken)
    return (
      <form action={toggleSkipped}>
        <input type="hidden" name="class" value={classId} />
        <button
          aria-label={`Cancel the skip of ${label}`}
          className="min-h-11 rounded-xl px-3 text-[15px] font-semibold text-ink underline"
        >
          Cancel
        </button>
      </form>
    );
  if (asking)
    return (
      <form
        action={saveTrip}
        role="group"
        aria-label={`Confirm skipping ${label}`}
        className="flex basis-full flex-wrap items-center justify-end gap-x-3 gap-y-1"
      >
        <input type="hidden" name="class" value={classId} />
        <p className="m-0 w-full text-right text-sm text-danger">
          {risk === "over"
            ? "This takes you below 80%."
            : "This uses your last spare."}
        </p>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="min-h-11 rounded-xl bg-primary px-4 text-[15px] font-semibold text-on-primary"
        >
          Keep my spare
        </button>
        <button className="min-h-11 px-1 text-[15px] font-semibold text-ink underline">
          Plan it anyway
        </button>
      </form>
    );
  return (
    <form
      action={saveTrip}
      onSubmit={(e) => {
        if (risk) {
          e.preventDefault();
          setAsking(true);
        }
      }}
    >
      <input type="hidden" name="class" value={classId} />
      <button
        aria-label={`Plan to skip ${label}`}
        className="min-h-11 rounded-xl border border-line-input bg-surface px-3 text-[15px] font-semibold"
      >
        Skip it
      </button>
    </form>
  );
}
