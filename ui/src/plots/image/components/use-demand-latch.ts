import { useCallback, useRef, useState } from "react";

/**
 * A DEMAND latch for a lazily-fetched resource (raw uint8 pixels, a diff
 * readback, …), aggregated over however many reporters a pane wires into it
 * (e.g. the `single` pixel-value overlay; BOTH split overlays; the histogram
 * panel). `PixelValueOverlay` reports only on a CHANGE, so counting the
 * reports is what makes "either one wants it" hold: one reporter saying "not
 * demanded any more" can never cancel another reporter's still-standing
 * demand, and a fetch already in flight for one reporter is never aborted by
 * another.
 *
 * Shared by both backends (design §3.2 CPU, §3.3 WebGPU): CPU's foreground
 * and value-overlay demand and WebGPU's sample-demand latch are the same
 * shape, so this is the one implementation both wire into.
 */
export function useDemandLatch(): { demanded: boolean; report: (demanded: boolean) => void } {
  const live = useRef(0);
  const [demanded, setDemanded] = useState(false);
  const report = useCallback((next: boolean) => {
    live.current = Math.max(0, live.current + (next ? 1 : -1));
    setDemanded(live.current > 0);
  }, []);
  return { demanded, report };
}
