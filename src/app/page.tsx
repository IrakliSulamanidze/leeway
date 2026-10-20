import Link from "next/link";
import { CourseList, type CourseView } from "@/components/course-list";
import { APP_AUDIENCE, APP_TAGLINE } from "@/lib/config";
import { getSignedInEmail } from "@/lib/supabase/session";

// A live course row shows what the app does instead of feature captions.
const EXAMPLES: CourseView[] = [
  {
    id: "micro",
    name: "Microeconomics",
    lives: 6,
    left: 2,
    planned: 0,
    pace: "burning",
    weeksToGo: 8,
    estimated: false,
  },
  {
    id: "accounting",
    name: "Financial Accounting",
    lives: 6,
    left: 5,
    planned: 0,
    pace: "safe",
    weeksToGo: 8,
    estimated: false,
  },
];

const button =
  "flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-5 text-[17px] font-semibold text-on-primary";

export default async function Home() {
  const signedIn = (await getSignedInEmail()) !== null;
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-9 px-5 pt-9 pb-12 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-12">
      <div className="grid gap-5 lg:gap-6">
        <h1 className="m-0 text-[38px] leading-[1.06] font-bold tracking-[-0.025em] text-balance lg:text-[60px]">
          {APP_TAGLINE}
        </h1>
        <p className="m-0 text-[17px] leading-[1.4] text-muted lg:max-w-[32ch] lg:text-xl">
          {APP_AUDIENCE}
        </p>
        <div className="grid gap-1 lg:max-w-[300px]">
          {signedIn ? (
            <Link href="/app" className={button}>
              Open app
            </Link>
          ) : (
            <>
              <Link href="/signup" className={button}>
                Sign up free
              </Link>
              <p className="m-0 text-sm text-muted">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="inline-block min-h-11 min-w-11 px-1 py-3 text-center font-semibold text-ink underline"
                >
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
      <CourseList courses={EXAMPLES} />
    </main>
  );
}
