"use client";

import { useActionState } from "react";
import { connectFeed, type ConnectState } from "./actions";

const INITIAL: ConnectState = { ok: false, error: null };

// The link goes only in the POST body of the server action. The field is
// uncontrolled, so React clears it after the action and the state never holds it.
export function ConnectForm() {
  const [state, action, pending] = useActionState(connectFeed, INITIAL);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="calendar-link" className="font-semibold">
        Paste the link
      </label>
      <input
        id="calendar-link"
        name="link"
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        required
        maxLength={2048}
        placeholder="webcal://…/calendar.ics"
        data-testid="calendar-link"
        className="min-h-11 rounded-xl border border-line-input bg-surface px-3 text-[17px]"
      />
      <button
        type="submit"
        disabled={pending}
        data-testid="calendar-connect"
        className="min-h-[52px] rounded-xl bg-primary px-4 font-semibold text-on-primary"
      >
        Connect
      </button>
      <p role="status" className="m-0 min-h-5 text-sm">
        {state.error ?? (state.ok ? "Connected. Syncing your calendar." : "")}
      </p>
    </form>
  );
}
