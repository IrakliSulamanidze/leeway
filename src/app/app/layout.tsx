import { Suspense } from "react";
import { BottomTabs } from "@/components/bottom-tabs";
import { Tour } from "@/components/tour";
import { loadFeeds } from "@/lib/calendar/load";
import { hasSupabaseEnv } from "@/lib/supabase/session";

// Logged-in pages: the root layout's header carries "Log out" (logout testid);
// this adds the bottom tabs (phone only) and keeps content clear of them, and
// the tour, which opens only from "Show me around".
export default function AppLayout({ children }: LayoutProps<"/app">) {
  // The tour leaves out the stops a student without a calendar can't use yet.
  const calendar = hasSupabaseEnv()
    ? loadFeeds().then(
        (feeds) => feeds.length > 0,
        () => false,
      )
    : Promise.resolve(false);
  return (
    <>
      <div className="flex flex-1 flex-col pb-24 lg:pb-12">{children}</div>
      <BottomTabs />
      <Suspense>
        <Tour calendar={calendar} />
      </Suspense>
    </>
  );
}
