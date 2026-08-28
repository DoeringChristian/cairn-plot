import { useCallback, useEffect, useRef } from "react";
import { useModifierKey } from "./use-modifier-key";
import {
  wheelZoomFactor,
  pinchZoomScale,
  pointerDistance,
  pointerMidpoint,
} from "../../plots/chart/chart-view-math";
import { reframeViewForResize } from "../../plots/image/runtime/reframe-view";

export { reframeViewForResize };

export interface ImageViewState {
  zoom: number;
  pan: { x: number; y: number };
}

const DEFAULT_MIN_ZOOM = 0.25;
// Q25 fix: was 16 — too low to GUARANTEE the TEV pixel-value overlay
// (`PixelValueOverlay`'s `PIXEL_VALUE_MIN_SCREEN_PX = 30`) is ever reachable.
// A pane's max on-screen scale at this cap is `homeScale * DEFAULT_MAX_ZOOM`,
// where `homeScale = min(box.width/naturalW, box.height/naturalH)` — for a
// modest image (e.g. 128x96) inside a narrow multi-column grid cell
// (~230px wide), `homeScale` can be as low as ~1.8px/texel, giving a max
// reachable scale of only ~28.75px/texel: JUST under the 30px threshold, so
// the per-pixel numbers NEVER appear no matter how far the user zooms (the
// zoom is already pinned at its cap) — this affects ANY image pane using
// this shared hook (`ImagePane`/`HdrImagePane`/`GpuImagePane`/
// `CompositeMediaPane`/`GpuComparePane` alike; it is not specific to any one
// of them), it just happens to bite tighter/smaller-image layouts first. 64x
// (a common upper bound for TEV-style pixel inspectors) gives generous
// headroom for typical grid layouts instead of a near-miss.
const DEFAULT_MAX_ZOOM = 64;

/**
 * Q29: adaptive max-zoom — the zoom at which a single source texel fills the
 * viewport (spans its larger dimension), rather than a fixed multiple of the
 * home view. `homeScale = min(boxW/naturalW, boxH/naturalH)` is px-per-texel at
 * zoom 1; a texel is `homeScale * zoom` px on screen, so it fills
 * `max(boxW,boxH)` at `zoom = max(boxW,boxH)/homeScale`. This scales with the
 * image's native resolution — a 4K image gets a huge cap (inspect any pixel), a
 * 16x16 a small one — so ANY resolution can be zoomed to "1 pixel fills the
 * viewport". Floored so you can always zoom in a bit even for near-1:1 layouts.
 */
export function adaptiveMaxZoom(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
): number {
  if (naturalW <= 0 || naturalH <= 0 || boxW <= 0 || boxH <= 0) return DEFAULT_MAX_ZOOM;
  const homeScale = Math.min(boxW / naturalW, boxH / naturalH);
  if (homeScale <= 0) return DEFAULT_MAX_ZOOM;
  return Math.max(Math.max(boxW, boxH) / homeScale, 8);
}

/**
 * Image-viewport interaction: modifier-gated wheel zoom-to-cursor and
 * pointer-capture panning. Self-contained — the wheel listener is attached
 * natively (non-passive) to `containerRef` so it can `preventDefault`.
 *
 * The `onViewChange` callback is full-replace (both `zoom` and `pan`).
 */
