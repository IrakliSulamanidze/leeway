import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/session";
import { loadFeeds, loadPendingMaps, requestTime } from "@/lib/calendar/load";
import { SyncStatus } from "@/components/sync-status";
import { APP_NAME } from "@/lib/config";
import { normName, suggestName } from "@/lib/calendar/names";
import { addAllCourses, disconnectFeed, mapCourse } from "./actions";
import { ConnectForm } from "./connect-form";

export const metadata = { title: "Calendar" };

const STEPS = [
  "Open Blackboard and go to Calendar.",
  "Tap the gear icon, then Get external calendar link.",
  "Copy the link and paste it below.",
];

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
    <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-5 px-5 py-5">
      <Link
        href="/app/schedule"
        className="-my-2 justify-self-start py-3 text-[15px] font-semibold text-ink underline"
      >
        Back to your calendar
      </Link>
      {pending.length > 0 && (
        <section aria-labelledby="mapping-h" className="grid gap-3">
          <h1 id="mapping-h" className="text-[28px] font-bold">
            We found {pending.length}{" "}
            {pending.length === 1 ? "course" : "courses"}
          </h1>
          <p className="m-0 text-sm text-muted">
            Check each name once. Other events are never saved.
          </p>
          {pending.length > 1 && (
            <form action={addAllCourses}>
              <button className={`${ROW} w-full bg-primary text-on-primary`}>
                Add all {pending.length}
              </button>
            </form>
          )}
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {pending.map((m) => {
              const name = suggestName(m.source_key);
              const match = existing.find(
                (c) => normName(c.name) === normName(name),
              );
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
          {pending.length === 0 && (mapped.count ?? 0) > 0 && (
            <Link
              href="/app/courses/missed?next=schedule"
              className={`${ROW} flex items-center justify-center bg-primary text-on-primary`}
            >
              Next
            </Link>
          )}
        </section>
      )}

      {feeds.length < 3 && (
        <section aria-labelledby="connect-h" className="grid gap-3">
          <h1 id="connect-h" className="text-[28px] font-bold">
            Connect your calendar
          </h1>
          <p className="m-0 text-sm text-muted">
            {APP_NAME} adds your courses, counts their sessions and warns you
            the night before a risky class. Only you can see your link.
          </p>
          <ol className="m-0 grid gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 flex-none place-items-center rounded-full border border-line-input text-[13px] font-bold"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <ConnectForm />
          <details className="text-sm text-muted">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">
              Using My IE Agenda or another calendar?
            </summary>
            <p className="m-0">
              My IE Agenda: copy its subscription link. Google, iPhone or
              Outlook: any calendar link that ends in .ics works too.
            </p>
          </details>
          <p className="m-0 text-sm text-muted">
            You can skip this. Everything works without a calendar.
          </p>
        </section>
      )}
    </main>
  );
}
