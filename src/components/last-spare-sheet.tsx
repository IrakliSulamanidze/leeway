import { useEffect, useRef } from "react";
import { Hearts } from "./hearts";

// The only dialog in the product: planning a course's last spare. Primary
// "Keep my spare" closes without saving; "Plan it anyway" saves the plan.
export function LastSpareSheet({
  course,
  lives,
  left,
  planned,
  onKeep,
  onPlan,
}: {
  course: string;
  lives: number;
  left: number;
  planned: number;
  onKeep: () => void;
  onPlan: () => void;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keep.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onKeep();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKeep]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="last-spare-title"
        className="grid w-full max-w-md gap-3 rounded-t-2xl bg-surface px-5 pt-[22px] pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.18)]"
      >
        <Hearts lives={lives} left={left} planned={planned} />
        <h2
          id="last-spare-title"
          className="m-0 text-[21px] font-bold tracking-tight"
        >
          This is your last spare. Plan it anyway?
        </h2>
        <p className="m-0 text-sm text-muted [overflow-wrap:anywhere]">
          {course}, tomorrow. After it, the next skip takes you below 80%.
        </p>
        <button
          ref={keep}
          type="button"
          onClick={onKeep}
          className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-5 text-[17px] font-semibold text-on-primary"
        >
          Keep my spare
        </button>
        <button
          type="button"
          onClick={onPlan}
          className="min-h-11 w-full text-[15px] font-semibold text-ink underline"
        >
          Plan it anyway
        </button>
      </div>
    </div>
  );
}
