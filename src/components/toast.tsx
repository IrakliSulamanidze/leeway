import { useEffect } from "react";

// Dark toast pinned above the tabs; closes itself after 5 seconds.
// Used inside client components only.
export function Toast({
  message,
  actionLabel,
  onAction,
  onClose,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink py-1 pr-1.5 pl-4 text-[15px] font-semibold text-on-primary shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
    >
      {message}
      <button
        type="button"
        onClick={onAction}
        className="min-h-11 min-w-11 px-2.5 text-on-primary underline"
      >
        {actionLabel}
      </button>
    </div>
  );
}
