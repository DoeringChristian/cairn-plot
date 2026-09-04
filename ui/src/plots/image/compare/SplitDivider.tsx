// ---------------------------------------------------------------------------
// SplitDivider — the full-height, gapless split-mode divider shared by BOTH
// image backends in split mode: `CpuImagePane` (cpu/view.tsx) and
// `GpuImagePane` (webgpu/view.tsx). Both used to carry a byte-for-byte copy of this element
// AND its ~20-line pointer-capture drag handler; the copies had already begun
// to diverge (the GPU dbl-click reset called `stopPropagation`, the CPU one
// did not). This is the single source of truth — the correct behavior is
// `stopPropagation` on BOTH gestures, so a divider double-click resets ONLY the
// split and never also triggers the pane's own double-click view reset beneath
// it.
//
// Position is driven by `splitPosition` (0..1). Dragging maps the pointer's X
// within the PARENT element to a fraction and reports it via `onChange`; the
// parent (compare pane) is the container the fraction is measured against, so
// the divider must be a direct child of that positioned container. Styling
// lives in `styles/plot.css` (`.cairn-plot-split-divider`).
// ---------------------------------------------------------------------------

export default function SplitDivider({
  splitPosition,
  onChange,
  onReset,
}: {
  /** Current split fraction (0..1) — the divider's horizontal position. */
  splitPosition: number;
  /** Report a new fraction while dragging (clamped to 0..1). */
  onChange?: (pos: number) => void;
  /** Double-click reset (typically back to 0.5). */
  onReset?: () => void;
}) {
  return (
    <div
      className="cairn-plot-split-divider absolute top-0 bottom-0 z-20 flex items-center justify-center"
      style={{ left: `${splitPosition * 100}%`, transform: "translateX(-50%)", cursor: "col-resize", touchAction: "none" }}
      onDoubleClick={(e) => {
        // stopPropagation so a divider dbl-click resets ONLY the split, never
        // also firing the pane's dbl-click view reset beneath it.
        e.stopPropagation();
        onReset?.();
      }}
      onPointerDown={(ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const el = ev.currentTarget;
        try { el.setPointerCapture(ev.pointerId); } catch { /* best-effort */ }
        const container = el.parentElement!;
        const rect = container.getBoundingClientRect();
        const onMoveEvt = (me: PointerEvent) => {
          onChange?.(Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width)));
        };
        const onUpEvt = () => {
          window.removeEventListener("pointermove", onMoveEvt);
          window.removeEventListener("pointerup", onUpEvt);
        };
        window.addEventListener("pointermove", onMoveEvt);
        window.addEventListener("pointerup", onUpEvt);
      }}
    >
      <div className="w-1 h-full bg-accent/80 rounded-full pointer-events-none" />
    </div>
  );
}
