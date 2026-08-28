/**
 * Center-preserving viewport reframe for image panes (React-free math, so it is
 * unit-testable without a DOM). Consumed by `hooks/use-image-viewport.ts`'s
 * `useReframeViewportOnResize`, which observes the pane box and applies this on
 * every genuine size change (enlarge enter/exit, window/container resize).
 */
import type { Viewport } from "../../../host/hooks/use-image-viewport";
import { screenPerTexel } from "../components/region-select.ts";

/**
 * Center-preserving reframe when a pane's container box changes size.
 *
 * ## Convention (verified against `use-image-viewport.ts`'s wheel handler +
 * `GpuImagePane`'s `viewportToUvRect`)
 * The user transform is `screen = world*zoom + pan`, with `pan` in CSS px and
 * the origin at the container's TOP-LEFT (`cx = clientX - rect.left` in the
 * wheel handler is measured from that origin; the render applies
 * `translate(pan) scale(zoom)` about `(0,0)`). Underneath sits an IMPLICIT
 * home-fit letterbox whose scale `S = min(box.w/naturalW, box.h/naturalH)` and
 * centering BOTH depend on the box. So the on-screen size of one source texel is
 * `P = zoom * S`, and — because `pan` is top-left anchored — the texel under the
 * viewport CENTER drifts (and `P` changes) whenever the box changes if
 * `{zoom,pan}` are left alone. That is the "view jumps on enlarge/resize" bug.
 *
 * ## What this preserves
 * Across `box → box'` it returns the `{zoom,pan}` that keep BOTH invariant:
 *   - the source texel at the viewport center is unchanged, and
 *   - the on-screen texel size `P = zoom*S` is unchanged ⇒ `zoom' = zoom*S/S'`.
 * Derivation (per axis; `S` is a shared scalar): let `originX = pan.x +
 * zoom*imgLeft` be the screen-x of texel 0 (`imgLeft = (box.w - naturalW*S)/2`).
 * Requiring the center texel to be unchanged forces
 * `originX' = originX + (box'.w - box.w)/2`, which solves to
 *   `pan.x' = pan.x + (zoom*box.w - zoom'*box'.w)/2 + (box'.w - box.w)/2`
 * (and symmetrically for y). NOT the naive `pan += (size'-size)/2` — the
 * box-dependent letterbox offset contributes the extra `zoom*box` terms.
 *
 * HOME (`zoom==1, pan=={0,0}`) is returned UNCHANGED so an untouched pane simply
 * re-fits to the new box (home fills the container) rather than being pinned.
 */
export function reframeViewportForResize(
  vp: Viewport,
  oldBox: { width: number; height: number },
  newBox: { width: number; height: number },
  naturalWidth?: number,
  naturalHeight?: number,
): Viewport {
  const { zoom, pan } = vp;
  if (oldBox.width <= 0 || oldBox.height <= 0 || newBox.width <= 0 || newBox.height <= 0) {
    return vp;
  }
  // Untouched HOME view: let it re-fit to the new box (do not pin/adjust).
  if (zoom === 1 && pan.x === 0 && pan.y === 0) return vp;

  const known = !!naturalWidth && !!naturalHeight && naturalWidth > 0 && naturalHeight > 0;
  if (!known) {
    // No home-fit letterbox to reason about: hold the geometric viewport center
    // fixed at constant zoom ⇒ pan' = pan + (size'-size)/2.
    return {
      zoom,
      pan: {
        x: pan.x + (newBox.width - oldBox.width) / 2,
        y: pan.y + (newBox.height - oldBox.height) / 2,
      },
    };
  }

  // The home-fit letterbox scale from the ONE shared primitive (full window) — the
  // SAME `min(box.w/naturalW, box.h/naturalH)` the pane's uvRect / hover readout /
  // overlay boxes use, so a resize reframe can't drift from them (D1).
  const S = screenPerTexel({
    box: { left: 0, top: 0, width: oldBox.width, height: oldBox.height },
    naturalWidth: naturalWidth!,
    naturalHeight: naturalHeight!,
  });
  const S2 = screenPerTexel({
    box: { left: 0, top: 0, width: newBox.width, height: newBox.height },
    naturalWidth: naturalWidth!,
    naturalHeight: naturalHeight!,
  });
  const zoom2 = S2 > 0 && S > 0 ? (zoom * S) / S2 : zoom;
  return {
    zoom: zoom2,
    pan: {
      x:
        pan.x +
        (zoom * oldBox.width - zoom2 * newBox.width) / 2 +
        (newBox.width - oldBox.width) / 2,
      y:
        pan.y +
        (zoom * oldBox.height - zoom2 * newBox.height) / 2 +
        (newBox.height - oldBox.height) / 2,
    },
  };
}
