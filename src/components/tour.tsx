"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { hideGuide } from "@/app/app/guide-actions";

type Stop = {
  path: string;
  title: string;
  // Keyed by the data-tour mark it points at; the first one on the page wins.
  // Without a calendar, Calendar and Plan a trip point at the connect button.
  say: Record<string, string>;
};

const CONNECT =
  "Needs your IE calendar. Connect it here with the link from Blackboard: it adds every course and its real lives.";

export const STOPS: Stop[] = [
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
      connect: CONNECT,
    },
  },
  {
    path: "/app/plan",
    title: "Plan a trip",
    say: {
      trip: "Pick the days you'll be away. See what the trip costs in every course, tests included.",
      connect: CONNECT,
    },
  },
  {
    path: "/app/courses",
    title: "Your courses",
    say: {
      courses:
        "Lives left in each course, fewest first. Tap one for its classes and tests.",
      "courses-title":
        "Every course shows up here with its lives, once you connect your calendar or log a skip.",
    },
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

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;
const GAP = 12;

function find(stop: Stop) {
  for (const key of Object.keys(stop.say)) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${key}"]`);
    if (el && el.offsetParent !== null) return { key, el };
  }
  return null;
}

// The walk through the app that "Show me around" starts. The step lives in
// ?tour=N, so it only ever opens when asked, and Back and Next are links
// between real pages. Each stop lights up a real part of the page.
export function Tour() {
  const router = useRouter();
  const path = usePathname();
  const raw = useSearchParams().get("tour");
  const step = raw !== null && /^\d$/.test(raw) ? Number(raw) : -1;
  const stop = STOPS[step]?.path === path ? STOPS[step] : undefined;

  const at = stop ? `${step}:${path}` : "";
  const [found, setTarget] = useState<{
    at: string;
    key: string;
    el: HTMLElement;
  }>();
  // Only what was found for this stop counts; an older find waits to be replaced.
  const target = found?.at === at ? found : undefined;
  const [box, setBox] = useState<Box>();
  const [card, setCard] = useState({ top: 0, left: 0, docked: true });
  const panel = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);

  const go = useCallback(
    (n: number) => router.push(`${STOPS[n].path}?tour=${n}`, { scroll: false }),
    [router],
  );
  const close = useCallback(() => router.replace(path), [router, path]);
  const finish = useCallback(async () => {
    await hideGuide();
    router.push("/app");
  }, [router]);

  // The page may still be streaming in: look for the mark for up to 3 s.
  useEffect(() => {
    if (!stop) return;
    let tries = 0;
    const timer = setInterval(() => {
      const hit = find(stop);
      if (hit || ++tries > 30) {
        clearInterval(timer);
        if (hit) {
          const top = hit.el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: Math.max(0, top - 88), behavior: "smooth" });
          setTarget({ at, ...hit });
        } else setTarget({ at, key: "", el: document.body });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [stop, at]);

  // Follow the target on scroll and resize; the card sits under it, above it,
  // or docked at the bottom when neither fits.
  useLayoutEffect(() => {
    if (!target) return;
    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const h = panel.current?.offsetHeight ?? 220;
      const w = Math.min(380, vw - 32);
      if (!target.key) {
        setBox(undefined);
        setCard({ top: 0, left: 0, docked: true });
        return;
      }
      const r = target.el.getBoundingClientRect();
      const top = Math.max(r.top - PAD, 8);
      const bottom = Math.min(r.bottom + PAD, vh - 8);
      const b = {
        top,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: Math.max(bottom - top, 0),
      };
      setBox(b);
      const left = Math.min(Math.max(r.left, 16), vw - w - 16);
      if (b.top + b.height + GAP + h <= vh - 16)
        setCard({ top: b.top + b.height + GAP, left, docked: false });
      else if (b.top - GAP - h >= 16)
        setCard({ top: b.top - GAP - h, left, docked: false });
      else setCard({ top: 0, left: 0, docked: true });
    };
    place();
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    next.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, close]);

  if (!stop || !target) return null;
  const last = step === STOPS.length - 1;
  const text = stop.say[target.key] ?? Object.values(stop.say)[0];

  return (
    <div className="fixed inset-0 z-40">
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-2xl ring-2 ring-white/80 transition-all duration-300 motion-reduce:transition-none"
          style={{ ...box, boxShadow: "0 0 0 200vmax rgb(10 10 14 / 0.6)" }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-[rgb(10_10_14/0.6)]"
        />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-h"
        aria-describedby="tour-p"
        data-testid="tour"
        className={`fixed grid gap-2 rounded-2xl bg-surface p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${card.docked ? "inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] mx-auto max-w-[380px]" : "w-[min(380px,calc(100vw-32px))]"}`}
        style={card.docked ? undefined : { top: card.top, left: card.left }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex gap-1.5">
            <span className="sr-only">
              Step {step + 1} of {STOPS.length}
            </span>
            {STOPS.map((s, i) => (
              <i
                key={s.path}
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-ink" : "w-1.5 bg-line-input"}`}
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
          {stop.title}
        </h2>
        <p id="tour-p" className="m-0 text-[15px] text-muted">
          {text}
        </p>
        <div className="mt-1 flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="min-h-11 rounded-xl border border-line-input px-4 font-semibold"
            >
              Back
            </button>
          )}
          <button
            ref={next}
            type="button"
            onClick={() => (last ? finish() : go(step + 1))}
            className="min-h-11 flex-1 rounded-xl bg-primary px-4 font-semibold text-on-primary"
          >
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
