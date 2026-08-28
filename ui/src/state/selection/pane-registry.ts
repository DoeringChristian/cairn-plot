/**
 * The SELECTION PANE REGISTRY — the bridge that lets the page-level selection
 * stage rebuild the selected panes without reparenting their live canvases.
 *
 * Every selectable `PaneSelectionFrame` (plot-node.tsx) registers its render
 * DESCRIPTOR here — the pane's `PlotNode`, the `DataSource` + `shared` block it
 * resolves against, whether it is image-compatible, and a getter for its in-tree
 * element (theme origin) — keyed by the same process-unique `paneId` the
 * selection store tracks. The stage (`selection-stage.tsx`) reads the registry
 * for the currently-selected ids and renders FRESH leaves via `PlotNodeView`
 * (the descriptors are cheap; the underlying image data is by-reference in the
 * runtime store), building an enlarge grid of the pane nodes or a compare grid
 * of `CompareNode`s — instead of trying to move live GPU/2D canvases into a grid.
 *
 * Kept OUT of `plot-node.tsx` so it has no dependency on the stage — plot-node
 * only WRITES the registry; the stage READS it. Framework-light (a plain Map +
 * a version tick for `useSyncExternalStore`).
 */
import type { DataSource } from "../../resources/data/data-source";
import type { PlotNode, SharedProps } from "../../host/descriptor-resolver";

/** Renderer names whose panes can take part in an image comparison. Charts
 *  (scalar/scatter/bar/…) and 3D (pointcloud/mesh/…) cannot; `compare` panes
 *  always can (handled in {@link isImageCompatibleNode}). */
const IMAGE_RENDERERS: ReadonlySet<string> = new Set(["image", "imagehdr"]);

/** Whether a node can be COMPARED (image/imagehdr leaves + compare panes). A
 *  3D or chart leaf returns false, so the compare stage ignores it. */
export function isImageCompatibleNode(node: PlotNode): boolean {
  if (node.kind === "compare") return true;
  if (node.kind === "plot") return IMAGE_RENDERERS.has(node.renderer);
  return false;
}

export interface RegisteredPane {
  readonly paneId: string;
  /** Opaque host identity associating ephemeral selection with session state. */
  readonly sessionId?: string;
  readonly node: PlotNode;
  readonly source: DataSource;
  readonly shared?: SharedProps;
  readonly imageCompatible: boolean;
  /** The pane's in-tree root element — the stage/action-bar theme origin (it
   *  stays inside the page's theme scope, so a body-portaled overlay can copy
   *  its resolved `--color-*` tokens). */
  readonly getElement: () => HTMLElement | null;
  /** The viewport's SETTINGS accessors (NOSTACK object model): the owning
   *  frame's live box, for peer reads (formation converge, stage
   *  copy-on-create, harness/Host-API seams) and external writes. */
  readonly settings?: {
    get: () => import("../settings/viewport-settings").ViewportSettings | null;
    set: (patch: import("../settings/viewport-settings").ViewportSettings) => void;
  };
}

const registry = new Map<string, RegisteredPane>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version++;
  for (const l of [...listeners]) l();
}

export function registerSelectionPane(entry: RegisteredPane): void {
  registry.set(entry.paneId, entry);
  emit();
}

export function unregisterSelectionPane(paneId: string): void {
  if (registry.delete(paneId)) emit();
}

export function getRegisteredPane(paneId: string): RegisteredPane | undefined {
  return registry.get(paneId);
}

/** `useSyncExternalStore` subscribe for registry changes. */
export function subscribeSelectionRegistry(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** `useSyncExternalStore` snapshot — a monotonic version that bumps on any
 *  register/unregister, so the stage re-reads the registry when membership
 *  changes (e.g. a pane finishes mounting after the stage opened). */
export function getSelectionRegistryVersion(): number {
  return version;
}

/** Tests only — drop every registration. */
export function __resetSelectionRegistryForTest(): void {
  registry.clear();
  emit();
}
