"use client";

import { useState } from "react";
import { saveTrip } from "@/app/app/calendar/actions";

// "Skip this class" in the class sheet. When the skip would spend the last
// spare or go past the limit it asks first, with the same words as the skip box.
export function PlanClassButton({
  classId,
  label,
  risk,
}: {
  classId: string;
  label: string;
  risk: "last" | "over" | null;
}) {
  const [asking, setAsking] = useState(false);
  const big =
    "flex min-h-[52px] w-full items-center justify-center rounded-xl px-5 text-[17px] font-semibold";
  if (asking)
    return (
      <form
        action={saveTrip}
        role="group"
        aria-label={`Confirm skipping ${label}`}
        className="grid gap-2"
      >
        <input type="hidden" name="class" value={classId} />
        <p className="m-0 font-semibold text-danger">
          {risk === "over"
            ? "This takes you below 80%."
            : "This uses your last spare."}
        </p>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className={`${big} bg-primary text-on-primary`}
        >
          {risk === "over" ? "Don't skip" : "Keep my spare"}
        </button>
        <button className={`${big} border border-line-input bg-surface`}>
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
      <button className={`${big} bg-primary text-on-primary`}>
        Skip this class
      </button>
    </form>
  );
}
