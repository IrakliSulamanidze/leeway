import { addDays, madridToday, MADRID, zonedToUtc } from "@/lib/rules/dates";
import type { SkipInput, Snapshot, Student } from "../ports";

// In-memory Student for tests and the chat simulator.
export class MemoryStudent implements Student {
  readonly data: Snapshot;
  private readonly byMessage = new Map<string, string>();
  private nextId = 1;

  constructor(data: Snapshot) {
    this.data = data;
  }

  async snapshot() {
    return structuredClone(this.data);
  }

  async logSkip(_sender: string, skip: SkipInput, messageId: string) {
    const done = this.byMessage.get(messageId);
    if (done) return done;
    const id = `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`;
    this.data.skips.push({
      id,
      course_id: skip.courseId,
      class_session_id: skip.classId,
      skip_date: skip.day,
      sessions: skip.sessions,
      planned: skip.day > madridToday(),
    });
    this.byMessage.set(messageId, id);
    return id;
  }

  async undoSkip(_sender: string, skipId: string) {
    const i = this.data.skips.findIndex((s) => s.id === skipId);
    if (i < 0) return false;
    this.data.skips.splice(i, 1);
    return true;
  }
}

const uuid = (n: number) =>
  `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;

// A made-up student for the simulator: three courses with classes on the
// next three weeks' weekdays and a quiz in three days.
export function sampleSnapshot(now: Date): Snapshot {
  const today = madridToday(now);
  const courses = [
    { id: uuid(1), name: "Microeconomics", used: 3, hour: "09:00" },
    { id: uuid(2), name: "Statistics II", used: 5, hour: "11:00" },
    { id: uuid(3), name: "Financial Reporting", used: 0, hour: "15:00" },
  ];
  const sessions: Snapshot["sessions"] = [];
  let n = 100;
  for (let d = 0; d < 21; d++) {
    const day = addDays(today, d);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const c of courses) {
      const start = zonedToUtc(`${day}T${c.hour}:00`, MADRID);
      sessions.push({
        id: uuid(n++),
        course_id: c.id,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 90 * 60_000).toISOString(),
        kind: "class",
        is_exam_slot: false,
        session_numbers: [],
      });
    }
  }
  return {
    courses: courses.map((c) => ({
      id: c.id,
      name: c.name,
      sessions_typed: 30,
      sessions_syllabus: null,
      sessions_calendar: null,
      missed_before: c.used,
    })),
    sessions,
    skips: [],
    assessments: [
      {
        course_id: uuid(2),
        class_session_id: null,
        session_number: null,
        on_date: addDays(today, 3),
        title: "Quiz",
      },
    ],
  };
}
