"use client";

import Link from "next/link";
import { startTransition, useActionState, type FormEvent } from "react";
import type { AuthState } from "./auth-actions";

type Props = {
  kind: "signup" | "login";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

const copy = {
  signup: {
    title: "Create your account",
    ids: {
      email: "signup-email",
      password: "signup-password",
      submit: "signup-submit",
    },
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
    ids: {
      email: "login-email",
      password: "login-password",
      submit: "login-submit",
    },
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
  // Submit by hand instead of <form action>: React resets a form after an
  // action, which would wipe the email after a wrong password.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-10">
      <h1 className="text-[28px] font-bold">{c.title}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            data-testid={c.ids.email}
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
            data-testid={c.ids.password}
            className="min-h-11 rounded-xl border border-line-input bg-surface px-3 text-[17px] text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          data-testid={c.ids.submit}
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
          className="inline-block min-h-11 min-w-11 px-1 py-3 text-center font-semibold text-ink underline"
        >
          {c.other.label}
        </Link>
      </p>
    </main>
  );
}
