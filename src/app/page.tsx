import Link from "next/link";
import { APP_AUDIENCE, APP_NAME, APP_TAGLINE } from "@/lib/config";
import { getSignedInEmail } from "@/lib/supabase/session";

export default async function Home() {
  const signedIn = (await getSignedInEmail()) !== null;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-5 py-12 text-center">
      <h1 className="text-[38px] font-bold tracking-tight sm:text-[60px]">
        {APP_NAME}
      </h1>
      <p className="text-lg">{APP_TAGLINE}</p>
      <p className="text-muted">{APP_AUDIENCE}</p>
      {signedIn ? (
        <Link
          href="/app"
          className="flex min-h-[52px] items-center rounded-xl bg-primary px-6 font-semibold text-on-primary"
        >
          Open {APP_NAME}
        </Link>
      ) : (
        <>
          <Link
            href="/signup"
            className="flex min-h-[52px] items-center rounded-xl bg-primary px-6 font-semibold text-on-primary"
          >
            Sign up free
          </Link>
          <p className="text-sm text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="inline-block min-h-11 py-3 font-semibold text-ink underline"
            >
              Log in
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
