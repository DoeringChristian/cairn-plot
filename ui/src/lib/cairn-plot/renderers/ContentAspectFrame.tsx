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
import { createContext, useCallback, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ReportNaturalSizeContext } from "./natural-size-report";

/**
 * `true` while rendering inside the page-level selection stage, which does its
 * OWN content-aspect cell packing — so `ContentAspectFrame` steps aside and lets
 * the pane fill the stage-sized cell. Default `false` (standalone / grid).
 */
export const StagePackedContext = createContext<boolean>(false);

export function ContentAspectFrame({
  /** The box the pane fills BEFORE its content aspect is known: `"100%"` fills
   *  whatever box the host/grid gives; a px number is the bare-page default. Once
   *  the pane reports its natural size, the frame RESHAPES to the content aspect
   *  (see below) so an auto-height parent collapses onto it — no empty bands. */
  outerHeight,
  children,
}: {
  outerHeight: number | string;
  children: ReactNode;
}) {
  const [aspect, setAspect] = useState<number | null>(null);
  const report = useCallback((w: number, h: number) => {
    if (w > 0 && h > 0) setAspect((prev) => (prev === w / h ? prev : w / h));
  }, []);

  // The fix for "big empty bands around images": the previous version filled a
  // FIXED box and CENTERED a content-aspect box inside it — which only RELOCATED
  // the empty space to the margins, it never removed it. Instead, once the
  // content aspect is known, make the FRAME ITSELF content-aspect via CSS
  // `aspect-ratio` (WIDTH-driven: height follows), so:
  //   - a bare / auto-height parent COLLAPSES to the content (no bands at all);
  //   - a px ceiling (`outerHeight` number, e.g. a bare float image's default
  //     height) caps the WIDTH at `ceiling * aspect` so the box stays
  //     content-aspect within that ceiling instead of letterboxing;
  //   - a fixed cell (`outerHeight === "100%"`) bounds the box to the cell
  //     (`maxHeight:100%`) while keeping it content-aspect — the pane fills the
  //     box (no internal bands); any remaining margin is the cell's, not ours.
  // Before the aspect is known, fall back to the plain `outerHeight` box.
  const style: CSSProperties = {
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    marginInline: "auto",
    ...(aspect
      ? {
          width:
            typeof outerHeight === "number"
              ? `min(100%, ${Math.round(outerHeight * aspect)}px)`
              : "100%",
          maxWidth: "100%",
          aspectRatio: String(aspect),
          ...(outerHeight === "100%" ? { maxHeight: "100%" } : {}),
        }
      : { width: "100%", height: outerHeight }),
  };

  return (
    <div data-cairn-content-aspect-frame="" style={style}>
      <ReportNaturalSizeContext.Provider value={report}>{children}</ReportNaturalSizeContext.Provider>
    </div>
  );
}
