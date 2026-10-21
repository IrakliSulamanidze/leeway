import { Suspense } from "react";
import { BottomTabs } from "@/components/bottom-tabs";
import { Tour } from "@/components/tour";

// Logged-in pages: the root layout's header carries "Log out" (logout testid);
// this adds the bottom tabs (phone only) and keeps content clear of them, and
// the tour, which opens only from "Show me around".
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-24 lg:pb-12">{children}</div>
      <BottomTabs />
      <Suspense>
        <Tour />
      </Suspense>
    </>
  );
}
