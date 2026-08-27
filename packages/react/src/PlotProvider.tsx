import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import { createPlotController, type PlotController } from "../../runtime/src/controller.ts";
import type { PlotChange } from "../../runtime/src/commands.ts";
import type { PlotSession } from "../../spec/src/session.ts";
import type { PlotSpec } from "../../spec/src/spec.ts";

const PlotControllerContext = createContext<PlotController | null>(null);

export function PlotProvider({
  controller: supplied,
  spec,
  session,
  children,
}: {
  controller?: PlotController;
  spec?: PlotSpec;
  session?: PlotSession;
  children: React.ReactNode;
}) {
  const owned = useMemo(() => {
    if (supplied) return null;
    if (!spec) throw new Error("PlotProvider needs a controller or spec");
    return createPlotController({ spec, session });
  }, [supplied]);
  const controller = supplied ?? owned!;

  useEffect(() => {
    if (!supplied && spec && controller.getSpec() !== spec) {
      controller.updateSpec(spec, { origin: "host", phase: "commit" });
    }
  }, [controller, spec, supplied]);

  useEffect(() => () => owned?.destroy(), [owned]);

  return (
    <PlotControllerContext.Provider value={controller}>
      {children}
    </PlotControllerContext.Provider>
  );
}

export function usePlotController(): PlotController {
  const controller = useContext(PlotControllerContext);
  if (!controller) throw new Error("usePlotController must be used inside PlotProvider");
  return controller;
}

export function usePlotSpec(): PlotSpec {
  const controller = usePlotController();
  return useSyncExternalStore(
    (notify: () => void) => controller.subscribe((change) => change.specChanged && notify()),
    () => controller.getSpec(),
    () => controller.getSpec(),
  );
}

export function usePlotSession(): PlotSession {
  const controller = usePlotController();
  return useSyncExternalStore(
    (notify: () => void) => controller.subscribe((change) => change.sessionChanged && notify()),
    () => controller.getSession(),
    () => controller.getSession(),
  );
}

export function usePlotChanges(listener: (change: PlotChange) => void): void {
  const controller = usePlotController();
  useEffect(() => controller.subscribe(listener), [controller, listener]);
}
