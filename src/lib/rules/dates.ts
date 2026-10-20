// Madrid calendar dates as 'YYYY-MM-DD' strings. Pure: no I/O, no date library.
import { TERM } from "@/lib/config";

export const MADRID = "Europe/Madrid";
const DAY_MS = 86_400_000;

// Wall-clock parts of an instant in a time zone.
function partsIn(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    y: get("year"),
    mo: get("month"),
    d: get("day"),
    h: get("hour"),
    mi: get("minute"),
    s: get("second"),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dateIn(d: Date, tz: string): string {
  const p = partsIn(d, tz);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

// Whole days from a to b (both 'YYYY-MM-DD'); negative when b is earlier.
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS,
  );
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function madridToday(now: Date = new Date()): string {
  return dateIn(now, MADRID);
}

export function madridTomorrow(now: Date = new Date()): string {
  return addDays(madridToday(now), 1);
}

// 'YYYY-MM-DDTHH:mm[:ss]' read as wall-clock time in tz, returned as the real
// instant. A time skipped by a clock change moves forward by the gap; a
// repeated time takes its first (summer-time) occurrence.
export function zonedToUtc(localIso: string, tz: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    localIso,
  );
  if (!m) throw new Error("zonedToUtc: expected YYYY-MM-DDTHH:mm[:ss]");
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0));
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetAt = (t: number) => {
    const p = partsIn(new Date(t), tz);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - t;
  };
  // Try both offsets seen around this time; keep the earliest that round-trips.
  const offsets = [offsetAt(wall - DAY_MS), offsetAt(wall + DAY_MS)];
  const fits = offsets
    .map((o) => wall - o)
    .filter((t) => offsetAt(t) === wall - t);
  if (fits.length) return new Date(Math.min(...fits));
  return new Date(wall - Math.min(...offsets));
}

// Full weeks left until the term ends; 0 in the last week and after it.
export function weeksToGo(today: string, termEnd: string): number {
  const days = daysBetween(today, termEnd);
  return days <= 0 ? 0 : Math.floor(days / 7);
}

// 1 in the term's first seven days; 0 before the term starts.
export function weekOfTerm(today: string, termStart: string): number {
  const days = daysBetween(termStart, today);
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}

// First and last Madrid date of a course's sessions, else the configured term.
export function termDates(
  sessions: { starts_at: string }[],
  fallback: { start: string; end: string } = TERM,
): { start: string; end: string } {
  if (!sessions.length) return { ...fallback };
  const days = sessions
    .map((s) => dateIn(new Date(s.starts_at), MADRID))
    .sort();
  return { start: days[0], end: days[days.length - 1] };
}
