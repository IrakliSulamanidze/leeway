"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  NOT_STATED,
  READ_BUSY,
  READ_TOO_LONG,
  READ_TOO_SHORT,
  READ_WAITING,
} from "@/lib/syllabus/copy";
import {
  type Confirmed,
  type Review,
  type SavedTest,
  type SavedTopic,
  diffSaved,
  reviewFromRead,
} from "@/lib/syllabus/rows";
import { TEXT_MAX, TEXT_MIN } from "@/lib/syllabus/schema";
import { confirmSyllabus } from "./actions";

type Props = {
  courseId: string;
  courseName: string;
  dates: Record<number, string>;
  saved: { tests: SavedTest[]; topics: SavedTopic[] };
};

const BTN =
  "min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-60";
const MINI = "min-h-11 rounded-lg border border-line-input px-3 text-[15px]";

// Paste, one AI read, then a review the student confirms line by line.
export function ImportFlow({ courseId, courseName, dates, saved }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [step, setStep] = useState<"paste" | "reading" | "review">("paste");
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [session, setSession] = useState<Record<string, number | null>>({});
  const [weight, setWeight] = useState<Record<string, string>>({});
  const [keepTopics, setKeepTopics] = useState(true);
  const [saving, setSaving] = useState(false);

  async function read() {
    const t = text.trim();
    if (t.length < TEXT_MIN) return setError(READ_TOO_SHORT);
    if (t.length > TEXT_MAX) return setError(READ_TOO_LONG);
    setError("");
    setStep("reading");
    try {
      const res = await fetch("/api/syllabus/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, text: t }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || READ_BUSY);
      const r = reviewFromRead(body.read);
      setReview(r);
      setKeep(Object.fromEntries(r.tests.map((l) => [l.key, true])));
      setSession(Object.fromEntries(r.tests.map((l) => [l.key, l.session])));
      setWeight(
        Object.fromEntries(
          r.tests.map((l) => [l.key, l.weight == null ? "" : String(l.weight)]),
        ),
      );
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : READ_BUSY);
      setStep("paste");
    }
  }

  if (step === "reading")
    return (
      <p role="status" className="mt-6 text-[17px]">
        {READ_WAITING}
      </p>
    );

  if (step === "paste" || !review)
    return (
      <div className="mt-5 grid gap-3">
        <label htmlFor="syllabus-text" className="font-semibold">
          Paste the syllabus text
        </label>
        <textarea
          id="syllabus-text"
          data-testid="syllabus-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="rounded-xl border border-line-input bg-surface p-3 text-[16px]"
        />
        {error && (
          <p role="alert" className="m-0 text-danger">
            {error}
          </p>
        )}
        <button type="button" onClick={read} className={BTN}>
          Read syllabus
        </button>
      </div>
    );

  const tests: Confirmed["tests"] = review.tests.flatMap((l) => {
    const s = session[l.key];
    if (!keep[l.key] || s == null) return [];
    const w = weight[l.key].trim();
    const n = w === "" ? null : Number(w);
    return [
      {
        session_number: s,
        title: l.title,
        weight: n != null && Number.isFinite(n) ? n : null,
        weight_assumed: l.assumed && n === l.weight,
      },
    ];
  });
  const topics: Confirmed["topics"] = keepTopics
    ? review.topics.map((t) => ({
        session_number: t.number,
        topic: t.topic,
        pre_reading: t.pre_reading,
        probably: t.probably,
      }))
    : [];
  const unanswered = review.tests.some(
    (l) => keep[l.key] && session[l.key] == null,
  );
  const reimport = saved.tests.length > 0 || saved.topics.length > 0;
  const changes = reimport ? diffSaved(saved, { tests, topics }) : [];
  const when = (n: number | null) =>
    n == null ? "" : dates[n] ? ` · ${dates[n]}` : "";

  async function confirm() {
    setSaving(true);
    const res = await confirmSyllabus({
      courseId,
      sessionsTotal: review!.sessionsTotal,
      participation: review!.participation,
      tests,
      topics,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    router.push(`/app/courses/${courseId}`);
  }

  return (
    <div className="mt-5 grid gap-4">
      <h2 className="m-0 text-xl font-bold">Check your syllabus</h2>
      <p className="m-0 text-sm text-muted">
        {courseName}
        {review.sessionsTotal ? ` · ${review.sessionsTotal} sessions` : ""}.
        Nothing is saved until you confirm.
      </p>

      {review.conflicts.map((c) => (
        <p key={c} className="m-0 rounded-xl border border-line p-3">
          {c} Untick the lines that are wrong.
        </p>
      ))}

      {review.tests.length === 0 && (
        <p className="m-0">
          This syllabus doesn&apos;t say which session any test is in. Mark them
          on the calendar once you know.
        </p>
      )}
      <ul className="grid gap-2">
        {review.tests.map((l) => (
          <li
            key={l.key}
            data-testid="syllabus-line"
            className="grid gap-2 rounded-xl border border-line bg-surface p-3"
          >
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={keep[l.key]}
                onChange={(e) =>
                  setKeep({ ...keep, [l.key]: e.target.checked })
                }
              />
              <span>
                <b>
                  {session[l.key] == null
                    ? "Session ?"
                    : `Session ${session[l.key]}`}
                </b>{" "}
                · {l.title}
                {when(session[l.key])}
              </span>
            </label>
            {l.options.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span>Which day does your group present?</span>
                {l.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={session[l.key] === o}
                    onClick={() => setSession({ ...session, [l.key]: o })}
                    className={`${MINI} ${session[l.key] === o ? "bg-primary text-on-primary" : ""}`}
                  >
                    Session {o}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              Weight %
              <input
                type="text"
                inputMode="decimal"
                value={weight[l.key]}
                onChange={(e) =>
                  setWeight({ ...weight, [l.key]: e.target.value })
                }
                className="min-h-11 w-20 rounded-lg border border-line-input px-2"
              />
              {l.assumed && <span className="text-muted">assumed</span>}
            </label>
            <q className="text-sm text-muted">{l.quote}</q>
          </li>
        ))}
      </ul>

      <dl className="m-0 grid gap-1 text-sm">
        <dt className="font-semibold">Below 80%</dt>
        <dd className="m-0">{review.penalty ?? NOT_STATED}</dd>
        <dt className="font-semibold">Retake students</dt>
        <dd className="m-0" data-testid="syllabus-retake">
          {review.retake.statedHere
            ? review.retake.general
            : NOT_STATED +
              (review.retake.general
                ? ` here. IE's general rule: ${review.retake.general}`
                : "")}
        </dd>
      </dl>

      {review.topics.length > 0 && (
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={keepTopics}
            onChange={(e) => setKeepTopics(e.target.checked)}
          />
          Save the topics of {review.topics.length} sessions
        </label>
      )}

      {reimport && (
        <section className="grid gap-1">
          <h3 className="m-0 font-semibold">What changed</h3>
          {changes.length === 0 ? (
            <p className="m-0 text-sm text-muted">Nothing changed.</p>
          ) : (
            <ul className="m-0 grid gap-1 p-0">
              {changes.map((c) => (
                <li
                  key={`${c.what}-${c.session}-${c.kind}`}
                  data-testid="syllabus-change"
                  className="list-none text-sm"
                >
                  {c.session ? `Session ${c.session}` : "No date"}: {c.kind} ·{" "}
                  {c.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={saving || unanswered}
        className={BTN}
      >
        Confirm and save
      </button>
    </div>
  );
}
