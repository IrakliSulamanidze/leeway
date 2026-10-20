// Syllabus session N matches the calendar event "(Ses. N)" directly (spec).
const TZ = "Europe/Madrid";

export function sessionDates(
  classes: { starts_at: string; session_numbers: number[] }[],
): Map<number, string> {
  const out = new Map<number, string>();
  for (const c of [...classes].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  ))
    for (const n of c.session_numbers) if (!out.has(n)) out.set(n, c.starts_at);
  return out;
}

// 'YYYY-MM-DD' in Madrid.
export const madridDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

// "Thu 8 Oct"
export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(iso))
    .replace(",", "");
