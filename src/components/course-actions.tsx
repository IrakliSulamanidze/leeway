"use client";

import { useState, useTransition } from "react";
import { removeCourse, removeSkip } from "@/app/app/actions";

// "Delete" on a logged skip, "Cancel" on a planned one. The course stays.
export function SkipButton({ id, planned }: { id: string; planned: boolean }) {
  const [pending, startTransition] = useTransition();
  const label = planned ? "Cancel" : "Delete";
  return (
    <button
      type="button"
      aria-disabled={pending}
      onClick={() =>
        !pending && startTransition(async () => void (await removeSkip(id)))
      }
      className="min-h-11 min-w-11 flex-none px-2 text-[15px] font-semibold text-ink underline"
    >
      {label}
    </button>
  );
}

// Two taps, no dialog: "Remove course", then confirm in place.
export function RemoveCourse({ id, name }: { id: string; name: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!asking)
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="min-h-11 justify-self-start text-[15px] font-semibold text-danger underline"
      >
        Remove course
      </button>
    );
  return (
    <div className="grid gap-2" role="group" aria-label="Remove course">
      <p className="m-0 text-sm text-muted [overflow-wrap:anywhere]">
        Remove {name} and every skip in it? This can&apos;t be undone.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          aria-disabled={pending}
          onClick={() =>
            !pending && startTransition(async () => await removeCourse(id))
          }
          className="min-h-11 rounded-xl bg-danger px-4 text-[15px] font-semibold text-on-primary"
        >
          Yes, remove it
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="min-h-11 px-2 text-[15px] font-semibold text-ink underline"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
