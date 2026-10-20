import { APP_NAME } from "@/lib/config";

// The mark: an L built from five class blocks, four attended and one left open.
// Missing one class in five is exactly the 20% the 80% rule allows, so the
// open block is the leeway. It uses the planned-skip heart's red outline.
const MARK_CELLS = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
] as const;
const MARK_OPEN = [2, 2] as const;

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className="flex-none"
    >
      {MARK_CELLS.map(([x, y]) => (
        <rect
          key={`${x}${y}`}
          x={x * 8.5}
          y={y * 8.5}
          width="7"
          height="7"
          rx="1.75"
          fill="var(--text)"
        />
      ))}
      <rect
        x={MARK_OPEN[0] * 8.5 + 0.9}
        y={MARK_OPEN[1] * 8.5 + 0.9}
        width="5.2"
        height="5.2"
        rx="1"
        fill="none"
        stroke="var(--heart)"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={24} />
      <span className="text-[19px] font-bold tracking-[-0.02em]">
        {APP_NAME}
      </span>
    </span>
  );
}
