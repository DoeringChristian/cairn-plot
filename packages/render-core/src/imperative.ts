import { createPlotController, type PlotController } from "../../runtime/src/controller.ts";
import type { RendererInstance, RendererPlugin, RendererRegistry, ResourceManager } from "../../runtime/src/renderers.ts";
import { createSignal } from "../../runtime/src/signal.ts";
import type { PaneStatus } from "../../runtime/src/renderers.ts";
import type { LayoutSpec, PaneId, PlotSpec } from "../../spec/src/spec.ts";

interface MountedPane {
  element: HTMLElement;
  plugin: RendererPlugin;
  resolved: unknown;
  instance: RendererInstance;
  abort: AbortController;
}

export interface PlotRuntime {
  controller: PlotController;
  pane(id: PaneId): { element: HTMLElement; handle: unknown } | undefined;
  destroy(): void;
}

function layoutElement(layout: LayoutSpec, paneElements: Map<PaneId, HTMLElement>): HTMLElement {
  if (layout.kind === "pane") {
    const element = document.createElement("div");
    element.dataset.cairnPane = layout.pane;
    paneElements.set(layout.pane, element);
    return element;
  }
  const element = document.createElement("div");
  element.dataset.cairnLayout = layout.kind;
  element.style.display = "grid";
  if (layout.columns) element.style.gridTemplateColumns = `repeat(${layout.columns}, minmax(0, 1fr))`;
  if (layout.gap !== undefined) element.style.gap = typeof layout.gap === "number" ? `${layout.gap}px` : layout.gap;
  for (const child of layout.children) element.append(layoutElement(child, paneElements));
  return element;
}

/** Framework-free imperative face. React binds to the same PlotController. */
export function createPlot(
  container: HTMLElement,
  spec: PlotSpec,
  options: {
    renderers: RendererRegistry;
    resources: ResourceManager;
    controller?: PlotController;
  },
): PlotRuntime {
  const controller = options.controller ?? createPlotController({ spec });
  const ownsController = options.controller === undefined;
  const mounted = new Map<PaneId, MountedPane>();
  let paneElements = new Map<PaneId, HTMLElement>();
  let disposed = false;

  const destroyMounts = () => {
    for (const mount of mounted.values()) {
      mount.abort.abort("remount");
      mount.instance.destroy();
    }
    mounted.clear();
  };

  const mountAll = async () => {
    destroyMounts();
    container.replaceChildren();
    paneElements = new Map();
    container.append(layoutElement(controller.getSpec().layout, paneElements));
    for (const [id, pane] of Object.entries(controller.getSpec().panes)) {
      const element = paneElements.get(id);
      const plugin = options.renderers.get(pane.kind);
      if (!element || !plugin) continue;
      const abort = new AbortController();
      const status = createSignal<PaneStatus>({ state: "resolving" });
      const dimensions = createSignal<{ width: number; height: number } | null>(null);
      const metrics = createSignal<Record<string, number> | null>(null);
      const cursor = createSignal<{ x: number; y: number; values?: number[] } | null>(null);
      try {
        const resolved = await plugin.resolve(pane.sources, {
          signal: abort.signal,
          resources: options.resources,
        });
        if (disposed || abort.signal.aborted) continue;
        const instance = plugin.mount(
          { element, signals: { status, dimensions, metrics, cursor } },
          pane,
          resolved,
          controller.getSettings(id),
        );
        status.set({ state: "ready" });
        mounted.set(id, { element, plugin, resolved, instance, abort });
      } catch (error) {
        if (!abort.signal.aborted) status.set({ state: "error", error: error as Error });
      }
    }
  };

  void mountAll();
  const unsubscribe = controller.subscribe((change) => {
    if (change.specChanged || change.invalidation === "remount" || change.invalidation === "layout") {
      void mountAll();
      return;
    }
    for (const id of change.affectedPanes) {
      const mount = mounted.get(id);
      if (!mount) continue;
      mount.instance.update(mount.resolved, controller.getSettings(id), change.invalidation);
    }
  });

  return {
    controller,
    pane(id) {
      const mount = mounted.get(id);
      return mount ? { element: mount.element, handle: mount.instance.getHandle?.() } : undefined;
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      destroyMounts();
      options.resources.dispose();
      if (ownsController) controller.destroy();
      container.replaceChildren();
    },
  };
}
