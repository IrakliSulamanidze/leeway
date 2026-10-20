import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";
import { loadFeeds, loadPendingMaps, requestTime } from "@/lib/calendar/load";
import { SyncStatus } from "@/components/sync-status";
import { APP_NAME } from "@/lib/config";
import { disconnectFeed, mapCourse } from "./actions";
import { ConnectForm } from "./connect-form";

export const metadata = { title: "Calendar" };

const SOURCES = [
  ["Blackboard", "Calendar, gear icon, Get external calendar link"],
  ["My IE Agenda", "Copy the subscription link"],
  ["Google, iPhone or Outlook", "Any calendar link that ends in .ics"],
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// "STATISTICS II BBA2 S1 SEC2" -> "Statistics II": drop programme and section
// codes, then title case words that are not roman numerals.
function suggestName(key: string): string {
  return key
    .split(/\s+/)
    .filter((w) => !/^(BBA|BIR|BCSAI|BDBA|S\d|SEC\d|GR\d|[A-Z]+\d+)$/i.test(w))
    .map((w) =>
      /^[IVX]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase(),
    )
    .join(" ")
    .slice(0, 200);
}

const ROW = "min-h-11 rounded-xl px-3 font-semibold";

export default async function CalendarPage() {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const [feeds, pending, courses, mapped] = await Promise.all([
    loadFeeds(),
    loadPendingMaps(),
    supabase.from("courses").select("id, name").order("name"),
    supabase
      .from("feed_course_map")
      .select("id", { count: "exact", head: true })
      .eq("status", "mapped"),
  ]);
  const existing = courses.data ?? [];

  return (
    <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-5 px-5 py-6">
      {pending.length > 0 && (
        <section aria-labelledby="mapping-h" className="grid gap-3">
          <h1 id="mapping-h" className="text-[28px] font-bold">
            We found {pending.length}{" "}
            {pending.length === 1 ? "course" : "courses"}
          </h1>
          <p className="m-0 text-sm text-muted">
            Check each name once. Other events are never saved.
          </p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {pending.map((m) => {
              const name = suggestName(m.source_key);
              const match = existing.find((c) => norm(c.name) === norm(name));
              return (
                <li key={m.id} className="grid gap-2 px-4 py-3">
                  <span className="text-sm break-words text-muted">
                    {m.source_key}
                  </span>
                  <form action={mapCourse} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    {match ? (
                      <>
                        <input type="hidden" name="course" value={match.id} />
                        <span className="flex min-h-11 flex-1 items-center font-semibold">
                          {match.name}
                        </span>
                        <button
                          name="choice"
                          value="link"
                          className={`${ROW} bg-primary text-on-primary`}
                        >
                          Link
                        </button>
                      </>
                    ) : (
                      <>
                        <label className="sr-only" htmlFor={`name-${m.id}`}>
                          Course name
                        </label>
                        <input
                          id={`name-${m.id}`}
                          name="name"
                          type="text"
                          defaultValue={name}
                          maxLength={200}
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-input px-3 text-[17px]"
                        />
                        <button
                          name="choice"
                          value="new"
                          className={`${ROW} bg-primary text-on-primary`}
                        >
                          Add
                        </button>
                      </>
                    )}
                    <button
                      name="choice"
                      value="ignore"
                      className={`${ROW} text-muted underline`}
                    >
                      Not a course
                    </button>
                  </form>
                  {!match && existing.length > 0 && (
                    <form action={mapCourse} className="flex gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="choice" value="link" />
                      <label className="sr-only" htmlFor={`link-${m.id}`}>
                        Link to a course you have
                      </label>
                      <select
                        id={`link-${m.id}`}
                        name="course"
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-input bg-surface px-2"
                      >
                        {existing.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button className={`${ROW} border border-line-input`}>
                        Link
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {feeds.length > 0 && (
        <section aria-label="Connected calendars" className="grid gap-2">
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {feeds.map((f, i) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 px-4 py-2"
                data-testid="calendar-feed"
              >
                <span className="grid">
                  <span className="font-semibold">
                    {i === 0 ? "IE calendar" : `Calendar ${i + 1}`} · connected
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
          </ul>
          <SyncStatus
            feeds={feeds}
            now={requestTime()}
            mapped={mapped.count ?? 0}
          />
        </section>
      )}

      {feeds.length < 3 && (
        <section aria-labelledby="connect-h" className="grid gap-3">
          <h1 id="connect-h" className="text-[28px] font-bold">
            Connect your calendar
          </h1>
          <p className="m-0 text-sm text-muted">
            {APP_NAME} counts your sessions and finds your exams. Your link
            stays private.
          </p>
          <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
            {SOURCES.map(([title, steps], i) => (
              <li key={title} className="grid px-4 py-3">
                <span className={i === 0 ? "font-bold" : "font-semibold"}>
                  {title}
                </span>
                <span className="text-sm text-muted">{steps}</span>
              </li>
            ))}
          </ol>
          <ConnectForm />
          <p className="m-0 text-sm text-muted">
            You can skip this. Everything works without a calendar.
          </p>
        </section>
      )}
    </main>
  );
}
