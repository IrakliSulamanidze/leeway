import { markTest } from "@/app/app/calendar/actions";

export const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));

// Adds a test day to one course by date. Works with or without a calendar.
export function MarkTestForm({ courseId }: { courseId: string }) {
  return (
    <form action={markTest} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="course" value={courseId} />
      <label className="grid flex-1 gap-1 text-sm">
        Test day
        <input
          type="date"
          name="date"
          required
          className="min-h-11 rounded-xl border border-line-input bg-surface px-2 text-[17px]"
        />
      </label>
      <button className="min-h-11 rounded-xl border border-line-input px-4 font-semibold">
        Mark test day
      </button>
    </form>
  );
}
