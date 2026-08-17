/**
 * ContentAspectFrame — the DEFAULT framing for a standalone / grid image pane.
 *
 * An image pane fills the box it is given. When that box's aspect ≠ the image's
 * aspect the pane letterboxes/pillarboxes the image, leaving big empty bands. This
 * wrapper instead sizes the pane's DRAWABLE BOX to the CONTENT aspect within the
 * available space (object-fit: contain applied to the box, via {@link fitContentBox}),
 * so the interactive viewport — checkerboard, toolbar, hover, pixel sampling —
 * shrink-wraps the content and the empty margins are minimised.
 *
 * It is fully SELF-CONTAINED: it measures its own available box with a
 * `ResizeObserver` (no host layout hooks) and learns the content aspect from the
 * pane itself via {@link ReportNaturalSizeContext} (published by `ImagePaneShell`).
 * Before the natural size is known it fills the available box (no collapse / no
 * flash), then reframes once the pane reports.
 *
 * A pane inside ANY grid layout (a `cp.Grid` or the compare/enlarge stage) uses
 * {@link GridCellReporter} instead — the grid sizes the uniform cell and the pane
 * just fills it.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ReportNaturalSizeContext } from "./natural-size-report";
import { finitePositive, VIEWPORT_HEIGHT_MARGIN } from "./grid-uniform-aspect";

export function ContentAspectFrame({
  /** The box the pane fills BEFORE its content aspect is known: `"100%"` fills
   *  whatever box the host/grid gives; a px number is the bare-page default. Once
   *  the pane reports its natural size, the frame RESHAPES to the content aspect
   *  (see below) so an auto-height parent collapses onto it — no empty bands. */
  outerHeight,
  contentAspect,
  children,
}: {
  outerHeight: number | string;
  /** An AUTHORITATIVE content aspect (width / height) known upfront by the host
   *  — e.g. a float/EXR source whose pixel dims live in `source.shape` before
   *  any decode. Seeds the frame so it reshapes to the content aspect
   *  IMMEDIATELY, without waiting for the pane to report its natural size (which
   *  for the WebGPU float path only happens post-decode). A uint8/URL pane has
   *  no upfront shape → omit it and rely on the pane's `<img>`-onload report. */
  contentAspect?: number | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seedAspect = finitePositive(contentAspect);
  const [aspect, setAspect] = useState<number | null>(seedAspect);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const report = useCallback((w: number, h: number) => {
    if (w > 0 && h > 0) setAspect((prev) => (prev === w / h ? prev : w / h));
  }, []);
  // Adopt the host-supplied authoritative aspect the moment it is known / changes
  // (the pane's own later report converges to the same value — harmless).
  useEffect(() => {
    if (seedAspect != null) setAspect((prev) => (prev === seedAspect ? prev : seedAspect));
  }, [seedAspect]);

  // The fix for "big empty bands / checkerboard around images": the empty space
  // is the pane's own object-contain LETTERBOX, drawn whenever the pane box's
  // aspect ≠ the image aspect. Pure CSS can't fit a content-aspect box within a
  // container bounded on BOTH axes (`aspect-ratio` is ignored once width AND
  // height are definite, and `max-height` doesn't reduce a width-driven box), so
  // MEASURE the available space and size the frame to the largest content-aspect
  // box that FITS it. The pane then fills a content-aspect box exactly → no
  // letterbox.
  //
  // The available box is NOT the immediate parent: several auto-height wrappers
  // (the PlotApp root, pane frames) sit between the frame and the real container,
  // and an auto wrapper's height just follows the frame (hiding the container's
  // true bound). So to find the real constraint we momentarily INFLATE the frame
  // to a huge size (synchronously, before paint — no flicker): every AUTO
  // ancestor grows with it, while a BOUNDED ancestor (a fixed cell / card / a
  // sized host) stays put. The min bounded extent across ancestors is the real
  // available width/height. If height is unbounded (a plain auto column), go
  // width-driven and the container COLLAPSES onto the frame.
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent || aspect == null || typeof ResizeObserver === "undefined") return;
    let measuring = false;
    const BIG = 1_000_000;
    const measure = () => {
      if (measuring) return;
      measuring = true;
      const prevW = el.style.width;
      const prevH = el.style.height;
      el.style.width = `${BIG}px`;
      el.style.height = `${BIG}px`;
      void el.offsetHeight; // force reflow so ancestors settle
      const fr = el.getBoundingClientRect();
      let availW = Infinity;
      let availH = Infinity;
      for (let node: HTMLElement | null = parent; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        const r = node.getBoundingClientRect();
        const cs = getComputedStyle(node);
        if (r.width < BIG / 2) availW = Math.min(availW, r.right - parseFloat(cs.paddingRight || "0") - fr.left);
        if (r.height < BIG / 2) availH = Math.min(availH, r.bottom - parseFloat(cs.paddingBottom || "0") - fr.top);
      }
      el.style.width = prevW;
      el.style.height = prevH;
      measuring = false;
      if (!Number.isFinite(availW) || availW <= 0) return;
      // The drawable box height must never exceed the PAGE (window) height — so a
      // very TALL (portrait) or a large square image stays viewable in one
      // screenful instead of running off the page. Cap the height by the window,
      // then let the width shrink to keep the content aspect (the box centres via
      // `marginInline:auto`). A wide/short image is unaffected (its height is well
      // under the cap). This is ABSOLUTE (window height), not relative to the
      // frame's scroll position — the pane is at most one page tall wherever it is.
      const viewportCap =
        typeof window !== "undefined" && window.innerHeight > 0
          ? window.innerHeight - VIEWPORT_HEIGHT_MARGIN
          : Infinity;
      const hCap = Math.min(Number.isFinite(availH) && availH > 20 ? availH : Infinity, viewportCap);
      const bound = Number.isFinite(hCap) ? hCap * aspect : Infinity;
      const w = Math.max(0, Math.min(availW, bound));
      const h = w / aspect;
      setBox((prev) => (prev && Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(parent);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [aspect]);

  const style: CSSProperties =
    aspect && box
      ? {
          width: box.w,
          height: box.h,
          marginInline: "auto",
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }
      : { width: "100%", height: outerHeight, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" };

  return (
    <div ref={ref} data-cairn-content-aspect-frame="" style={style}>
      <ReportNaturalSizeContext.Provider value={report}>{children}</ReportNaturalSizeContext.Provider>
    </div>
  );
}
