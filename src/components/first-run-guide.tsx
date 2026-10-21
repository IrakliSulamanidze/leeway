import Link from "next/link";
import { hideGuide } from "@/app/app/guide-actions";
import { Step } from "./get-started";

const STEPS = [
  {
    href: "/app/schedule",
    title: "Tap a class to skip it",
    note: "On Calendar. You see what it costs first.",
  },
  {
    href: "/app/plan",
    title: "Plan a trip",
    note: "Pick the dates. See what the trip costs.",
  },
];

// A new student's map of the app, on top of the Skip tab until "Got it".
// Inline, never a dialog: it shows the same before and after a save, so the
// skip box under it doesn't move.
export function FirstRunGuide({ calendar }: { calendar: boolean }) {
  return (
    <section
      aria-labelledby="guide-h"
      className="grid gap-2 rounded-xl border border-line bg-surface px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="guide-h" className="m-0 text-xl font-bold tracking-tight">
          Start here
        </h2>
        <form action={hideGuide}>
          <button className="-mr-2 min-h-11 px-2 text-[15px] font-semibold text-muted underline">
            Got it
          </button>
        </form>
      </div>
      <p className="m-0 text-[15px] text-muted">
        Every course gives you lives: the classes you can miss before the 80%
        rule fails you.
      </p>
      <ol className="m-0 grid gap-1 p-0">
        <li className="flex gap-3 py-1">
          <Step n={1} done={calendar} />
          {calendar ? (
            <span className="grid">
              <b className="font-semibold">IE calendar connected</b>
              <span className="text-sm text-muted">
                Your courses and lives come from it.
              </span>
            </span>
          ) : (
            <Link href="/app/calendar" className="grid min-h-11 flex-1">
              <b className="font-semibold underline">
                Connect your IE calendar
              </b>
              <span className="text-sm text-muted">
                Adds your courses and their real lives.
              </span>
            </Link>
          )}
        </li>
        {STEPS.map((s, i) => (
          <li key={s.href} className="flex gap-3 py-1">
            <Step n={i + 2} done={false} />
            <Link href={s.href} className="grid min-h-11 flex-1">
              <b className="font-semibold underline">{s.title}</b>
              <span className="text-sm text-muted">{s.note}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
