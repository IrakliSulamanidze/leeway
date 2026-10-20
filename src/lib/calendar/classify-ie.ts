// Turns a parsed event into a class session kind, a course key and its session
// numbers (research/spike-s1.md). IE events are recognised by UID shape: the course
// key is the UID's P…C…S… part, which exams share with their course. Other feeds
// fall back to the cleaned title as the course key.
import type { ParsedEvent } from "./parse";

export type SessionKind = "class" | "async" | "extra" | "exam" | "deadline";
export type Classified = {
  kind: SessionKind;
  // null: no course can be told (a Blackboard item); the sync drops it.
  courseKey: string | null;
  title: string;
  sessionNumbers: number[];
};

const CLASS_UID = /^F\d+PLANI\d+(P\d+C\d+S\d+)A\d+$/;
const EXAM_UID = /^\d+(P\d+C\d+S\d+)$/;
const META_UID = /^\d{2}_\d{2}_\d{4}_\d{2}_\d{2}_\d{2}$/;
const SESSIONS = /\(Ses\.\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\)/i;

export function sessionNumbers(summary: string): number[] {
  const m = SESSIONS.exec(summary);
  if (!m) return [];
  const from = +m[1];
  const to = m[2] ? +m[2] : from;
  if (from < 1 || to < from || to > 200) return [];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function cleanTitle(summary: string): string {
  const exam = /\bEXAM:\s*(.*)$/i.exec(summary);
  let title = exam
    ? // "…: EXAM: Course Papa T-34.70|T-38.40" -> "Course Papa"
      exam[1].replace(/\s+\S*\d\S*$/, "")
    : summary.split(/\(Ses\.|\||\s+Extra\b/i)[0];
  title = title.replace(/,\s*null\b/gi, "").replace(/\s+/g, " ");
  return title.replace(/^[\s,|:-]+|[\s,|:-]+$/g, "");
}

export function isIEFeed(events: ParsedEvent[]): boolean {
  return events.some((e) => CLASS_UID.test(e.uid));
}

export function classifyIE(ev: ParsedEvent): Classified | null {
  if (META_UID.test(ev.uid) || /\bLast Update\b/i.test(ev.summary)) return null;
  const title = cleanTitle(ev.summary);
  const cls = CLASS_UID.exec(ev.uid);
  if (cls) {
    const numbers = sessionNumbers(ev.summary);
    const kind = /^asynchronous$/i.test(ev.location)
      ? "async"
      : numbers.length
        ? "class"
        : "extra";
    return { kind, courseKey: `ie:${cls[1]}`, title, sessionNumbers: numbers };
  }
  const exam = EXAM_UID.exec(ev.uid);
  if (exam || /\bEXAM:/i.test(ev.summary))
    return {
      kind: "exam",
      courseKey: exam ? `ie:${exam[1]}` : titleKey(title),
      title,
      sessionNumbers: [],
    };
  // Blackboard due items: digits-only UID, no course in the UID.
  if (/^\d+$/.test(ev.uid))
    return { kind: "deadline", courseKey: null, title, sessionNumbers: [] };
  return classifyOther(ev);
}

function titleKey(title: string): string | null {
  const key = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return key ? `title:${key}` : null;
}

// Google, Outlook and the rest: one course per cleaned title.
export function classifyOther(ev: ParsedEvent): Classified {
  const title = cleanTitle(ev.summary) || ev.summary.trim();
  return {
    kind: /\bEXAM\b/i.test(ev.summary) ? "exam" : "class",
    courseKey: titleKey(title),
    title,
    sessionNumbers: sessionNumbers(ev.summary),
  };
}
