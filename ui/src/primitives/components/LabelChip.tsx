// ---------------------------------------------------------------------------
// LabelChip — the ONE label chip shared by every pane that names a source: the
// viewport panes' bottom-LEFT draggable label (image + all 3D types, via
// `ImagePaneShell`) AND the compare panes' bottom-RIGHT label (the split chrome
// of both image backends — `CpuImagePane` + `GpuImagePane`). Corner differs on purpose —
// the compare panes carry a top-left `RefBadge`, so their label sits bottom-
// RIGHT to stay clear of it, while the plain viewport panes keep it bottom-
// LEFT. This is ONE component (same markup/classes), not one corner.
//
// Previously THREE divergent copies existed (the reported dedup bug):
//   1. this shared chip (bottom-left, grip iff draggable, `aria-hidden` grip),
//   2. `compositor.tsx`'s inline `<span>` (bottom-right, grip ALWAYS, drag
//      gated `isDraggable && !modifierActive`), and
//   3. `GpuComparePane.tsx`'s inline `<span>` (bottom-right, no grip, static;
//      that pane is now deleted — content-op unification, Phase 4).
// All now route through here; each site keeps its exact drag semantics by
// passing an already-computed `draggable` (the caller folds in `modifierActive`)
// and choosing `grip` explicitly.
// ---------------------------------------------------------------------------

/** Which corner the chip pins to. Viewport panes → bottom-left; compare panes →
 *  bottom-right (clear of the top-left `RefBadge`). */
export type LabelChipCorner = "bottom-left" | "bottom-right";

export default function LabelChip({
  label,
  corner = "bottom-left",
  isDraggable = false,
  grip = isDraggable,
  onDragStart,
  maxWidth = "full",
  attrs,
}: {
  label: string;
  corner?: LabelChipCorner;
  /** Whether the chip is draggable RIGHT NOW — drives the `draggable` attr, the
   *  grab cursor and the `cairn-drag-grip` class. Callers that gate on a live
   *  modifier key (compositor) pass the already-combined value. */
  isDraggable?: boolean;
  /** Show the grip handle icon. Defaults to `isDraggable`; the compositor pane
   *  passes `true` to keep the grip visible even while a modifier key
   *  temporarily suppresses dragging. */
  grip?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  /** Half-width keeps opposing split captions in disjoint pane halves. All
   * chips truncate rather than escaping their pane. */
  maxWidth?: "full" | "half";
  /** Extra attributes spread onto the chip span — used by the compare panes to
   *  tag which SIDE a caption names (`data-cairn-compare-caption`), so a host
   *  (e.g. the compare stage) can target a side's chip via event delegation
   *  without threading callbacks through the renderer. */
  attrs?: Record<string, string>;
}) {
  const cornerClass = corner === "bottom-right" ? "bottom-1 right-1" : "bottom-1 left-1";
  return (
    <span
      className={`absolute ${cornerClass} z-10 min-w-0 overflow-hidden rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm flex items-center gap-1${isDraggable ? " cairn-drag-grip" : ""}`}
      draggable={isDraggable}
      onDragStart={onDragStart}
      style={{
        cursor: isDraggable ? "grab" : undefined,
        maxWidth: maxWidth === "half" ? "calc(50% - 0.375rem)" : "calc(100% - 0.5rem)",
      }}
      title={label}
      {...attrs}
    >
      {grip && (
        <i className="fa-solid fa-grip-vertical text-[8px] opacity-50" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
    </span>
  );
}
