/**
 * `PlotHandle` — what every `cairnPlot.*` builder returns: an authored plot
 * specification (+ its runtime data) with `.mount(el)` and `.toElement()`.
 *
 * The handle is PURE DATA plus a `Mounter` seam. The actual React/ReactDOM
 * rendering lives in the CORE bundle (`plot-bootstrap.tsx`), which installs
 * `window.__cairnPlotMountObject` and binds it here — so the builder modules
 * stay free of React and can be ESM-imported cheaply. When the core bundle is
 * not present, `.mount()`/`.toElement()` throw a clear, actionable error.
 */
import type { PlotSpec, PlotNode } from "../../resources/resolve-data.ts";
import type { PlotStore } from "../../resources/data/local-store.ts";
import type { RuntimeStoreEntry } from "../../resources/data/runtime-store.ts";

/** The renderer seam the CORE bundle satisfies: render a specification object
 *  (not a DOM `<script>` blob) into `el`, first registering its base64 store +
 *  in-memory runtime entries. Returns an `unmount` handle. */
export type Mounter = (
  el: Element,
  spec: PlotSpec,
  data: { store?: PlotStore; runtime?: Array<[string, RuntimeStoreEntry]> },
) => { unmount(): void };

export interface MountedPlot {
  /** The element the plot mounted into. */
  readonly element: Element;
  /** Tear down the React root. */
  unmount(): void;
}

export interface PlotHandle {
  /** The `{root, mode}` specification this builder produced. */
  readonly spec: PlotSpec;
  /** The single tree node (== `spec.root`) — used when nesting handles
   *  into a `grid`/`compare` container. */
  readonly node: PlotNode;
  /** Base64 blob store (usually empty for JS-authored plots — data rides in
   *  `runtime` instead). */
  readonly store: PlotStore;
  /** In-memory runtime entries the specification references by hash. */
  readonly runtime: Array<[string, RuntimeStoreEntry]>;
  /** Render into `el` (an Element or a CSS selector). */
  mount(target: string | Element): MountedPlot;
  /** Render into a fresh detached `<div>` and return it (append it yourself). */
  toElement(): HTMLElement;
}

/** Read the CORE-installed mounter, or throw a clear error naming `core.iife.js`. */
function resolveMounter(explicit?: Mounter): Mounter {
  if (explicit) return explicit;
  const g = globalThis as { __cairnPlotMountObject?: Mounter };
  if (g.__cairnPlotMountObject) return g.__cairnPlotMountObject;
  throw new Error(
    "cairnPlot: the renderer is not loaded — include the cairn-plot core bundle " +
      "(dist/plot-inline/core.iife.js) before mounting. It installs window.cairnPlot " +
      "and the mount runtime.",
  );
}

function resolveEl(target: string | Element): Element {
  if (typeof target === "string") {
    const el = document.querySelector(target);
    if (!el) throw new Error(`cairnPlot: mount target "${target}" matched no element`);
    return el;
  }
  return target;
}

/** Build a `PlotHandle` from a lowered tree node + its data. `mount` defaults to
 *  the CORE-installed `window.__cairnPlotMountObject`. */
export function makeHandle(
  node: PlotNode,
  data: { store?: PlotStore; runtime?: Array<[string, RuntimeStoreEntry]> },
  mount?: Mounter,
): PlotHandle {
  const store = data.store ?? {};
  const runtime = data.runtime ?? [];
  const spec: PlotSpec = { root: node, mode: "local" };
  return {
    spec,
    node,
    store,
    runtime,
    mount(target) {
      const el = resolveEl(target);
      const m = resolveMounter(mount)(el, spec, { store, runtime });
      return { element: el, unmount: m.unmount };
    },
    toElement() {
      const div = document.createElement("div");
      resolveMounter(mount)(div, spec, { store, runtime });
      return div;
    },
  };
}
