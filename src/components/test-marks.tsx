import { markTest } from "@/app/app/calendar/actions";
import { createClient } from "@/lib/supabase/server";

const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));

// A course's test days, and adding one by date. Works with or without a calendar.
export async function TestMarks({ courseId }: { courseId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select("id, title, on_date, session_number")
    .eq("course_id", courseId)
    .order("on_date");
  const tests = data ?? [];
  return (
    <section
      aria-labelledby="tests-h"
      className="grid gap-3 rounded-xl border border-line bg-surface px-4 py-3.5"
    >
      <h2 id="tests-h" className="m-0 text-base font-semibold">
        Test days
      </h2>
      {tests.length > 0 && (
        <ul className="m-0 grid gap-1 p-0" data-testid="test-marks">
          {tests.map((t) => (
            <li key={t.id} className="list-none text-sm">
              <b>{t.title}</b>
              {t.on_date
                ? ` · ${dateLabel(t.on_date)}`
                : t.session_number
                  ? ` · Session ${t.session_number}`
                  : ""}
            </li>
          ))}
        </ul>
      )}
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
    </section>
  );
}
