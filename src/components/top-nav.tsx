"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, isCurrent } from "./bottom-tabs";

// The same four tabs in the header, for laptop widths only.
export function TopNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {TABS.map((t) => {
        const on = isCurrent(t, path);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-3 text-[15px] ${on ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
