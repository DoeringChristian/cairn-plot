import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { PlotHost, type PlotHostProps } from "./PlotHost.tsx";
import { createPlotSessionController } from "../state/session/PlotSessionController.ts";
import type { PlotSession } from "../state/session/plot-session.ts";

export interface MountedPlot {
  update(next: Partial<Pick<PlotHostProps, "spec" | "dataSource">>): void;
  getSession(): PlotSession;
  restoreSession(session: unknown): void;
  /** Efficient live settings patch; avoids full-session parse/restore on sliders. */
  patchSettings(patch: Record<string, unknown>): void;
  subscribeSession(listener: (session: PlotSession) => void): () => void;
  destroy(): void;
}

/** Imperative lifecycle over the exact same production host used by React. */
export function mountPlot(element: HTMLElement, initial: PlotHostProps): MountedPlot {
  const root: Root = createRoot(element);
  let props = initial;
  let destroyed = false;
  let renderQueued = false;
  const controller = createPlotSessionController(initial.initialSession);
  const render = () => root.render(<PlotHost {...props} sessionController={controller} />);
  const renderBeforePaint = () => {
    if (renderQueued) return;
    renderQueued = true;
    // `mountPlot` is commonly driven from a host React root's layout effect.
    // Flushing directly inside that lifecycle is unsupported, so cross the
    // lifecycle boundary with a microtask, then commit the nested root before
    // the browser's next paint. Multiple authored updates in one turn coalesce.
    queueMicrotask(() => {
      renderQueued = false;
      if (!destroyed) flushSync(render);
    });
  };
  render();
  return {
    update(next) {
      if (destroyed) throw new Error("cairn-plot mount is destroyed");
      props = { ...props, ...next };
      renderBeforePaint();
    },
    getSession: () => controller.getSession(),
    restoreSession: (session) => controller.restoreSession(session),
    patchSettings: (patch) => controller.patchCellSettings(patch as never),
    subscribeSession: (listener) => controller.subscribe(listener),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.unmount();
      controller.destroy();
    },
  };
}
