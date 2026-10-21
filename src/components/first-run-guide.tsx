import Link from "next/link";
import { hideGuide } from "@/app/app/guide-actions";

const BUTTON =
  "flex min-h-[52px] flex-1 items-center justify-center rounded-xl px-3 text-center font-semibold whitespace-nowrap";

// A new student's way in, on top of the Skip tab until "Got it" or the end of
// the tour. Inline, never a dialog: it shows the same before and after a save,
// so the skip box under it doesn't move.
export function FirstRunGuide({ calendar }: { calendar: boolean }) {
  return (
    <section
      aria-labelledby="guide-h"
      className="grid gap-3 rounded-xl border border-line bg-surface px-4 py-3"
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
      <div className="flex flex-wrap gap-2">
        <Link
          href="/app?tour=0"
          scroll={false}
          className={`${BUTTON} bg-primary text-on-primary`}
        >
          Show me around
        </Link>
        {!calendar && (
          <Link
            href="/app/calendar"
            className={`${BUTTON} border border-line-input`}
          >
            Connect calendar
          </Link>
        )}
      </div>
    </section>
  );
}
