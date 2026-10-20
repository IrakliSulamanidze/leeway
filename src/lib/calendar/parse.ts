// A small iCalendar reader for the feeds Leeway syncs (tech-plan 5.2): VEVENTs with
// TZID times (with or without a VTIMEZONE, Windows zone names included), all-day
// dates (also IE's bare date with a TZID and no VALUE=DATE), DTEND or DURATION, and
// RRULE (DAILY/WEEKLY/MONTHLY with INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY),
// EXDATE and RECURRENCE-ID overrides. Times are worked out with Intl only.

export type ParsedEvent = {
  uid: string;
  // Start of the occurrence as the series first scheduled it (= start unless moved).
  originalStart: Date;
  start: Date;
  end: Date;
  allDay: boolean;
  summary: string;
  location: string;
};

export const DEFAULT_TZ = "Europe/Madrid";

// Windows zone names (Outlook, Exchange) to IANA, CLDR primary zones.
const WINDOWS_ZONES: Record<string, string> = {
  "Romance Standard Time": "Europe/Paris",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "E. Europe Standard Time": "Europe/Chisinau",
  "FLE Standard Time": "Europe/Kiev",
  "GTB Standard Time": "Europe/Bucharest",
  "Turkey Standard Time": "Europe/Istanbul",
  "Russian Standard Time": "Europe/Moscow",
  "Israel Standard Time": "Asia/Jerusalem",
  "South Africa Standard Time": "Africa/Johannesburg",
  "Arabian Standard Time": "Asia/Dubai",
  "India Standard Time": "Asia/Calcutta",
  "China Standard Time": "Asia/Shanghai",
  "Singapore Standard Time": "Asia/Singapore",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Atlantic Standard Time": "America/Halifax",
  "SA Pacific Standard Time": "America/Bogota",
  "Pacific SA Standard Time": "America/Santiago",
  "E. South America Standard Time": "America/Sao_Paulo",
  "Argentina Standard Time": "America/Buenos_Aires",
  "Central Standard Time (Mexico)": "America/Mexico_City",
  UTC: "Etc/UTC",
  "Coordinated Universal Time": "Etc/UTC",
};

function isZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveZone(
  tzid: string | undefined,
  fallback = DEFAULT_TZ,
): string {
  if (!tzid) return fallback;
  const name = tzid.replace(/^"|"$/g, "").trim();
  if (WINDOWS_ZONES[name]) return WINDOWS_ZONES[name];
  // "/mozilla.org/20070129_1/Europe/Madrid" and similar prefixed ids.
  const tail = /([A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?)$/.exec(name)?.[1];
  for (const candidate of [name, tail])
    if (candidate && candidate.includes("/") && isZone(candidate))
      return candidate;
  if (/^(utc|gmt|z)$/i.test(name)) return "Etc/UTC";
  return fallback;
}

// --- wall time <-> instants -------------------------------------------------

type Wall = {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();
function offsetMs(instant: number, tz: string): number {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  const p = Object.fromEntries(
    f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour,
    +p.minute,
    +p.second,
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function wallToUtc(w: Wall, tz: string): Date {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  const first = guess - offsetMs(guess, tz);
  const second = guess - offsetMs(first, tz);
  return new Date(second);
}

function addDays(w: Wall, days: number): Wall {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d + days));
  return {
    ...w,
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
  };
}

function weekday(w: Wall): number {
  return new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
}

// --- content lines ----------------------------------------------------------

type Prop = { name: string; params: Record<string, string>; value: string };

function parseLine(line: string): Prop | null {
  let i = 0;
  let inQuote = false;
  let colon = -1;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0)
      params[p.slice(0, eq).toUpperCase()] = p
        .slice(eq + 1)
        .replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(v: string): string {
  return v.replace(/\\([nN,;\\])/g, (_, c: string) =>
    c === "n" || c === "N" ? "\n" : c,
  );
}

type DateValue = { wall: Wall; allDay: boolean; tz: string; utc: boolean };

function parseDate(prop: Prop, defaultTz: string): DateValue | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(
    prop.value.trim(),
  );
  if (!m) return null;
  const wall: Wall = {
    y: +m[1],
    m: +m[2],
    d: +m[3],
    h: +(m[4] ?? 0),
    mi: +(m[5] ?? 0),
    s: +(m[6] ?? 0),
  };
  // A bare date is all-day even with a TZID and no VALUE=DATE (IE's async sessions).
  const allDay = m[4] === undefined || prop.params.VALUE === "DATE";
  const utc = m[7] === "Z";
  return {
    wall,
    allDay,
    utc,
    tz: utc ? "Etc/UTC" : resolveZone(prop.params.TZID, defaultTz),
  };
}

function toInstant(v: DateValue): Date {
  return wallToUtc(v.wall, v.tz);
}

type Duration = { days: number; ms: number };
function parseDuration(v: string): Duration | null {
  const m =
    /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
      v.trim(),
    );
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  return {
    days: sign * (+(m[2] ?? 0) * 7 + +(m[3] ?? 0)),
    ms: sign * ((+(m[4] ?? 0) * 60 + +(m[5] ?? 0)) * 60 + +(m[6] ?? 0)) * 1000,
  };
}

