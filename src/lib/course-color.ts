// One of eight course colours (--c1..--c8 tints, --k1..--k8 inks in
// globals.css), by name order, so a course keeps its colour on every screen.
export function courseColors(
  courses: { id: string; name: string }[],
): Map<string, number> {
  const sorted = [...courses].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  return new Map(sorted.map((c, i) => [c.id, (i % 8) + 1]));
}

export const tint = (n: number) => `var(--c${n})`;
export const ink = (n: number) => `var(--k${n})`;
