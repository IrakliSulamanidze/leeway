"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/app/actions";

// Two taps, no dialog. On success the action signs out and leaves for "/".
export function DeleteAccount() {
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (pending) return;
    startTransition(async () => {
      const res = await deleteAccount();
      if (res && !res.ok) setFailed(true);
    });
  }

  const danger =
    "flex min-h-[52px] w-full items-center justify-center rounded-xl bg-danger px-5 text-[17px] font-semibold text-on-primary";
  return (
    <div className="grid gap-2.5">
      <div>
        Delete my account and data
        <span className="block text-[13.5px] text-muted">
          Removes your account, every course and every skip. This can&apos;t be
          undone.
        </span>
      </div>
      {asking ? (
        <>
          <button
            type="button"
            aria-disabled={pending}
            onClick={confirm}
            className={danger}
          >
            Yes, delete everything
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="min-h-11 text-[15px] font-semibold text-ink underline"
          >
            Keep my account
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className={danger}
        >
          Delete my account
        </button>
      )}
      {failed && (
        <p role="alert" className="m-0 text-[15px] font-semibold text-danger">
          Couldn&apos;t delete. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