// --- events -----------------------------------------------------------------

type RawEvent = { props: Prop[] };

function first(ev: RawEvent, name: string): Prop | undefined {
  return ev.props.find((p) => p.name === name);
}

function readComponents(ics: string): {
  events: RawEvent[];
  calendarTz?: string;
} {
  const lines = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: RawEvent[] = [];
  const stack: string[] = [];
  let current: RawEvent | null = null;
  let calendarTz: string | undefined;
  for (const line of lines) {
    if (!line) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === "BEGIN") {
      stack.push(prop.value.toUpperCase());
      if (prop.value.toUpperCase() === "VEVENT" && stack.length === 2)
        current = { props: [] };
      continue;
    }
    if (prop.name === "END") {
      if (
        prop.value.toUpperCase() === "VEVENT" &&
        current &&
        stack.length === 2
      ) {
        events.push(current);
        current = null;
      }
      stack.pop();
      continue;
    }
    if (current && stack.length === 2) current.props.push(prop);
    else if (stack.length === 1 && prop.name === "X-WR-TIMEZONE")
      calendarTz = prop.value.trim();
  }
  if (!lines.some((l) => /^BEGIN:VCALENDAR$/i.test(l.trim())))
    throw new Error("not a calendar");
  return { events, calendarTz };
}

type Base = {
  uid: string;
  start: DateValue;
  startAt: Date;
  durationEnd: (startWall: Wall, startAt: Date) => Date;
  summary: string;
  location: string;
  cancelled: boolean;
};

function readEvent(ev: RawEvent, defaultTz: string): Base | null {
  const uid = first(ev, "UID")?.value.trim();
  const dtstart = first(ev, "DTSTART");
  const start = dtstart && parseDate(dtstart, defaultTz);
  if (!uid || !start) return null;
  const startAt = toInstant(start);
  const dtend = first(ev, "DTEND");
  const end = dtend && parseDate(dtend, defaultTz);
  const dur = first(ev, "DURATION");
  const duration = dur ? parseDuration(dur.value) : null;

  let durationEnd: Base["durationEnd"];
  if (end) {
    const span = toInstant(end).getTime() - startAt.getTime();
    // Keep all-day lengths in calendar days so they survive clock changes.
    const days = start.allDay ? Math.round(span / 86_400_000) : 0;
    durationEnd = start.allDay
      ? (w) => wallToUtc(addDays(w, Math.max(days, 1)), start.tz)
      : (_w, at) => new Date(at.getTime() + Math.max(span, 0));
  } else if (duration) {
    durationEnd = (w, at) =>
      duration.days
        ? new Date(
            wallToUtc(addDays(w, duration.days), start.tz).getTime() +
              duration.ms,
          )
        : new Date(at.getTime() + duration.ms);
  } else {
    durationEnd = start.allDay
      ? (w) => wallToUtc(addDays(w, 1), start.tz)
      : (_w, at) => at;
  }
  return {
    uid,
    start,
    startAt,
    durationEnd,
    summary: unescapeText(first(ev, "SUMMARY")?.value ?? "").trim(),
    location: unescapeText(first(ev, "LOCATION")?.value ?? "").trim(),
    cancelled:
      (first(ev, "STATUS")?.value ?? "").trim().toUpperCase() === "CANCELLED",
  };
}

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MAX_OCCURRENCES = 2000;

