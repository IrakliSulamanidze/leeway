// Calendar grid layout: Madrid clock times, the hours to draw and side-by-side
// lanes for classes that overlap. Pure: no I/O.

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Minutes since Madrid midnight.
export function madridMinutes(iso: string): number {
  const parts = CLOCK.formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return get("hour") * 60 + get("minute");
}

export function clock(iso: string): string {
  return CLOCK.format(new Date(iso));
}

export type Timed = { id: string; start: number; end: number };

// First and last hour to draw: the week's classes, or 9 to 18 when empty.
export function hourRange(items: Timed[]): { from: number; to: number } {
  if (items.length === 0) return { from: 9, to: 18 };
  const from = Math.floor(Math.min(...items.map((i) => i.start)) / 60);
  const to = Math.ceil(Math.max(...items.map((i) => i.end)) / 60);
  return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 1)) };
}

// Each overlapping group shares the column width: lane n of `lanes`.
export function lanes(
  items: Timed[],
): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  let group: { id: string; lane: number }[] = [];
  let ends: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const g of group) out.set(g.id, { lane: g.lane, lanes: ends.length });
    group = [];
    ends = [];
  };
  for (const it of sorted) {
    if (it.start >= groupEnd) close();
    let lane = ends.findIndex((e) => e <= it.start);
    if (lane === -1) lane = ends.push(it.end) - 1;
    else ends[lane] = it.end;
    group.push({ id: it.id, lane });
    groupEnd = Math.max(groupEnd, it.end);
  }
  close();
  return out;
}
