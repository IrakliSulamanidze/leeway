"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { deleteSkip, logSkip } from "@/app/app/actions";
import { MAX_ITEM_LENGTH } from "@/lib/config";
import { nearMatch, normName } from "@/lib/rules/match";
import { asksLastSpare, previewLine } from "@/lib/rules/preview";
import type { Pace } from "@/lib/rules/lives";
import { LastSpareSheet } from "./last-spare-sheet";
import { Toast } from "./toast";

export type FormCourse = {
  name: string;
  lives: number;
  left: number;
  planned: number;
};
type Day = "today" | "tomorrow";
type Draft = { text: string; day: Day; sessions: 1 | 2 };

const STATE_COLOR: Record<Pace, string> = {
  over: "text-danger",
  out: "text-danger",
  last: "text-danger",
  burning: "text-warn",
  safe: "text-safe",
  "attendance-safe": "text-safe",
};

const OFFLINE = "Couldn't save. Check your connection and try again.";

// The core loop: type a class, one tap on "Log a skip". Chips, the preview,
// the near match and errors all sit in slots with reserved height, so the
// field and the button never move. Every save resets to Today, single class.
export function SkipForm({
  courses,
  weeksToGo,
  weekOfTerm,
}: {
  courses: FormCourse[];
  weeksToGo: number;
  weekOfTerm: number;
}) {
  const [text, setText] = useState("");
  const [day, setDay] = useState<Day>("today");
  const [double, setDouble] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [confirm, setConfirm] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);

  const sessions = double ? 2 : 1;
  const key = normName(text);
  const match = key ? courses.find((c) => normName(c.name) === key) : undefined;
  const near = match
    ? null
    : nearMatch(
        text,
        courses.map((c) => c.name),
      );
  const preview = previewLine({
    typed: text,
    course: match ? { lives: match.lives, left: match.left } : null,
    sessions,
    weeksToGo,
    weekOfTerm,
  });

  function choose(name: string) {
    setText(name);
    setError(null);
  }

  function save(draft: Draft) {
    saving.current = true;
    startTransition(async () => {
      try {
        const res = await logSkip(draft.text, draft.day, draft.sessions);
        if (res.ok) {
          setText("");
          setDay("today");
          setDouble(false);
          setToast({
            id: res.id,
            message:
              draft.day === "tomorrow"
                ? "Planned for tomorrow."
                : "Skip logged.",
          });
        } else setError(res.message);
      } catch {
        setError(OFFLINE);
      } finally {
        saving.current = false;
      }
    });
  }

  function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving.current) return;
    if (!text.trim()) {
      setError("Type the class you're skipping.");
      return;
    }
    const draft: Draft = { text, day, sessions };
    if (asksLastSpare(match, day, sessions)) setConfirm(draft);
    else save(draft);
  }

  const keepSpare = useCallback(() => setConfirm(null), []);
  function planAnyway() {
    const draft = confirm;
    setConfirm(null);
    if (draft && !saving.current) save(draft);
  }

  const closeToast = useCallback(() => setToast(null), []);
  function undo() {
    const id = toast?.id;
    setToast(null);
    if (id) startTransition(async () => void (await deleteSkip(id)));
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-2.5" noValidate>
      <label htmlFor="core-input" className="text-base font-semibold">
        Which class are you skipping?
      </label>
      <div
        className="-mx-5 flex h-11 gap-2 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:h-auto lg:min-h-11 lg:flex-wrap lg:overflow-visible lg:px-0"
        aria-label={courses.length ? "Your courses" : undefined}
        role={courses.length ? "group" : undefined}
      >
        {courses.map((c) => {
          const on = normName(c.name) === key;
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={on}
              onClick={() => choose(c.name)}
              className={`h-11 max-w-[70vw] flex-none truncate rounded-full border px-4 text-[15px] ${on ? "border-ink bg-ink font-semibold text-on-primary" : "border-line-input bg-surface text-ink"}`}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      <input
        id="core-input"
        type="text"
        data-testid="core-input"
        name="text"
        autoComplete="off"
        maxLength={MAX_ITEM_LENGTH}
        placeholder="e.g. Microeconomics"
        value={text}
        onChange={(e) => choose(e.target.value)}
        className="min-h-[52px] w-full rounded-xl border border-line-input bg-surface px-3.5 text-[17px]"
      />
      <div className="h-[63px] overflow-hidden">
        {error ? (
          <p
            role="alert"
            className="m-0 text-[15px] leading-[21px] font-semibold text-danger"
          >
            {error}
          </p>
        ) : near ? (
          <button
            type="button"
            onClick={() => choose(near)}
            className="min-h-11 max-w-full truncate text-left text-[15px] font-semibold text-ink underline"
          >
            Did you mean {near}?
          </button>
        ) : (
          <p
            aria-live="polite"
            className="m-0 text-[15px] leading-[21px] text-muted"
          >
            <PreviewText text={preview.text} state={preview.state} />
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Day"
          className="grid grid-cols-2 rounded-xl border border-line-input bg-surface p-0.5"
        >
          {(["today", "tomorrow"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={day === d}
              onClick={() => setDay(d)}
              className={`min-h-11 rounded-[10px] px-3.5 text-[15px] ${day === d ? "bg-ink font-semibold text-on-primary" : "text-ink"}`}
            >
              {d === "today" ? "Today" : "Tomorrow"}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={double}
          onClick={() => setDouble((v) => !v)}
          className="flex min-h-11 items-center gap-2 text-[15px] whitespace-nowrap text-ink"
        >
          <span
            aria-hidden="true"
            className={`relative h-6 w-10 flex-none rounded-full transition-colors ${double ? "bg-ink" : "bg-used"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-[left] ${double ? "left-[18px]" : "left-0.5"}`}
            />
          </span>
          Double class
        </button>
      </div>
      <button
        type="submit"
        data-testid="core-submit"
        aria-disabled={pending}
        className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-5 text-[17px] font-semibold text-on-primary"
      >
        Log a skip
      </button>
      {toast && (
        <Toast
          message={toast.message}
          actionLabel="Undo"
          onAction={undo}
          onClose={closeToast}
        />
      )}
      {confirm && match && (
        <LastSpareSheet
          course={match.name}
          lives={match.lives}
          left={match.left}
          planned={match.planned}
          onKeep={keepSpare}
          onPlan={planAnyway}
        />
      )}
    </form>
  );
}

// Verdict first in ink; the "N left" number in the state colour.
function PreviewText({ text, state }: { text: string; state: Pace | null }) {
  if (!state) return <>{text}</>;
  const cut = text.indexOf(". ");
  const head = cut === -1 ? text : text.slice(0, cut + 1);
  const rest = cut === -1 ? "" : text.slice(cut + 1);
  const parts = rest.split(/(\d+ left)/);
  return (
    <>
      <b className="font-semibold text-ink">{head}</b>
      {parts.map((p, i) =>
        /^\d+ left$/.test(p) ? (
          <span key={i} className={`font-bold ${STATE_COLOR[state]}`}>
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
