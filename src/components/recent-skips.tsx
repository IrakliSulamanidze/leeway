import { addDays, madridToday } from "@/lib/rules/dates";

export type SkipItem = {
  id: string;
  text_typed: string;
  sessions: number;
  skip_date: string;
  planned: boolean;
};

const DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// "Today, Tue 20 Oct · double class"
export function skipMeta(s: SkipItem, today: string = madridToday()): string {
  const date = DAY.format(new Date(`${s.skip_date}T00:00:00Z`)).replace(
    ",",
    "",
  );
  const rel =
    s.skip_date === today
      ? "Today, "
      : s.skip_date === addDays(today, 1)
        ? "Tomorrow, "
        : "";
  const extras = [
    s.planned && s.skip_date > today ? "planned" : "",
    s.sessions === 2 ? "double class" : "",
  ].filter(Boolean);
  return [`${rel}${date}`, ...extras].join(" · ");
}

// Every save, newest first, with the text exactly as typed.
export function RecentSkips({ skips }: { skips: SkipItem[] }) {
  if (!skips.length) return null;
  const today = madridToday();
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-xl font-bold tracking-tight">Your skips</h2>
        <span className="text-sm text-muted">{skips.length} logged</span>
      </div>
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {skips.map((s) => (
          <li
            key={s.id}
            data-testid="core-item"
            className="flex min-h-14 items-center border-t border-line px-4 py-2 first:border-t-0"
          >
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <span className="line-clamp-2">
                {s.text_typed}
                {s.sessions === 2 && (
                  <span className="ml-1.5 font-semibold">x2</span>
                )}
              </span>
              <span className="block text-[13.5px] text-muted">
                {skipMeta(s, today)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
