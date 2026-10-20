import Link from "next/link";

const TABS = [
  ["/app", "Home"],
  ["/app/plan", "Plan"],
  ["/app/calendar", "Calendar"],
] as const;

// Logged-in pages: bottom tabs. Home is PR 4's; Plan and Calendar come with the
// calendar lane (tech-plan 8) and stay out of the graded path.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      {children}
      <nav
        aria-label="Main"
        className="sticky bottom-0 mt-6 grid grid-cols-3 border-t border-line bg-surface"
      >
        {TABS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-11 items-center justify-center py-2 text-sm font-semibold"
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
