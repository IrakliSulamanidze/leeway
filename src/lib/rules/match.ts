// "Did you mean X?" for course names. Pure: no I/O.

// Same idea as the database's norm_course_name: no accents, lower case, single spaces.
export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

// Largest share of a name that may differ and still count as a typo.
const MAX_RATIO = 0.25;
const MIN_LENGTH = 4;

// The closest existing name when the typed text is a near miss; null when it
// matches a name exactly (after normalising), is too short, or nothing is close.
export function nearMatch(typed: string, names: string[]): string | null {
  const t = normName(typed);
  if (t.length < MIN_LENGTH) return null;
  let best: { name: string; ratio: number } | null = null;
  for (const name of names) {
    const n = normName(name);
    if (n === t) return null;
    const ratio = editDistance(t, n) / Math.max(t.length, n.length);
    if (ratio <= MAX_RATIO && (!best || ratio < best.ratio))
      best = { name, ratio };
  }
  return best?.name ?? null;
}

// Courses that start with or contain what was typed, best first: "algo" finds
// "Algorithms & Data Structures", "fin rep" finds "Financial Reporting".
// Empty for an exact match or fewer than 2 letters.
export function partialMatches(typed: string, names: string[]): string[] {
  const t = normName(typed);
  if (t.length < 2 || names.some((n) => normName(n) === t)) return [];
  const parts = t.split(" ");
  const score = (name: string) => {
    const n = normName(name);
    if (n.startsWith(t)) return 3;
    const words = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (parts.every((p) => words.some((w) => w.startsWith(p)))) return 2;
    return n.includes(t) ? 1 : 0;
  };
  return names
    .map((name) => ({ name, s: score(name) }))
    .filter((m) => m.s > 0)
    .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name))
    .map((m) => m.name);
}
