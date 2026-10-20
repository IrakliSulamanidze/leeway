import { createClient } from "@/lib/supabase/server";
import {
  loadFeeds,
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
  const [notices, week, checks] = await Promise.all([
    loadNotices(),
    loadWeekData(weekRange(today)),
    supabase
      .from("weekly_checks")
      .select("week_start")
      .eq("week_start", weekStart(today)),
  ]);
  return (
    <>
      <Notices notices={notices} />
      <TodayList
        today={today}
        sessions={week.sessions}
        courses={week.courses}
        skips={week.skips}
        checkedThisWeek={(checks.data ?? []).length > 0}
      />
      <SyncStatus feeds={feeds} now={now} />
    </>
  );
}
