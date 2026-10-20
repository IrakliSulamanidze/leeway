import { dismissNotice } from "@/app/app/calendar/actions";

// Calendar notices ("Micro lost a session. Lives now 5."), each dismissable.
export function Notices({
  notices,
}: {
  notices: { id: string; body: string }[];
}) {
  if (notices.length === 0) return null;
  return (
    <ul className="mt-4 grid gap-2" aria-label="Notices">
      {notices.map((n) => (
        <li
          key={n.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-1"
        >
          <span className="text-sm">{n.body}</span>
          <form action={dismissNotice}>
            <input type="hidden" name="id" value={n.id} />
            <button className="min-h-11 px-2 text-sm text-muted underline">
              Dismiss
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
