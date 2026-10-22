// Turns a student's snapshot into the inputs of the web app's week tools, the
// same way the web's loader does (src/lib/calendar/load.ts loadWeekData).
import { livesFor, livesLeft, sessionsFor } from "@/lib/rules/lives";
import type { WeekCourse } from "@/lib/rules/week";
import type { Snapshot } from "../ports";

export function weekCourses(snap: Snapshot, today: string): WeekCourse[] {
  return snap.courses.map((c) => ({
    id: c.id,
    name: c.name,
    left: livesLeft(c, snap.skips, today).left,
    missedBefore: c.missed_before,
  }));
}

export type CourseLives = {
  id: string;
  name: string;
  left: number;
  lives: number;
  planned: number;
  estimated: boolean;
};

export function courseLives(snap: Snapshot, today: string): CourseLives[] {
  return snap.courses.map((c) => {
    const { left, planned } = livesLeft(c, snap.skips, today);
    const { sessions, estimated } = sessionsFor(c);
    return {
      id: c.id,
      name: c.name,
      left,
      lives: livesFor(sessions),
      planned,
      estimated,
    };
  });
}

// "Tue 3 Nov" for a Madrid date.
export function dayName(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));
}
