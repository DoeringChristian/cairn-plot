/**
 * `primitives/toolbar-popover.ts` — the PURE placement rule for the toolbar's
 * transient popovers (the `ToolbarMenu` dropdown + the folded `OverflowMenu`
 * panel), extracted so it is unit-testable without a DOM.
 *
 * ## Why the popovers are portaled (the bug this supports)
 * Pane roots carry `isolation: isolate` (so the pixel-value overlay's z-index
 * can't leak over the host header). That confines every in-pane z-index to the
 * pane's OWN stacking context — so an open dropdown taller than its pane, when
 * rendered INLINE in the toolbar (`position:absolute` inside the pane), had the
 * portion overflowing the pane bottom painted OVER by the next, separately-
 * stacked pane below. The fix renders the OPEN popover through a
 * `document.body` portal as a `position:fixed` box at a very high z-index, so
 * it escapes every pane's isolated stacking context and floats above sibling
 * panes — mirroring the enlarge overlay, which already portals correctly.
 *
 * A fixed/body popover is no longer laid out relative to its trigger, so we
 * position it MANUALLY from the trigger's viewport rect. This module is that
 * math: default below the trigger, FLIP above when it wouldn't fit below, and
 * clamp to the viewport on both axes so it never runs off-screen.
 */

/** A minimal viewport-space rectangle (a subset of `DOMRect`). */
export interface Rect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** The popover's own measured box (from `getBoundingClientRect()`). */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The viewport (usually `{ width: innerWidth, height: innerHeight }`). */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Which trigger edge the popover's horizontal position anchors to:
 *  `"left"` aligns the popover's LEFT edge to the trigger's left (the leading
 *  `ToolbarMenu` dropdown); `"right"` aligns its RIGHT edge to the trigger's
 *  right (the right-anchored `OverflowMenu` panel). */
export type PopoverAlign = "left" | "right";

export interface AnchoredPosition {
  /** Viewport-space `left` for the fixed popover. */
  readonly left: number;
  /** Viewport-space `top` for the fixed popover. */
  readonly top: number;
  /** `true` when the popover was flipped to open UPWARD (not enough room below). */
  readonly flipped: boolean;
}

/**
 * Compute the fixed viewport-space position for a popover anchored to a
 * trigger. Default: directly BELOW the trigger (`trigger.bottom + gap`),
 * horizontally aligned per {@link PopoverAlign}. If the popover's height does
 * not fit in the space below AND there is more room above, FLIP it to open
 * upward (its bottom `gap` above the trigger's top). Finally clamp both axes to
 * `[gap, viewport - size - gap]` so the box never runs off-screen (the caller
 * keeps its `max-h` scroll for lists too tall for the viewport).
 *
 * Pure: no DOM reads, no globals — the caller supplies the measured rects.
 */
export function computeAnchoredPosition(
  trigger: Rect,
  size: Size,
  viewport: Viewport,
  align: PopoverAlign,
  gap = 4,
): AnchoredPosition {
  // --- vertical: below by default, flip above only when it helps ------------
  const spaceBelow = viewport.height - trigger.bottom - gap;
  const spaceAbove = trigger.top - gap;
  const fitsBelow = size.height <= spaceBelow;
  const flipped = !fitsBelow && spaceAbove > spaceBelow;
  let top = flipped ? trigger.top - gap - size.height : trigger.bottom + gap;
  // Clamp vertically so the (possibly capped) box stays on-screen. When the box
  // is taller than the viewport the clamp pins it to the top gap.
  top = clamp(top, gap, Math.max(gap, viewport.height - size.height - gap));

  // --- horizontal: align to the trigger edge, then clamp on-screen ----------
  let left = align === "right" ? trigger.right - size.width : trigger.left;
  left = clamp(left, gap, Math.max(gap, viewport.width - size.width - gap));

  return { left, top, flipped };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
