import { createRoot, type Root } from "react-dom/client";

import { PlotHost, type PlotHostProps } from "./PlotHost.tsx";
import { createPlotSessionController } from "../state/session/PlotSessionController.ts";
import type { PlotSession } from "../state/session/plot-session.ts";

export interface MountedPlot {
  update(next: Partial<Pick<PlotHostProps, "descriptor" | "dataSource">>): void;
  getSession(): PlotSession;
  restoreSession(session: unknown): void;
  subscribeSession(listener: (session: PlotSession) => void): () => void;
  destroy(): void;
}

/** Imperative lifecycle over the exact same production host used by React. */
export function mountPlot(element: HTMLElement, initial: PlotHostProps): MountedPlot {
  const root: Root = createRoot(element);
  let props = initial;
  let destroyed = false;
  const controller = createPlotSessionController(initial.initialSession);
  const render = () => root.render(<PlotHost {...props} sessionController={controller} />);
  render();
  return {
    update(next) {
      if (destroyed) throw new Error("cairn-plot mount is destroyed");
      props = { ...props, ...next };
      render();
    },
    getSession: () => controller.getSession(),
    restoreSession: (session) => controller.restoreSession(session),
    subscribeSession: (listener) => controller.subscribe(listener),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.unmount();
      controller.destroy();
    },
  };
}
