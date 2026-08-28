import { useEffect, useRef } from "react";

import type { PlotDescriptor } from "../../packages/spec/src/spec.ts";
import type { DataSource } from "./lib/cairn-plot/store/data-sources.ts";
import { useEmitAutoHeight } from "./lib/cairn-plot/hooks/use-emit-auto-height.ts";
import { PlotNodeView, SharedPlotContext } from "./plot-node.tsx";
import { acquireSelectionOverlayHost } from "./plot-selection-stage.tsx";

export interface PlotSurfaceProps {
  descriptor: PlotDescriptor;
  dataSource: DataSource;
  className?: string;
  autoHeight?: boolean;
}

/** The one production host surface. Renderer registration is an entry concern. */
export function PlotSurface({
  descriptor,
  dataSource,
  className = "p-2",
  autoHeight = true,
}: PlotSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEmitAutoHeight(containerRef, autoHeight);
  useEffect(() => acquireSelectionOverlayHost(), []);
  return (
    <div ref={containerRef} className={className}>
      <SharedPlotContext.Provider value={{ source: dataSource, shared: undefined }}>
        <PlotNodeView node={descriptor.root} />
      </SharedPlotContext.Provider>
    </div>
  );
}