function expandRule(base: Base, rrule: string, until: Date): Wall[] {
  const rule = Object.fromEntries(
    rrule.split(";").map((part) => {
      const [k, v = ""] = part.split("=");
      return [k.toUpperCase(), v.toUpperCase()];
    }),
  );
  const freq = rule.FREQ;
  const interval = Math.max(1, parseInt(rule.INTERVAL ?? "1", 10) || 1);
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : Infinity;
  const ruleUntil = rule.UNTIL
    ? parseDate({ name: "UNTIL", params: {}, value: rule.UNTIL }, base.start.tz)
    : null;
  const untilAt = ruleUntil
    ? toInstant(ruleUntil.utc ? ruleUntil : { ...ruleUntil, tz: base.start.tz })
    : null;
  const byDay = (rule.BYDAY ?? "")
    .split(",")
    .map((d: string) => DAYS.indexOf(d.slice(-2)))
    .filter((d: number) => d >= 0);
  const byMonthDay = (rule.BYMONTHDAY ?? "")
    .split(",")
    .map((d: string) => parseInt(d, 10))
    .filter((d: number) => d > 0);

  const out: Wall[] = [];
  const s = base.start.wall;
  const accept = (w: Wall) => {
    const at = wallToUtc(w, base.start.tz);
    if (at < base.startAt) return true;
    if (untilAt && at > untilAt) return false;
    if (at > until) return false;
    out.push(w);
    return out.length < count;
  };

  if (freq === "DAILY") {
    for (let i = 0; i < MAX_OCCURRENCES; i++)
      if (!accept(addDays(s, i * interval))) break;
  } else if (freq === "WEEKLY") {
    const days = byDay.length ? [...byDay].sort() : [weekday(s)];
    const weekStart = addDays(s, -weekday(s));
    outer: for (let wk = 0; wk < MAX_OCCURRENCES; wk++) {
      for (const d of days)
        if (!accept(addDays(weekStart, wk * 7 * interval + d))) break outer;
    }
  } else if (freq === "MONTHLY") {
    const days = byMonthDay.length ? byMonthDay : [s.d];
    outer: for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const month = new Date(Date.UTC(s.y, s.m - 1 + i * interval, 1));
      for (const d of [...days].sort((a, b) => a - b)) {
        const w = {
          ...s,
          y: month.getUTCFullYear(),
          m: month.getUTCMonth() + 1,
          d,
        };
        if (addDays(w, 0).m !== w.m) continue;
        if (!accept(w)) break outer;
      }
    }
  } else {
    out.push(s);
  }
  return out;
}

export function parseFeed(
  ics: string,
  range: { from: Date; to: Date },
): ParsedEvent[] {
  const { events, calendarTz } = readComponents(ics);
  const defaultTz = resolveZone(calendarTz, DEFAULT_TZ);
  const masters = new Map<string, { base: Base; raw: RawEvent }>();
  const overrides: { base: Base; recurrenceId: Date }[] = [];

  for (const raw of events) {
    const base = readEvent(raw, defaultTz);
    if (!base) continue;
    const rid = first(raw, "RECURRENCE-ID");
    const ridValue = rid && parseDate(rid, defaultTz);
    if (ridValue) overrides.push({ base, recurrenceId: toInstant(ridValue) });
    else masters.set(base.uid, { base, raw });
  }

  const out = new Map<string, ParsedEvent>();
  const key = (uid: string, at: Date) => `${uid}\u0000${at.getTime()}`;
  const emit = (base: Base, wall: Wall, startAt: Date, originalStart: Date) => {
    const end = base.durationEnd(wall, startAt);
    out.set(key(base.uid, originalStart), {
      uid: base.uid,
      originalStart,
      start: startAt,
      end,
      allDay: base.start.allDay,
      summary: base.summary,
      location: base.location,
    });
  };

  for (const { base, raw } of masters.values()) {
    if (base.cancelled) continue;
    const rrule = first(raw, "RRULE");
    if (!rrule) {
      emit(base, base.start.wall, base.startAt, base.startAt);
      continue;
    }
    const excluded = new Set<number>();
    for (const ex of raw.props.filter((p) => p.name === "EXDATE"))
      for (const value of ex.value.split(",")) {
        const d = parseDate({ ...ex, value }, defaultTz);
        if (d)
          excluded.add(
            toInstant(d.allDay ? { ...d, tz: base.start.tz } : d).getTime(),
          );
      }
    for (const wall of expandRule(base, rrule.value, range.to)) {
      const at = wallToUtc(wall, base.start.tz);
      if (!excluded.has(at.getTime())) emit(base, wall, at, at);
    }
  }

  for (const { base, recurrenceId } of overrides) {
    out.delete(key(base.uid, recurrenceId));
    if (!base.cancelled)
      emit(base, base.start.wall, base.startAt, recurrenceId);
  }

  return [...out.values()]
    .filter((e) => e.start < range.to && e.end > range.from)
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() || a.uid.localeCompare(b.uid),
    );
}
