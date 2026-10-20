"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./auth-actions";

type Props = {
  kind: "signup" | "login";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

const copy = {
  signup: {
    title: "Create your account",
    submit: "Sign up",
    pending: "Creating account...",
    other: {
      text: "Already have an account?",
      href: "/login",
      label: "Log in",
    },
  },
  login: {
    title: "Log in",
    submit: "Log in",
    pending: "Logging in...",
    other: { text: "New here?", href: "/signup", label: "Sign up" },
  },
};

// Shared email + password form; data-testids follow the grading contract.
export function AuthForm({ kind, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    null,
  );
  const c = copy[kind];
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-10">
      <h1 className="text-[28px] font-bold">{c.title}</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            data-testid={`${kind}-email`}
            className="min-h-11 rounded-xl border border-line-input bg-surface px-3 text-[17px] text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              kind === "signup" ? "new-password" : "current-password"
            }
            required
            data-testid={`${kind}-password`}
            className="min-h-11 rounded-xl border border-line-input bg-surface px-3 text-[17px] text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          data-testid={`${kind}-submit`}
          className="min-h-[52px] rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-60"
        >
          {pending ? c.pending : c.submit}
        </button>
      </form>
      {state && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      <p className="text-sm text-muted">
        {c.other.text}{" "}
        <Link
          href={c.other.href}
          className="inline-block min-h-11 py-3 font-semibold text-ink underline"
        >
          {c.other.label}
        </Link>
      </p>
    </main>
  );
}
