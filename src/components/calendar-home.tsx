import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/rules/dates";
import { ScheduleDay } from "./schedule-day";
import {
  loadFeeds,
  hasUnsyncedCourses,
  loadNotices,
  loadWeekData,
  requestTime,
} from "@/lib/calendar/load";
import { madridDate, weekRange, weekStart } from "@/lib/rules/week";
import { Notices } from "./notices";
import { SyncStatus } from "./sync-status";
import { TodayList } from "./today-list";

// The calendar part of Home: notices, Today, the weekly check and sync status.
// A student without a calendar gets none of it, and no sync request.
export async function CalendarHome() {
  const feeds = await loadFeeds();
  if (feeds.length === 0) return null;
  const now = requestTime();
  const today = madridDate(new Date(now).toISOString());
  const supabase = await createClient();
  const tomorrow = addDays(today, 1);
  const [notices, week, soon, checks, unsynced] = await Promise.all([
    loadNotices(),
    loadWeekData(weekRange(today)),
    loadWeekData({ from: today, to: tomorrow }),
    supabase
      .from("weekly_checks")
      .select("week_start")
      .eq("week_start", weekStart(today)),
    hasUnsyncedCourses(),
  ]);
  return (
    <>
      <Notices notices={notices} />
      <TodayList
        today={today}
        sessions={week.sessions}
        courses={week.courses}
        skips={week.skips}
        assessments={week.assessments}
        checkedThisWeek={(checks.data ?? []).length > 0}
      />
      <section aria-labelledby="tomorrow-h" className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="tomorrow-h" className="m-0 text-lg font-bold">
            Tomorrow
          </h2>
          <Link
            href="/app/schedule"
            className="inline-flex min-h-11 items-center text-[15px] font-semibold underline"
          >
            Whole week
          </Link>
        </div>
        <ScheduleDay
          day={tomorrow}
          today={today}
          data={soon}
          empty="No classes tomorrow."
        />
      </section>
      <SyncStatus feeds={feeds} now={now} unsynced={unsynced} />
    </>
  );
}
