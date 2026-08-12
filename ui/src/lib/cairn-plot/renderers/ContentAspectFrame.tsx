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
 * Under the page-level selection STAGE (which packs cells to the content aspect
 * itself) this frame is suppressed via {@link StagePackedContext} — the pane there
 * simply fills its already-content-aspect cell.
 */
import { createContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ReportNaturalSizeContext } from "./natural-size-report";
import { fitContentBox } from "../selection/pack-grid";

/**
 * `true` while rendering inside the page-level selection stage, which does its
 * OWN content-aspect cell packing — so `ContentAspectFrame` steps aside and lets
 * the pane fill the stage-sized cell. Default `false` (standalone / grid).
 */
export const StagePackedContext = createContext<boolean>(false);

export function ContentAspectFrame({
  /** CSS height for the OUTER frame — the space the pane is fitted WITHIN. Use
   *  `"100%"` to fill whatever box the host/grid gives (the embeddable case), or a
   *  px number as the standalone default so a bare page has something to measure.
   *  The pane's drawable box is then the largest content-aspect box inside it. */
  outerHeight,
  children,
}: {
  outerHeight: number | string;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [avail, setAvail] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);

  const report = useMemo(
    () => (w: number, h: number) => {
      if (w > 0 && h > 0) setAspect((prev) => (prev === w / h ? prev : w / h));
    },
    [],
  );

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setAvail((prev) => (prev && prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Until we know BOTH the available box and the content aspect, fill — so the
  // pane always has something to render into (no collapse) and the reframe is a
  // one-time settle once the image reports its size.
  const inner: { width: number | string; height: number | string } =
    avail && aspect
      ? fitContentBox(avail.w, avail.h, aspect)
      : { width: "100%", height: "100%" };

  return (
    <div
      ref={outerRef}
      data-cairn-content-aspect-frame=""
      style={{
        width: "100%",
        height: outerHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <div style={{ position: "relative", width: inner.width, height: inner.height, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ReportNaturalSizeContext.Provider value={report}>{children}</ReportNaturalSizeContext.Provider>
      </div>
    </div>
  );
}
