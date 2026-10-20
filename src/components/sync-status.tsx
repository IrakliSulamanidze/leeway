"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FEED_ERRORS } from "@/lib/calendar/errors";

export type SyncFeed = {
  id: string;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
};

const FRESH_MS = 15 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const weekday = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  }).format(new Date(iso));

// Syncs after first paint when the last sync is older than 15 minutes. It only
// calls router.refresh(), which keeps whatever the student is typing.
// With no calendar it renders nothing and sends nothing.
export function SyncStatus({ feeds, now }: { feeds: SyncFeed[]; now: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const sync = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setBusy(true);
      try {
        await Promise.all(
          ids.map((feedId) =>
            fetch("/api/calendar/sync", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ feedId }),
            }),
          ),
        );
      } catch {
        // The banner shows the stored status after the refresh.
      } finally {
        setBusy(false);
        router.refresh();
      }
    },
    [router],
  );

  useEffect(() => {
    if (started.current || feeds.length === 0) return;
    started.current = true;
    const due = feeds
      .filter(
        (f) =>
          !f.last_synced_at ||
          now - new Date(f.last_synced_at).getTime() > FRESH_MS,
      )
      .map((f) => f.id);
    const t = setTimeout(() => void sync(due), 0);
    return () => clearTimeout(t);
  }, [feeds, now, sync]);

  if (feeds.length === 0) return null;

  const failed = feeds.find((f) => f.status === "failed");
  const synced = feeds
    .map((f) => f.last_synced_at)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const stale = synced && now - new Date(synced).getTime() > STALE_MS;
  const all = () => void sync(feeds.map((f) => f.id));

  if (failed)
    return (
      <div role="status" className="mt-4 grid gap-2">
        <p className="m-0 font-semibold">
          {failed.last_error === FEED_ERRORS.glitch || !failed.last_error
            ? "Your calendar looks incomplete. Try again."
            : `${failed.last_error} Try again.`}
        </p>
        <p className="m-0 text-sm text-muted">
          {synced
            ? `Last good sync ${clock(synced)}. Nothing was removed.`
            : "Nothing was removed."}
        </p>
        <button
          type="button"
          onClick={all}
          disabled={busy}
          className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary"
        >
          {busy ? "Syncing" : "Try again"}
        </button>
      </div>
    );

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <span role="status">
        {busy
          ? "Syncing your calendar"
          : synced
            ? stale
              ? `Calendar as of ${weekday(synced)} · unmarked classes count as attended`
              : `Last synced ${clock(synced)} · unmarked classes count as attended`
            : "Syncing your calendar"}
      </span>
      <button
        type="button"
        onClick={all}
        disabled={busy}
        className="min-h-11 min-w-11 px-2 text-ink underline"
      >
        Refresh
      </button>
    </div>
  );
}
