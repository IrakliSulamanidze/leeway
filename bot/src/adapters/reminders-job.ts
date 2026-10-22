import { addDays, MADRID, madridToday } from "@/lib/rules/dates";
import { reminderFor } from "../core/reminders";
import type { Accounts, Messenger, Student } from "../ports";
import { log } from "./log";
import { MetaSendError } from "./meta/cloud-api";

export type Target = { waId: string; lastSeenAt: Date | null };

export type ReminderJobDeps = {
  now: Date;
  targets(): Promise<Target[]>;
  optedOut(waId: string): Promise<boolean>;
  // Claims today's reminder for the student; false if one already went out.
  claim(waId: string): Promise<boolean>;
  // Gives today's claim back after Meta refused the message outright.
  unclaim(waId: string): Promise<void>;
  student: Student;
  accounts: Pick<Accounts, "profile">;
  messenger: Messenger;
  // Meta has approved Leeway's reminder templates.
  templatesReady: boolean;
  // Milliseconds since the run started; the run stops early to finish in time.
  elapsed?: () => number;
};

// Inside 24 hours of a student's last message a plain text is free and needs
// no template. Keep a margin so the window cannot close mid-send.
const WINDOW_MS = 23 * 60 * 60 * 1000;
// Vercel stops the function at 60 s; leave room for the last sends.
const STOP_AFTER_MS = 45_000;
const AT_ONCE = 4;

export type JobResult = {
  sent: number;
  nothing: number;
  skipped: number;
  failed: number;
  notReached: number;
};

// Quiet hours: nothing between 22:30 and 08:00 in Madrid, whoever calls.
function quietHours(now: Date): boolean {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: MADRID,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(now)
    .split(":")
    .map(Number);
  const minutes = h * 60 + m;
  return minutes >= 22 * 60 + 30 || minutes < 8 * 60;
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A refusal about this message (bad template, closed window) will not fix
// itself by tomorrow; a timeout might have been delivered.
const refusedOutright = (e: unknown) =>
  e instanceof MetaSendError &&
  e.status >= 400 &&
  e.status < 500 &&
  e.status !== 429;

// One run: each student gets at most one reminder, claimed before it is
// sent, so a second run on the same day sends nothing twice. Students are
// taken in random order, so a run cut short never misses the same ones.
export async function runReminders(deps: ReminderJobDeps): Promise<JobResult> {
  const result: JobResult = {
    sent: 0,
    nothing: 0,
    skipped: 0,
    failed: 0,
    notReached: 0,
  };
  if (quietHours(deps.now)) return result;
  const started = Date.now();
  const elapsed = deps.elapsed ?? (() => Date.now() - started);
  const today = madridToday(deps.now);
  const queue = shuffled(await deps.targets());

  async function one(target: Target) {
    if (await deps.optedOut(target.waId)) return void result.skipped++;
    const inWindow =
      target.lastSeenAt !== null &&
      deps.now.getTime() - target.lastSeenAt.getTime() < WINDOW_MS;
    if (!inWindow && !deps.templatesReady) return void result.skipped++;
    const [snap, profile] = await Promise.all([
      deps.student.snapshot(target.waId, {
        from: today,
        to: addDays(today, 8),
      }),
      deps.accounts.profile(target.waId),
    ]);
    const reminder = reminderFor(snap, deps.now, profile.hideDetails);
    if (!reminder) return void result.nothing++;
    if (!(await deps.claim(target.waId))) return void result.skipped++;
    try {
      if (inWindow)
        await deps.messenger.send(target.waId, { text: reminder.text });
      else
        await deps.messenger.sendTemplate(
          target.waId,
          reminder.template.name,
          reminder.template.params,
        );
      result.sent++;
    } catch (error) {
      if (refusedOutright(error))
        await deps.unclaim(target.waId).catch(() => undefined);
      throw error;
    }
  }

  async function worker() {
    for (let target = queue.shift(); target; target = queue.shift()) {
      if (elapsed() > STOP_AFTER_MS) {
        result.notReached++;
        continue;
      }
      try {
        await one(target);
      } catch (error) {
        result.failed++;
        log.error(
          "reminder: failed",
          error instanceof MetaSendError
            ? `meta ${error.status} ${error.code ?? ""}`
            : "error",
        );
      }
    }
  }
  await Promise.all(Array.from({ length: AT_ONCE }, worker));
  if (result.notReached)
    log.warn("reminders: run stopped early", String(result.notReached));
  return result;
}