export function useImageGestures(args: {
  containerRef: React.RefObject<HTMLElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;
  minZoom?: number;
  maxZoom?: number;
  /** Q29: when the image's natural pixel size is known, the max zoom becomes
   *  adaptive (zoom until one texel fills the viewport) instead of `maxZoom`. */
  naturalWidth?: number;
  naturalHeight?: number;
}): {
  containerProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
  modifierActive: boolean;
} {
  const {
    containerRef,
    zoom,
    pan,
    onViewChange,
    minZoom = DEFAULT_MIN_ZOOM,
    maxZoom = DEFAULT_MAX_ZOOM,
    naturalWidth,
    naturalHeight,
  } = args;

  // -----------------------------------------------------------------------
  // Modifier key tracking (Alt/Ctrl/Meta for zoom+pan)
  // -----------------------------------------------------------------------
  const modifierActive = useModifierKey();
  const altDownRef = useRef(modifierActive);
  altDownRef.current = modifierActive;

  // Latest viewport + callback, read imperatively from event handlers.
  const viewRef = useRef({ zoom, pan });
  viewRef.current = { zoom, pan };

  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  // -----------------------------------------------------------------------
  // Wheel zoom (local — zoom to cursor position)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onViewChange) return;
    const handler = (e: WheelEvent) => {
      // A wheel with `ctrlKey` is the browser's trackpad-PINCH signature (it
      // arrives with NO keydown, so `altDownRef` never opens); a real ctrl/alt/
      // meta+wheel is already an accepted zoom modifier. Treat both as zoom —
      // preventDefault is REQUIRED for pinch or the browser page-zooms instead.
      if (!e.ctrlKey && !altDownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      // Delta-proportional: smooth for a pinch, ~1.1 per mouse notch. `factor`
      // multiplies the scale directly (`> 1` = zoom in), matching this hook's
      // `zoom *= factor` model.
      const factor = wheelZoomFactor(e.deltaY);
      const s = viewRef.current;
      const rect = el.getBoundingClientRect();
      // Q29: cap zoom by the FINAL resolution (one texel fills the viewport),
      // not a fixed multiple — falls back to `maxZoom` when natural size is
      // unknown. Uses the LIVE container rect so it tracks resizes.
      const effMax =
        naturalWidth && naturalHeight
          ? adaptiveMaxZoom(naturalWidth, naturalHeight, rect.width, rect.height)
          : maxZoom;
      const nextZoom = Math.max(minZoom, Math.min(effMax, s.zoom * factor));
      if (s.zoom === nextZoom) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const newPanX = cx - ((cx - s.pan.x) / s.zoom) * nextZoom;
      const newPanY = cy - ((cy - s.pan.y) / s.zoom) * nextZoom;
      onViewChangeRef.current?.({
        zoom: nextZoom,
        pan: { x: newPanX, y: newPanY },
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [containerRef, !!onViewChange, minZoom, maxZoom, naturalWidth, naturalHeight]);

  // -----------------------------------------------------------------------
  // Pointer pan + two-finger pinch (local)
  // -----------------------------------------------------------------------
  // `pointersRef` tracks every active pointer (id → container-local px) so a
  // second touch can promote a one-finger pan into a two-finger pinch and a
  // lifted finger can demote it back to a pan. Mouse/pen keep the
  // modifier-gated single-pointer pan; a TOUCH pointer pans with one finger and
  // zooms with two — no modifier needed (there's no keyboard on a touchscreen).
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  // Two-pointer pinch snapshot (absolute-from-start; see `pinchZoomScale`).
  const pinchStateRef = useRef<{
    idA: number;
    idB: number;
    startDist: number;
    startMid: { x: number; y: number };
    startZoom: number;
    startPan: { x: number; y: number };
  } | null>(null);

  /** Container-local px for a client point (origin = container top-left). */
  const localPoint = useCallback(
    (el: HTMLElement, clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [],
  );

  /** The effective max zoom right now (adaptive from natural size when known,
   *  matching the wheel handler), using the LIVE container rect. */
  const effMaxZoom = useCallback(
    (el: HTMLElement): number => {
      if (!naturalWidth || !naturalHeight) return maxZoom;
      const rect = el.getBoundingClientRect();
      return adaptiveMaxZoom(naturalWidth, naturalHeight, rect.width, rect.height);
    },
    [naturalWidth, naturalHeight, maxZoom],
  );

  /** Begin a two-finger pinch from the two currently-tracked pointers. */
  const beginPinch = useCallback((idA: number, idB: number) => {
    const pts = pointersRef.current;
    const a = pts.get(idA);
    const b = pts.get(idB);
    if (!a || !b) return;
    dragStateRef.current = null; // pinch supersedes any single-pointer pan
    pinchStateRef.current = {
      idA,
      idB,
      startDist: pointerDistance(a, b),
      startMid: pointerMidpoint(a, b),
      startZoom: viewRef.current.zoom,
      startPan: { ...viewRef.current.pan },
    };
  }, []);

  /** Begin a single-pointer pan from the given tracked pointer. */
  const beginPan = useCallback((pointerId: number) => {
    const p = pointersRef.current.get(pointerId);
    if (!p) return;
    dragStateRef.current = {
      pointerId,
      startX: p.x,
      startY: p.y,
      panX: viewRef.current.pan.x,
      panY: viewRef.current.pan.y,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onViewChangeRef.current) return;
      const isTouch = e.pointerType === "touch";
      // Mouse/pen only pan while a modifier is held (unchanged); touch always
      // engages (one finger pans, two pinch).
      if (!isTouch && !altDownRef.current) return;
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, localPoint(el, e.clientX, e.clientY));

      if (isTouch && pointersRef.current.size >= 2) {
        const ids = [...pointersRef.current.keys()];
        beginPinch(ids[ids.length - 2], ids[ids.length - 1]);
        return;
      }
      beginPan(e.pointerId);
    },
    [localPoint, beginPinch, beginPan],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      const tracked = pointersRef.current.get(e.pointerId);
      if (tracked) {
        const p = localPoint(el, e.clientX, e.clientY);
        tracked.x = p.x;
        tracked.y = p.y;
      }

      const pinch = pinchStateRef.current;
      if (pinch) {
        const a = pointersRef.current.get(pinch.idA);
        const b = pointersRef.current.get(pinch.idB);
        if (!a || !b) return;
        const next = pinchZoomScale(
          { zoom: pinch.startZoom, pan: pinch.startPan },
          pinch.startDist,
          pinch.startMid,
          pointerDistance(a, b),
          pointerMidpoint(a, b),
          minZoom,
          effMaxZoom(el),
        );
        onViewChangeRef.current?.(next);
        return;
      }

      const s = dragStateRef.current;
      if (!s || s.pointerId !== e.pointerId || !tracked) return;
      onViewChangeRef.current?.({
        zoom: viewRef.current.zoom,
        pan: { x: s.panX + (tracked.x - s.startX), y: s.panY + (tracked.y - s.startY) },
      });
    },
    [localPoint, minZoom, effMaxZoom],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pointersRef.current.delete(e.pointerId);
    const pinch = pinchStateRef.current;
    if (pinch && (e.pointerId === pinch.idA || e.pointerId === pinch.idB)) {
      pinchStateRef.current = null;
      // A finger lifted mid-pinch: if one remains, continue as a pan so the
      // gesture never dead-stops.
      const rest = [...pointersRef.current.keys()];
      if (rest.length === 1) beginPan(rest[0]);
      return;
    }
    if (dragStateRef.current?.pointerId === e.pointerId) dragStateRef.current = null;
  }, [beginPan]);

  // Pan is available when a modifier is held (mouse/pen). Touch pan/pinch is
  // always available and doesn't affect the cursor. `touchAction: "none"` is set
  // on the viewport surface (a bounded element, never the page) so the browser
  // never hijacks a one-finger pan or two-finger pinch into scroll/page-zoom.
  const canPan = modifierActive && !!onViewChange;

  return {
    containerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      style: {
        cursor: canPan ? "move" : undefined,
        touchAction: onViewChange ? "none" : undefined,
      },
    },
    modifierActive,
  };
}

