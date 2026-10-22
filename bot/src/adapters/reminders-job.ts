import { addDays, madridToday } from "@/lib/rules/dates";
import { reminderFor } from "../core/reminders";
import type { Accounts, Messenger, Student } from "../ports";
import { log } from "./log";

export type Target = { waId: string; lastSeenAt: Date | null };

export type ReminderJobDeps = {
  now: Date;
  targets(): Promise<Target[]>;
  optedOut(waId: string): Promise<boolean>;
  // Claims today's reminder for the student; false if one already went out.
  claim(waId: string): Promise<boolean>;
  student: Student;
  accounts: Pick<Accounts, "profile">;
  messenger: Messenger;
  // Meta has approved Leeway's reminder templates.
  templatesReady: boolean;
};

// Inside 24 hours of a student's last message a plain text is free and needs
// no template. Keep a margin so the window cannot close mid-send.
const WINDOW_MS = 23 * 60 * 60 * 1000;

export type JobResult = {
  sent: number;
  nothing: number;
  skipped: number;
  failed: number;
};

// One run: each student gets at most one reminder, claimed before it is
// sent, so a second run on the same day sends nothing twice.
export async function runReminders(deps: ReminderJobDeps): Promise<JobResult> {
  const result: JobResult = { sent: 0, nothing: 0, skipped: 0, failed: 0 };
  const today = madridToday(deps.now);
  for (const target of await deps.targets()) {
    try {
      if (await deps.optedOut(target.waId)) {
        result.skipped++;
        continue;
      }
      const inWindow =
        target.lastSeenAt !== null &&
        deps.now.getTime() - target.lastSeenAt.getTime() < WINDOW_MS;
      if (!inWindow && !deps.templatesReady) {
        result.skipped++;
        continue;
      }
      const [snap, profile] = await Promise.all([
        deps.student.snapshot(target.waId, {
          from: today,
          to: addDays(today, 8),
        }),
        deps.accounts.profile(target.waId),
      ]);
      const reminder = reminderFor(snap, deps.now, profile.hideDetails);
      if (!reminder) {
        result.nothing++;
        continue;
      }
      if (!(await deps.claim(target.waId))) {
        result.skipped++;
        continue;
      }
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
      result.failed++;
      log.error(
        "reminder: failed",
        error instanceof Error ? error.name : "unknown",
      );
    }
  }
  return result;
}
