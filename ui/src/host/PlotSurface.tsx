import { useEffect, useMemo, useRef } from "react";

import type { PlotSpec } from "../../../packages/spec/src/spec.ts";
import type { DataSource } from "../resources/data/data-source.ts";
import { useEmitAutoHeight } from "./hooks/use-emit-auto-height.ts";
import { PlotNodeView } from "./PlotNodeView.tsx";
import { SharedPlotContext } from "./plot-context.ts";
import { acquireSelectionOverlayHost } from "./SelectionStage.tsx";
import { createPlotSessionController, type PlotSessionController } from "../state/session/PlotSessionController.ts";
import { PlotSessionContext } from "../state/session/session-context.ts";
import { compileSessionTopology } from "../state/session/session-topology.ts";
import type { PlotSession } from "../state/session/plot-session.ts";
import { connectSessionPersistence, type SessionPersistence } from "../state/session/session-persistence.ts";

export interface PlotSurfaceProps {
  descriptor: PlotSpec;
  dataSource: DataSource;
  className?: string;
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
  descriptor,
  dataSource,
  className = "p-2",
  autoHeight = true,
  initialSession,
  onSessionChange,
  persistence,
  sessionController,
}: PlotSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEmitAutoHeight(containerRef, autoHeight);
  useEffect(() => acquireSelectionOverlayHost(), []);
  const ownedControllerRef = useRef<PlotSessionController | null>(null);
  if (!sessionController && !ownedControllerRef.current) {
    ownedControllerRef.current = createPlotSessionController(initialSession);
  }
  const controller = sessionController ?? ownedControllerRef.current!;
  const topology = useMemo(() => compileSessionTopology(descriptor), [descriptor]);
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
  return (
    <div ref={containerRef} className={className}>
      <PlotSessionContext.Provider value={controller}>
        <SharedPlotContext.Provider value={{ source: dataSource, shared: undefined }}>
          <PlotNodeView node={descriptor.root} />
        </SharedPlotContext.Provider>
      </PlotSessionContext.Provider>
    </div>
  );
}
