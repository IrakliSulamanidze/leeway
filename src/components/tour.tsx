"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { hideGuide } from "@/app/app/guide-actions";

type Stop = {
  path: string;
  title: string;
  // Keyed by the data-tour mark it points at; the first one on the page wins.
  say: Record<string, string>;
  // Left out for a student with no calendar: there is nothing to show yet.
  calendarOnly?: boolean;
};

const ALL_STOPS: Stop[] = [
  {
    path: "/app",
    title: "Skip a class",
    say: {
      skip: "Type a class. You see how many lives the skip costs before you save it.",
    },
  },
  {
    path: "/app/schedule",
    title: "Your calendar",
    say: {
      grid: "Your IE timetable. Tap any class to skip it, mark it missed or mark a test.",
      connect:
        "Connect your IE calendar with the link from Blackboard. It adds every course with its real lives, and unlocks your week and Plan a trip.",
    },
  },
  {
    path: "/app/schedule",
    title: "Plan a trip",
    say: {
      "trip-button":
        "Going away? Pick the days and see what they cost in every course, tests included.",
    },
    calendarOnly: true,
  },
  {
    path: "/app/courses",
    title: "Your courses",
    say: {
      courses:
        "Lives left in each course, fewest first. Tap one for its classes and tests.",
      "courses-title":
        "Every course from your calendar shows up here with its lives.",
    },
    calendarOnly: true,
  },
  {
    path: "/app/settings",
    title: "Night-before alerts",
    say: {
      alerts:
        "Turn these on and Leeway warns you around 21:00 when tomorrow's class is risky.",
    },
  },
];

export function tourStops(calendar: boolean) {
  return ALL_STOPS.filter((s) => calendar || !s.calendarOnly);
}

type Box = { top: number; left: number; width: number; height: number };
type Card = { top: number; left: number; width: number; arrow: Arrow };
type Arrow = { side: "top" | "bottom" | "left"; at: number } | null;
type Found = { at: string; step: number; key: string; el: HTMLElement };

const PAD = 8;
const GAP = 14;
const EDGE = 16;
const DIM = "0 0 0 200vmax rgb(10 10 14 / 0.62)";

function find(stop: Stop) {
  for (const key of Object.keys(stop.say)) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${key}"]`);
    if (el && el.getClientRects().length > 0) return { key, el };
  }
  return null;
}

// Height of the phone tab bar, which stays lit above the dimmed page.
function tabsHeight() {
  const tabs = document.querySelector<HTMLElement>('[data-tabs="bottom"]');
  return tabs && getComputedStyle(tabs).display !== "none"
    ? tabs.offsetHeight
    : 0;
}

