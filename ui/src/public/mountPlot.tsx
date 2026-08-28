import { createRoot, type Root } from "react-dom/client";

import { PlotHost, type PlotHostProps } from "./PlotHost.tsx";

export interface MountedPlot {
  update(next: Partial<Pick<PlotHostProps, "descriptor" | "dataSource">>): void;
  destroy(): void;
}

/** Imperative lifecycle over the exact same production host used by React. */
export function mountPlot(element: HTMLElement, initial: PlotHostProps): MountedPlot {
  const root: Root = createRoot(element);
  let props = initial;
  let destroyed = false;
  const render = () => root.render(<PlotHost {...props} />);
  render();
  return {
    update(next) {
      if (destroyed) throw new Error("cairn-plot mount is destroyed");
      props = { ...props, ...next };
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.unmount();
    },
  };
}
