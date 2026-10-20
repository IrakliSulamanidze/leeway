"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    sendMagicLink,
    null,
  );
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form action={action} className="flex flex-col gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          aria-label="Email"
          className="rounded-md border px-3 py-2"
        />
        <button
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send login link"}
        </button>
      </form>
      {state && <p role="status">{state.message}</p>}
    </main>
  );
}
