"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { deleteSkip, logSkip } from "@/app/app/actions";
import { MAX_ITEM_LENGTH } from "@/lib/config";
import { normName } from "@/lib/rules/match";
import { previewLine } from "@/lib/rules/preview";
import type { Pace } from "@/lib/rules/lives";
import { Toast } from "./toast";

export type FormCourse = { name: string; lives: number; left: number };

const STATE_COLOR: Record<Pace, string> = {
  over: "text-danger",
  out: "text-danger",
  last: "text-danger",
  burning: "text-warn",
  safe: "text-safe",
  "attendance-safe": "text-safe",
};

const OFFLINE = "Couldn't save. Check your connection and try again.";

// The core loop: type a class, one tap on "Log a skip". The preview line and
// the error share one slot with reserved height, so nothing below it moves.
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
  const [error, setError] = useState<string | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);

  const key = normName(text);
  const match = key ? courses.find((c) => normName(c.name) === key) : undefined;
  const preview = previewLine({
    typed: text,
    course: match ? { lives: match.lives, left: match.left } : null,
    weeksToGo,
    weekOfTerm,
  });

  function onType(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    setError(null);
  }

  function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving.current) return;
    if (!text.trim()) {
      setError("Type the class you're skipping.");
      return;
    }
    saving.current = true;
    startTransition(async () => {
      try {
        const res = await logSkip(text);
        if (res.ok) {
          setText("");
          setUndoId(res.id);
        } else setError(res.message);
      } catch {
        setError(OFFLINE);
      } finally {
        saving.current = false;
      }
    });
  }

  const closeToast = useCallback(() => setUndoId(null), []);
  function undo() {
    const id = undoId;
    setUndoId(null);
    if (id) startTransition(async () => void (await deleteSkip(id)));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2.5" noValidate>
      <label htmlFor="core-input" className="text-base font-semibold">
        Which class are you skipping?
      </label>
      <input
        id="core-input"
        type="text"
        data-testid="core-input"
        name="text"
        autoComplete="off"
        maxLength={MAX_ITEM_LENGTH}
        placeholder="e.g. Microeconomics"
        value={text}
        onChange={onType}
        className="min-h-[52px] w-full rounded-xl border border-line-input bg-surface px-3.5 text-[17px]"
      />
      <p
        role={error ? "alert" : undefined}
        aria-live="polite"
        className={`m-0 h-[63px] overflow-hidden text-[15px] leading-[21px] ${error ? "font-semibold text-danger" : "text-muted"}`}
      >
        {error ?? <PreviewText text={preview.text} state={preview.state} />}
      </p>
      <button
        type="submit"
        data-testid="core-submit"
        aria-disabled={pending}
        className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-5 text-[17px] font-semibold text-on-primary"
      >
        Log a skip
      </button>
      {undoId && (
        <Toast
          message="Skip logged."
          actionLabel="Undo"
          onAction={undo}
          onClose={closeToast}
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
