// Hearts: filled red = life left, red outline = planned skip, grey = used.
const PATH =
  "M12 21s-7.6-4.7-9.7-9.3C.9 8.3 3.1 4.4 6.8 4.4c2.1 0 3.5 1.1 4.3 2.4h1.8c.8-1.3 2.2-2.4 4.3-2.4 3.7 0 5.9 3.9 4.4 7.3C19.6 16.3 12 21 12 21z";

type Kind = "left" | "planned" | "used";

export function Heart({ kind, size = 22 }: { kind: Kind; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className="flex-none"
    >
      {kind === "planned" ? (
        <path d={PATH} fill="none" stroke="var(--heart)" strokeWidth="2" />
      ) : (
        <path
          d={PATH}
          fill={kind === "used" ? "var(--used)" : "var(--heart)"}
        />
      )}
    </svg>
  );
}

// One heart per life, in the order left, planned, used.
export function Hearts({
  lives,
  left,
  planned,
}: {
  lives: number;
  left: number;
  planned: number;
}) {
  const nLeft = Math.max(0, Math.min(lives, left));
  const nPlanned = Math.max(0, Math.min(lives - nLeft, planned));
  const kinds: Kind[] = Array.from({ length: lives }, (_, i) =>
    i < nLeft ? "left" : i < nLeft + nPlanned ? "planned" : "used",
  );
  return (
    <div
      className="flex flex-wrap items-center gap-[5px]"
      role="img"
      aria-label={`${nLeft} of ${lives} lives left`}
    >
      {kinds.map((kind, i) => (
        <Heart key={i} kind={kind} />
      ))}
    </div>
  );
}

// The hearts with what the hollow and grey ones mean, in words beside them:
// "1 planned · 2 used". Lives left are the big number, so they aren't repeated.
export function HeartsRow({
  lives,
  left,
  planned,
}: {
  lives: number;
  left: number;
  planned: number;
}) {
  const nLeft = Math.max(0, Math.min(lives, left));
  const nPlanned = Math.max(0, Math.min(lives - nLeft, planned));
  const nUsed = lives - nLeft - nPlanned;
  const words = [
    nPlanned > 0 && `${nPlanned} planned`,
    nUsed > 0 && `${nUsed} used`,
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Hearts lives={lives} left={left} planned={planned} />
      {words.length > 0 && (
        <span className="text-[13.5px] text-muted">{words.join(" · ")}</span>
      )}
    </div>
  );
}

export function HeartLegend() {
  return (
    <div className="flex flex-wrap gap-[14px] border-t border-line px-4 py-2.5 text-[13px] text-muted">
      {(
        [
          ["left", "Left"],
          ["planned", "Planned"],
          ["used", "Used"],
        ] as const
      ).map(([kind, label]) => (
        <span key={kind} className="flex items-center gap-[5px]">
          <Heart kind={kind} size={15} />
          {label}
        </span>
      ))}
    </div>
  );
}