// The walk through the app that "Show me around" starts. The step lives in
// ?tour=N, so it only ever opens when asked, and Back and Next move between
// real pages. The page stays dimmed between stops and the light opens on the
// next thing, so nothing jumps. The lit part and the tabs stay tappable.
export function Tour({ calendar }: { calendar: Promise<boolean> }) {
  const hasCalendar = use(calendar);
  const stops = useMemo(() => tourStops(hasCalendar), [hasCalendar]);
  const router = useRouter();
  const path = usePathname();
  const raw = useSearchParams().get("tour");
  const step = raw !== null && /^\d$/.test(raw) ? Number(raw) : -1;
  const stop = stops[step]?.path === path ? stops[step] : undefined;
  const at = stop ? `${step}:${path}` : "";

  const [found, setFound] = useState<Found>();
  const [box, setBox] = useState<Box>();
  const [card, setCard] = useState<Card>();
  const [moving, setMoving] = useState(false);
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);

  const open = Boolean(stop) || pending;
  const ready = found?.at === at && Boolean(card);
  const shown = found ? stops[found.step] : undefined;

  const go = useCallback(
    (n: number) =>
      startTransition(() =>
        router.push(`${stops[n].path}?tour=${n}`, { scroll: false }),
      ),
    [router, stops],
  );
  const close = useCallback(() => {
    setFound(undefined);
    router.replace(path, { scroll: false });
  }, [router, path]);
  const finish = useCallback(
    (to: string) =>
      startTransition(async () => {
        await hideGuide();
        setFound(undefined);
        router.push(to);
      }),
    [router],
  );

  // Warm up every stop so Next doesn't wait on the server.
  useEffect(() => {
    if (open) for (const s of stops) router.prefetch(s.path);
  }, [open, stops, router]);

  // Light the tabs above the dim layer while the tour is open.
  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.touring = "";
    return () => {
      delete root.dataset.touring;
    };
  }, [open]);

  // The page may still be streaming in: look for the mark for up to 3 s. A
  // new page jumps straight to it under the dim; on the same page it glides.
  useEffect(() => {
    if (!stop) return;
    let tries = 0;
    const timer = setInterval(() => {
      const hit = find(stop);
      if (!hit && ++tries <= 30) return;
      clearInterval(timer);
      if (hit) {
        // On a phone the part goes to the top so the card fits under it; on a
        // laptop it stays below the header, whose tabs are lit too.
        const r = hit.el.getBoundingClientRect();
        const wide = window.innerWidth >= 1024;
        const top = r.top + window.scrollY - (wide ? 96 : 16);
        const samePage = found?.el.isConnected;
        window.scrollTo({
          top: Math.max(0, top),
          behavior: samePage ? "smooth" : "instant",
        });
      }
      setMoving(true);
      setTimeout(() => setMoving(false), 500);
      setFound({
        at,
        step,
        key: hit?.key ?? "",
        el: hit?.el ?? document.body,
      });
    }, 60);
    return () => clearInterval(timer);
    // found is read only to tell a glide from a page change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, at, step]);

  // Follow the lit part on scroll and resize. The card goes beside it on a
  // laptop when there's room, else under it, over it, or docked at the bottom.
  useLayoutEffect(() => {
    if (!found) return;
    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight - tabsHeight();
      const h = panel.current?.offsetHeight ?? 200;
      if (!found.key) {
        setBox(undefined);
        setCard({
          top: vh - h - EDGE,
          left: EDGE,
          width: Math.min(380, vw - EDGE * 2),
          arrow: null,
        });
        return;
      }
      const r = found.el.getBoundingClientRect();
      const top = Math.max(r.top - PAD, 8);
      const bottom = Math.min(r.bottom + PAD, vh - 8);
      const b = {
        top,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: Math.max(bottom - top, 0),
      };
      setBox(b);
      const width = Math.min(380, vw - EDGE * 2);
      const left = Math.min(Math.max(r.left, EDGE), vw - width - EDGE);
      const pointX = (x: number) =>
        Math.min(Math.max(r.left + r.width / 2 - x, 24), width - 24);
      const side = vw - (b.left + b.width) - GAP - EDGE;
      if (side >= 300) {
        const w = Math.min(360, side);
        const t = Math.min(
          Math.max(b.top, EDGE),
          Math.max(EDGE, vh - h - EDGE),
        );
        const mid = Math.min(Math.max(b.top + 28 - t, 24), h - 24);
        setCard({
          top: t,
          left: b.left + b.width + GAP,
          width: w,
          arrow: { side: "left", at: mid },
        });
      } else if (b.top + b.height + GAP + h <= vh - 8)
        setCard({
          top: b.top + b.height + GAP,
          left,
          width,
          arrow: { side: "top", at: pointX(left) },
        });
      else if (b.top - GAP - h >= EDGE)
        setCard({
          top: b.top - GAP - h,
          left,
          width,
          arrow: { side: "bottom", at: pointX(left) },
        });
      else setCard({ top: vh - h - EDGE, left, width, arrow: null });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [found]);

  useEffect(() => {
    if (!ready) return;
    next.current?.focus({ preventScroll: true });
  }, [ready, at]);

  const last = step === stops.length - 1;
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      const typing = (e.target as HTMLElement).closest(
        "input, textarea, select",
      );
      if (typing || pending) return;
      if (e.key === "ArrowRight" && !last) go(step + 1);
      if (e.key === "ArrowLeft" && step > 0) go(step - 1);
    },
    [close, go, last, pending, step],
  );
  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onKey]);

  // Closed some other way (a tab, the lit link): forget the last stop so a
  // later tour doesn't open on it.
  if (!open && found) setFound(undefined);
  if (!open || !found || !shown) return null;

  // Between pages the light closes to a point and the page stays dim; on the
  // same page it stays put and then glides to the next part.
  const samePage = found.at.slice(found.at.indexOf(":") + 1) === path;
  const hole =
    box && (ready || samePage)
      ? box
      : box
        ? {
            top: box.top + box.height / 2,
            left: box.left + box.width / 2,
            width: 0,
            height: 0,
          }
        : undefined;
  const text = shown.say[found.key] ?? Object.values(shown.say)[0];
  const ease = moving
    ? "transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
    : "";

  return (
    <div className="tour-fade pointer-events-none fixed inset-0 z-40">
      {hole ? (
        <>
          <div
            aria-hidden="true"
            className={`fixed rounded-2xl ${ease}`}
            style={{ ...hole, boxShadow: DIM }}
          />
          <Blockers box={hole} />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-auto fixed inset-0"
          style={{ background: "rgb(10 10 14 / 0.62)" }}
        />
      )}
      {card && (
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-h"
          aria-describedby="tour-p"
          data-testid="tour"
          className={`pointer-events-auto fixed rounded-2xl bg-surface p-4 shadow-[0_12px_32px_rgba(0,0,0,0.28)] transition-opacity duration-200 motion-reduce:transition-none ${ease} ${ready ? "opacity-100" : "opacity-0"}`}
          style={{ top: card.top, left: card.left, width: card.width }}
        >
          {card.arrow && <Pointer arrow={card.arrow} />}
          <div key={found.at} className="tour-in grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className="sr-only">
                  Step {found.step + 1} of {stops.length}
                </span>
                {stops.map((s, i) => (
                  <i
                    key={`${s.path}${s.title}`}
                    aria-hidden="true"
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === found.step ? "w-5 bg-ink" : i < found.step ? "w-1.5 bg-ink/40" : "w-1.5 bg-line-input"}`}
                  />
                ))}
              </span>
              <button
                type="button"
                onClick={close}
                className="-mr-2 min-h-11 px-2 text-[15px] text-muted underline"
              >
                Skip tour
              </button>
            </div>
            <h2 id="tour-h" className="m-0 text-xl font-bold tracking-tight">
              {shown.title}
            </h2>
            <p id="tour-p" className="m-0 text-[15px] text-muted">
              {text}
            </p>
            <div className="mt-1 flex gap-2">
              {last && !hasCalendar ? (
                <>
                  <button
                    type="button"
                    onClick={() => finish("/app")}
                    disabled={pending}
                    className="min-h-11 rounded-xl border border-line-input px-4 font-semibold"
                  >
                    Done
                  </button>
                  <button
                    ref={next}
                    type="button"
                    onClick={() => finish("/app/calendar")}
                    disabled={pending}
                    className="min-h-11 flex-1 rounded-xl bg-primary px-4 font-semibold text-on-primary"
                  >
                    Connect my calendar
                  </button>
                </>
              ) : (
                <>
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => go(step - 1)}
                      disabled={pending}
                      className="min-h-11 rounded-xl border border-line-input px-4 font-semibold"
                    >
                      Back
                    </button>
                  )}
                  <button
                    ref={next}
                    type="button"
                    onClick={() => (last ? finish("/app") : go(step + 1))}
                    disabled={pending}
                    className="min-h-11 flex-1 rounded-xl bg-primary px-4 font-semibold text-on-primary"
                  >
                    {last ? "Done" : "Next"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Four see-through panes around the light: they swallow taps on the dimmed
// page and leave the lit part usable.
function Blockers({ box }: { box: Box }) {
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const pane = "pointer-events-auto fixed";
  return (
    <>
      <div className={`${pane} inset-x-0 top-0`} style={{ height: box.top }} />
      <div className={`${pane} inset-x-0 bottom-0`} style={{ top: bottom }} />
      <div
        className={`${pane} left-0`}
        style={{ top: box.top, height: box.height, width: box.left }}
      />
      <div
        className={`${pane} right-0`}
        style={{ top: box.top, height: box.height, left: right }}
      />
    </>
  );
}

// The small notch on the card's edge that points at the lit part.
function Pointer({ arrow }: { arrow: NonNullable<Arrow> }) {
  const at =
    arrow.side === "left" ? { top: arrow.at - 7 } : { left: arrow.at - 7 };
  const edge =
    arrow.side === "top"
      ? "-top-[7px]"
      : arrow.side === "bottom"
        ? "-bottom-[7px]"
        : "-left-[7px]";
  return (
    <span
      aria-hidden="true"
      className={`absolute ${edge} h-3.5 w-3.5 rotate-45 rounded-[3px] bg-surface`}
      style={at}
    />
  );
}