/**
 * Observes `containerRef`'s box and, on a genuine size change, applies the
 * center-preserving `reframeViewForResize` via `onViewChange` — so a
 * zoomed/panned view keeps its centered texel (and its on-screen texel size)
 * across enlarge enter/exit and ordinary window/container resizes, instead of
 * jumping (the top-left-anchored-pan bug). The first observation only seeds the
 * baseline box (no reframe). Uses `getBoundingClientRect` — the SAME box the
 * wheel/pan handler measures — so the adjustment matches the user transform.
 */
export function useReframeViewportOnResize(args: {
  containerRef: React.RefObject<HTMLElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;
  naturalWidth?: number;
  naturalHeight?: number;
}): void {
  const { containerRef, zoom, pan, onViewChange, naturalWidth, naturalHeight } = args;
  // Latest inputs read imperatively from the observer (never re-subscribes).
  const latest = useRef({ zoom, pan, onViewChange, naturalWidth, naturalHeight });
  latest.current = { zoom, pan, onViewChange, naturalWidth, naturalHeight };
  const lastBoxRef = useRef<{ width: number; height: number } | null>(null);
  // The natural dims the current baseline box belongs to — see the SOURCE-SWAP
  // gate below.
  const lastDimsRef = useRef<{ nw?: number; nh?: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const seed = el.getBoundingClientRect();
    lastBoxRef.current = { width: seed.width, height: seed.height };
    lastDimsRef.current = { nw: latest.current.naturalWidth, nh: latest.current.naturalHeight };
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const newBox = { width: rect.width, height: rect.height };
      const oldBox = lastBoxRef.current;
      if (!oldBox) {
        lastBoxRef.current = newBox;
        lastDimsRef.current = { nw: latest.current.naturalWidth, nh: latest.current.naturalHeight };
        return;
      }
      // Ignore sub-pixel jitter (RO fires on fractional layout churn).
      if (Math.abs(newBox.width - oldBox.width) < 0.5 && Math.abs(newBox.height - oldBox.height) < 0.5) {
        return;
      }
      lastBoxRef.current = newBox;
      const { onViewChange: cb, zoom: z, pan: p, naturalWidth: nw, naturalHeight: nh } = latest.current;
      // SOURCE-SWAP gate: this reframe exists for "SAME image, container
      // resized" (keep the centered texel + its on-screen size). When the
      // natural dims changed along with the box — a stacked viewport flipping
      // to a differently-shaped SLOT, or a step-scrub to a new resolution —
      // it is a DIFFERENT image: the shared camera must stay put (one viewport,
      // one camera), so just re-seed the baseline and do NOT rewrite zoom/pan.
      // Only a DEFINED → different-DEFINED transition counts as a swap: an
      // `undefined → defined` change is the SAME image finishing its decode
      // (dims were simply unknown at seed time) and must still reframe — e.g.
      // the enlarge enter/exit resize right after first load.
      const lastDims = lastDimsRef.current;
      const dimsChanged =
        !!lastDims &&
        lastDims.nw != null &&
        lastDims.nh != null &&
        nw != null &&
        nh != null &&
        (lastDims.nw !== nw || lastDims.nh !== nh);
      lastDimsRef.current = { nw, nh };
      if (dimsChanged) return;
      if (!cb) return;
      const next = reframeViewForResize({ zoom: z, pan: p }, oldBox, newBox, nw, nh);
      if (next.zoom !== z || next.pan.x !== p.x || next.pan.y !== p.y) cb(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // Re-subscribe only if the observed element identity changes.
  }, [containerRef]);
}
