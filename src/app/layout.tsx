import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { getSignedInEmail } from "@/lib/supabase/session";
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
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-2">
          <Link
            href={email !== null ? "/app" : "/"}
            className="flex min-h-11 items-center font-bold"
          >
            {APP_NAME}
          </Link>
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
        </header>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
