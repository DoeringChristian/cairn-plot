import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import type { PlotSpec } from "../../../packages/spec/src/spec.ts";
import type { DataSource } from "../resources/data/data-source.ts";
import { useEmitAutoHeight } from "./hooks/use-emit-auto-height.ts";
import { PlotNodeView } from "./PlotNodeView.tsx";
import { ChartFillContext } from "./standalone-helpers.tsx";
import { SharedPlotContext } from "./plot-context.ts";
import { acquireSelectionOverlayHost } from "./SelectionStage.tsx";
import { createPlotSessionController, type PlotSessionController } from "../state/session/PlotSessionController.ts";
import { PlotSessionContext } from "../state/session/session-context.ts";
import { compileSessionTopology } from "../state/session/session-topology.ts";
import type { PlotSession } from "../state/session/plot-session.ts";
import { connectSessionPersistence, type SessionPersistence } from "../state/session/session-persistence.ts";

/**
 * Who decides how tall the plot is.
 *
 * `"auto"` (default, today's behaviour): the surface has no height of its own —
 * every chart leaf falls back to the standalone `ChartBox` height (400px) and
 * the mounted content height is published to an embedding host through the
 * `cairn:resize` message.
 *
 * `"fill"`: the HOST supplies the height. The surface fills its container
 * (`height:100%`, a shrinkable flex column), chart leaves fill the surface
 * instead of using their standalone height, and no `cairn:resize` is posted —
 * a host that already sized the box does not want the plot asking for more.
 */
export type PlotSizing = "auto" | "fill";

export interface PlotSurfaceProps {
  spec: PlotSpec;
  dataSource: DataSource;
  className?: string;
  /** Height ownership; see `PlotSizing`. Defaults to `"auto"`. */
  sizing?: PlotSizing;
  autoHeight?: boolean;
  initialSession?: PlotSession;
  onSessionChange?: (session: PlotSession) => void;
  /** External storage is opt-in; omission or false keeps the session runtime-only. */
  persistence?: SessionPersistence | false;
  /** Advanced lifecycle injection used by the imperative host. */
  sessionController?: PlotSessionController;
}

/** The one production host surface. Renderer registration is an entry concern. */
export function PlotSurface({
  spec,
  dataSource,
  className = "p-2",
  sizing = "auto",
  autoHeight = true,
  initialSession,
  onSessionChange,
  persistence,
  sessionController,
}: PlotSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fill = sizing === "fill";
  useEmitAutoHeight(containerRef, autoHeight && !fill);
  useEffect(() => acquireSelectionOverlayHost(), []);
  const ownedControllerRef = useRef<PlotSessionController | null>(null);
  if (!sessionController && !ownedControllerRef.current) {
    ownedControllerRef.current = createPlotSessionController(initialSession);
  }
  const controller = sessionController ?? ownedControllerRef.current!;
  const topology = useMemo(() => compileSessionTopology(spec), [spec]);
  useEffect(() => {
    controller.setTopology(topology);
  }, [controller, topology]);
  useEffect(() => onSessionChange ? controller.subscribe(onSessionChange) : undefined, [controller, onSessionChange]);
  useEffect(() => {
    if (!persistence) return;
    const connection = connectSessionPersistence(controller, persistence, {
      skipLoad: initialSession !== undefined,
    });
    return () => connection.dispose();
  }, [controller, persistence, initialSession]);
  useEffect(() => () => {
    if (!sessionController) ownedControllerRef.current?.destroy();
  }, [sessionController]);
  // `"fill"` owns exactly two things: the root box (fills the host cell, and can
  // shrink inside a flex column) and the fill flag every `ChartBox` reads.
  const fillStyle: CSSProperties = {
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  };
  const style: CSSProperties | undefined = fill ? { ...fillStyle } : undefined;
  const tree = (
    <PlotSessionContext.Provider value={controller}>
      <SharedPlotContext.Provider value={{ source: dataSource, shared: undefined }}>
        <PlotNodeView node={spec.root} />
      </SharedPlotContext.Provider>
    </PlotSessionContext.Provider>
  );
  return (
    <div ref={containerRef} className={className} style={style}>
      {fill ? <ChartFillContext.Provider value={true}>{tree}</ChartFillContext.Provider> : tree}
    </div>
  );
}
