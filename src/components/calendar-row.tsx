import Link from "next/link";
import { disconnectFeed } from "@/app/app/calendar/actions";
import { loadFeeds } from "@/lib/calendar/load";

const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

// Settings: each connected calendar with "Last synced" and Disconnect, or a
// link to connect one.
export async function CalendarRow() {
  const feeds = await loadFeeds();
  return (
    <ul
      aria-label="Calendar"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      {feeds.map((f, i) => (
        <li
          key={f.id}
          className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 first:border-t-0"
        >
          <span className="grid">
            <span>
              {i === 0 ? "IE calendar" : `Calendar ${i + 1}`} · connected
            </span>
            <span className="text-[13.5px] text-muted">
              {f.last_synced_at
                ? `Last synced ${clock(f.last_synced_at)}`
                : "Not synced yet"}
            </span>
          </span>
          <form action={disconnectFeed}>
            <input type="hidden" name="id" value={f.id} />
            <button className="min-h-11 px-2 text-muted underline">
              Disconnect
            </button>
          </form>
        </li>
      ))}
      {feeds.length < 3 && (
        <li className="border-t border-line first:border-t-0">
          <Link
            href="/app/calendar"
            className="flex min-h-11 items-center px-4 py-2"
          >
            {feeds.length
              ? "Connect another calendar"
              : "Connect your IE calendar"}
          </Link>
        </li>
      )}
    </ul>
  );
}
