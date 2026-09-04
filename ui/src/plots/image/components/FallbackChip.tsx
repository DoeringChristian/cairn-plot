// ---------------------------------------------------------------------------
// FallbackChip — the small indicator that the pane substituted a core
// fallback for an authored/saved id the ACTIVE backend does not support (see
// definition/core.ts). The top-right belongs to the toolbar / ImageInfoPanel,
// the bottom corners to the label chips, and the very top-left to the compare
// RefBadge — so this one anchors top-left, just below the RefBadge slot.
// ---------------------------------------------------------------------------
import type { CapabilityFallback } from "../definition/core.ts";

export default function FallbackChip({ fallback, index = 0 }: { fallback: CapabilityFallback; index?: number }) {
  const text = `${fallback.requested} unavailable · ${fallback.effective}`;
  return (
    <span
      className="absolute left-1 z-10 min-w-0 max-w-[calc(100%-0.5rem)] overflow-hidden truncate whitespace-nowrap rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm"
      style={{ top: `${1.75 + index * 1.25}rem` }}
      title={`This backend does not support "${fallback.requested}"; showing "${fallback.effective}". HOME keeps the authored setting.`}
      data-cairn-capability-fallback={`${fallback.kind}:${fallback.requested}:${fallback.effective}`}
    >
      {text}
    </span>
  );
}
