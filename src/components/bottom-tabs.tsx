"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const TABS = [
  {
    href: "/app",
    label: "Home",
    icon: "M4 11 12 4l8 7v9h-5v-6H9v6H4z",
  },
  {
    href: "/app/plan",
    label: "Plan",
    icon: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: "M4 6h16M4 12h16M4 18h10",
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
  },
];

// Bottom tabs on every logged-in page; on a laptop the header carries them.
export function BottomTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 grid lg:hidden grid-cols-4 border-t border-line bg-bg/95 px-2 pt-1 pb-[max(8px,env(safe-area-inset-bottom))]"
    >
      {TABS.map((t) => {
        const on = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`grid min-h-12 justify-items-center gap-0.5 text-xs ${on ? "font-semibold text-ink" : "text-muted"}`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d={t.icon}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
