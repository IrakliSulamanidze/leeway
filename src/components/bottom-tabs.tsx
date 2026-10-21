"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const TABS = [
  {
    href: "/app",
    label: "Skip",
    icon: "M4 6.5 10.5 12 4 17.5zM12.5 6.5 19 12l-6.5 5.5z",
    also: [],
  },
  {
    href: "/app/schedule",
    label: "Calendar",
    icon: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
    also: ["/app/calendar", "/app/plan"],
  },
  {
    href: "/app/courses",
    label: "Courses",
    icon: "M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8.6a3.8 3.8 0 0 1 7 2.2C19 15.6 12 20 12 20z",
    also: [],
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
    also: [],
  },
];

// The tab a page belongs to: its own path, a page under it, or a listed one.
export function isCurrent(tab: (typeof TABS)[number], path: string) {
  if (path === tab.href) return true;
  if (tab.href !== "/app" && path.startsWith(`${tab.href}/`)) return true;
  return tab.also.some((p) => path === p || path.startsWith(`${p}/`));
}

// Bottom tabs on every logged-in page; on a laptop the header carries them.
export function BottomTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      data-tabs="bottom"
      className="fixed inset-x-0 bottom-0 z-10 grid lg:hidden grid-cols-4 border-t border-line bg-bg/95 px-2 pt-1 pb-[max(8px,env(safe-area-inset-bottom))]"
    >
      {TABS.map((t) => {
        const on = isCurrent(t, path);
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
