import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { getSignedInEmail } from "@/lib/supabase/session";
import { Logo, LogoMark } from "@/components/logo";
import { TopNav } from "@/components/top-nav";
import { logOut } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const email = await getSignedInEmail();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-2 lg:px-12">
            <div className="flex items-center gap-8">
              <Link
                href={email !== null ? "/app" : "/"}
                className="flex min-h-11 items-center"
              >
                <Logo />
              </Link>
              {email !== null && <TopNav />}
            </div>
            {email !== null && (
              <form action={logOut}>
                <button
                  type="submit"
                  data-testid="logout"
                  className="min-h-11 rounded-xl px-3 text-sm font-semibold underline"
                >
                  Log out
                </button>
              </form>
            )}
          </div>
        </header>
        {children}
        {email === null && (
          <footer className="border-t border-line text-[13px] text-muted">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 lg:px-12">
              <span className="flex items-center gap-2">
                <LogoMark size={14} />
                {APP_NAME}
              </span>
              <span>
                Made for IE University students. Not affiliated with IE.
              </span>
            </div>
          </footer>
        )}
        <Analytics />
      </body>
    </html>
  );
}
