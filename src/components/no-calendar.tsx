import Link from "next/link";

// A calendar-only page for a student with no calendar: what it would show,
// and the one button that gets them there.
export function NoCalendar({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-4 px-5 py-6">
      <h1 className="m-0 text-[28px] font-bold">{title}</h1>
      {children}
      <p className="m-0 text-muted">
        It needs your timetable, so connect your IE calendar first.
      </p>
      <Link
        href="/app/calendar"
        data-tour="connect"
        className="flex min-h-[52px] items-center justify-center rounded-xl bg-primary px-5 font-semibold text-on-primary sm:max-w-xs"
      >
        Connect your IE calendar
      </Link>
    </main>
  );
}
