/**
 * The recursive cairn-plot compositor (G1). A `PlotSpec` is a TREE of
 * `PlotNode`s — `plot` leaves, `grid` layouts, `compare` panes — and this
 * module renders it. `PlotApp` (plot-bootstrap.tsx) is now a thin root wrapper
 * that builds ONE `DataSource` for the whole tree, seeds a `SharedPlotContext`,
 * and mounts `<PlotNodeView node={root} />`.
 *
 * The former flat single-renderer body of `PlotApp` lives on here as
 * a generic definition-backed leaf outlet plus the retained image-family host.
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Colorbar } from "../primitives/components/index";
import type { ColormapName } from "../plots/types";
import {
  type CompareNode,
  type GridNode,
  type PlotLeafNode,
  type PlotNode,
} from "../../../packages/spec/src/spec.ts";
import { stackLabelFor } from "../layout/stack/StackedView";
import {
  ChartFillContext,
  DEFAULT_CHART_HEIGHT,
} from "./standalone-helpers";
import {
  isEagerMount,
  LAZY_ROOT_MARGIN,
  shouldRetryObserve,
  type EagerMountSignals,
} from "./lazy-mount";
import {
  resolutionKey,
  acquireResolved,
  peekResolved,
  peekResolveError,
  resolveCached,
  prefetchResolved,
  subscribeResolveCache,
  resolveCacheVersion,
} from "../resources/resolution-cache";
import { type PlotSettings } from "../settings/schema.ts";
import { defaultSettingsForNode } from "../plots/settings.ts";
import { GridLayout, type GridLayoutState } from "../layout/GridLayout.tsx";
import { gridCellKeys } from "../layout/grid-cell-key.ts";
import {
  CellSettingsContext,
  PaneVisibilityContext,
  SharedPlotContext,
  useSharedPlot,
  usePaneVisible,
} from "./plot-context.ts";
import { PlotCell } from "./PlotCell.tsx";
import { ReactBackendOutlet } from "./react-backend.ts";
import { withoutSettingsPlumbing } from "./presentation.ts";
import { getReactPlotType, onRegisterReactPlotType } from "../plots/react-registry.ts";
import {
  comparisonType,
  planComparison,
  resolveComparison,
} from "../plots/registry.ts";
import type { RenderEnvironment } from "../backends/contracts.ts";
import {
  resolveRegisteredImageComparison,
  expandImageComparison,
} from "../plots/image/runtime/comparison-plan.ts";
import { ImageNodeHost } from "../plots/image/runtime/host-adapter.tsx";
import { usePlotSessionController } from "../state/session/session-context.ts";
import { getGlobalSelectionStore } from "../state/selection/selection-store.ts";
import { getRegisteredPane } from "../state/selection/pane-registry.ts";
import { gridSyncGroups } from "./grid-sync.ts";

// Compatibility exports for existing standalone/stage imports. The host owns
// these contracts; plot-node only consumes and re-exports them.
export { CellSettingsContext, SharedPlotContext } from "./plot-context.ts";
export type { CellSettingsContextValue, SharedPlotCtx } from "./plot-context.ts";

/**
 * How long an image host waits for a not-yet-registered backend (an addon
 * `<script>` still parsing) before surfacing "unknown renderer". Reduced from
 * 8000 (O2 review M1): the addon IIFE is emitted synchronously BEFORE the mount
 * push and runs same-page, so registration always wins in practice; this bound
 * only guards a genuinely unknown/misspelled renderer, which shouldn't stall 8s.
 */
// ---------------------------------------------------------------------------
// Multi-viewport SELECTION (see viewport/selection-store.ts) is PAGE-WIDE. There
// is ONE document-scoped `SelectionStore` (`getGlobalSelectionStore`) shared by
// every pane on the page — standalone `PlotApp` mounts AND grid cells alike, via
// the SAME `PlotCell` wrapper (`PlotNodeView` wraps every leaf/compare
// node in one). The frame draws the accent ring on the selected pane, turns a
// click into a store mutation (plain = replace, shift/ctrl/meta = toggle), and
// derives the per-pane sync group ids the leaf consumes: while ≥2 panes are
// selected, every selected pane joins the SAME `cp-global-sel-vp` (viewport) and
// `cp-global-sel-st` (settings) groups so zoom/pan and display-setting changes
// broadcast across the group. The first-selected pane is the ANCHOR whose
// current view + settings a newly-added member adopts. `GridView` keeps ONLY its
// layout role — it no longer owns a selection store or wraps cells itself.
// ---------------------------------------------------------------------------

function Message({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={`card p-4 text-sm ${error ? "text-red-400" : "text-fg-muted"}`}>
      {text}
    </div>
  );
}

function browserRenderEnvironment(): RenderEnvironment {
  return {
    webgpu: typeof navigator !== "undefined" && "gpu" in navigator,
    webgl2: typeof WebGL2RenderingContext !== "undefined",
    pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  };
}

// TEST-ONLY no-flash instrumentation. `ImageHostAdapter` reads its resolved value straight
// from the subscribable resolve-cache (a pure function of `resolveKey`), so there is
// no component-held `state` cell that can hold a PREVIOUS slot's resolution across a
// flip: a WARM/prefetched slot resolves synchronously (instant, no placeholder); a
// COLD slot renders a brief `"Loading…"` (accepted). `placeholderMounts` lets a
// harness prove a WARM flip storm never drops to a placeholder. (The former
// `staleDiffHolds` counter is retired — the stale-operand / reference-leak window it
// witnessed is now UNREPRESENTABLE: the leaf never emits a `compareSource` with an
// undefined `b`, because it only builds one from a RESOLVED diff-pair.) No production
// code reads this; the increment is a single integer.
/** The lifted compare view-mode state a compare node's `NodeDispatch` owns and
 *  threads to the unified pane via `compareSource` — hoisted so it survives the
 *  mode-switch op-swap and the stacked flip (the reused-instance control state). */
/** Bind an authored grid to the renderer-agnostic layout shell. */
function GridView({ node, path }: { node: GridNode; path: string }) {
  const { source, shared: parentShared } = useSharedPlot();
  const localId = useId();
  const children = node.children ?? [];
  const cols = node.cols ?? node.colWidths?.length ?? children.length ?? 1;
  const shared = node.shared ?? parentShared;
  const { viewSettingsGroupId, settingsGroupId } = gridSyncGroups(
    node.shared?.sync,
    localId,
  );
  const sessionController = usePlotSessionController();
  const sessionId = `grid:${path}`;
  const [layoutState, setLayoutState] = useState<GridLayoutState>({
    layout: node.initialLayout ?? "grid",
    activeSlot: 0,
  });
  useEffect(() => {
    if (!sessionController) return;
    return sessionController.registerGrid(sessionId, setLayoutState, layoutState);
    // Registration deliberately captures only the authored initial state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionController, sessionId]);
  const changeLayoutState = useCallback((next: GridLayoutState) => {
    if (layoutState.layout === "grid" && next.layout === "stack" && sessionController) {
      const selectedEntry = getGlobalSelectionStore().getSelected()
        .map(getRegisteredPane)
        .find((entry) => entry?.sessionId?.startsWith(`cell:${path}/`));
      const saved = sessionController.getSession();
      const firstSettings = Object.entries(saved.cells)
        .find(([id]) => id.startsWith(`cell:${path}/`))?.[1].settings;
      sessionController.seedCell(
        `stack:${path}`,
        selectedEntry?.settings?.get() ?? firstSettings ?? {},
      );
    }
    setLayoutState(next);
    sessionController?.recordGrid(sessionId, next);
  }, [layoutState.layout, path, sessionController, sessionId]);

  // H6: cells are keyed by node IDENTITY, never by position — a reordered or
  // filtered run set must move each pane's mounted instance with its node
  // instead of handing pane 0 a different run's data.
  const cellKeys = useMemo(() => gridCellKeys(children), [children]);
  const renderGridCell = useCallback(
    (index: number) => <PlotNodeView node={children[index]!} path={`${path}/${index}`} />,
    [children, path],
  );
  const renderStackSlot = useCallback(
    (index: number) => {
      const child = children[index];
      if (!child) return null;
      return child.kind === "grid" ? (
        <LayoutFrame><NodeDispatch node={child} path={`${path}/${index}`} /></LayoutFrame>
      ) : (
        <PlotCell sessionId={`stack:${path}`} selectable={isSelectableNode(child)} node={child}>
          <NodeDispatch node={child} path={`${path}/${index}`} />
        </PlotCell>
      );
    },
    [children, path],
  );
  const preload = useCallback(
    (indices: number[]) => {
      const entries: Array<{ key: string; run: () => Promise<unknown> }> = [];
      for (const index of indices) {
        const child = children[index];
        if (!child) continue;
        if (child.kind === "plot") {
          entries.push({
            key: resolutionKey(source, child),
            run: async () => {
              const registered = getReactPlotType(child.type);
              if (!registered) {
                throw new Error(`cairn-plot: plot type ${JSON.stringify(child.type)} is not registered`);
              }
              return registered.definition.present(await registered.definition.resolve(child, {
                source,
                signal: new AbortController().signal,
              }));
            },
          });
        } else if (child.kind === "compare") {
          if (comparisonType(child) === "image") {
            entries.push({
              key: resolutionKey(source, child, "|diffpair"),
              run: () => resolveRegisteredImageComparison(child, source),
            });
          } else {
            entries.push({
              key: resolutionKey(source, child, "|comparison"),
              run: () => resolveComparison(child, {
                source,
                signal: new AbortController().signal,
              }),
            });
          }
        }
      }
      prefetchResolved(entries);
    },
    [children, source],
  );

  const grid = (
    <GridLayout
      count={children.length}
      cols={cols}
      colWidths={node.colWidths}
      rowHeights={node.rowHeights}
      gap={node.gap}
      initialLayout={node.initialLayout}
      state={layoutState}
      onStateChange={changeLayoutState}
      switchable={node.switchable !== false}
      labels={children.map((child, index) => stackLabelFor(child, index))}
      cellKeys={cellKeys}
      renderGridCell={renderGridCell}
      renderStackSlot={renderStackSlot}
      preload={preload}
    />
  );
  const body = node.shared && node.shared !== parentShared ? (
    <SharedPlotContext.Provider value={{ source, shared, viewSettingsGroupId, settingsGroupId }}>
      {grid}
    </SharedPlotContext.Provider>
  ) : grid;

  if (!node.shared?.colorbar) return body;
  const cbColormap = (node.shared.settings?.["image.encoding"] as ColormapName | undefined) ?? "turbo";
  const range = node.shared.settings?.["image.colorRange"] as { min?: number; max?: number } | null | undefined;
  const { min, max } = range ?? {};
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 4, width: "100%" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
      <Colorbar colormap={cbColormap} min={min} max={max} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid — children in a CSS grid. `colWidths`/`rowHeights`: number → `Nfr`,
// string → verbatim CSS. When `rowHeights` is set, cells fill (`height:100%`)
// and `ChartFillContext` publishes `true` so chart leaves fill their cell. A
// single shared `Colorbar` renders beside the grid when `shared.colorbar`.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// LazyGate (P2) — viewport-lazy mounting. A leaf/compare pane is expensive to
// mount: images decode, WebGPU pipelines compile, 3D scenes build, addons eval.
// Off the eager path, this gate renders a layout-preserving PLACEHOLDER (same
// height ChartBox reserves) and mounts the REAL child only once an
// `IntersectionObserver` (generous rootMargin) says the placeholder is nearing
// the viewport. Once mounted it STAYS mounted (no unmount on scroll-away — the
// pane pool already handles GPU pressure), so scroll-back is instant.
//
// Three EAGER escape hatches force immediate mount of everything: `?eager=1`,
// `window.__cairnPlotEagerMount === true`, and print (matchMedia("print") /
// `beforeprint`). Grid children inherit eager naturally: the signals are
// page-global, so every gate on the page reads the same answer. See
// `host/lazy-mount.ts` for the pure decision fn.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    /** Imperative EAGER escape hatch — set before mount to disable lazy gating
     *  for the whole page (mirrors `?eager=1`). */
    __cairnPlotEagerMount?: boolean;
  }
}

/** Gather the ambient eager-mode signals from the live DOM — the impure half of
 *  the decision (`isEagerMount` is the pure core). SSR (no `window`) mounts
 *  eagerly: there's no viewport to gate against. */
function readEagerMountSignals(): EagerMountSignals {
  if (typeof window === "undefined") return { windowFlag: true };
  let printMedia = false;
  try {
    printMedia = window.matchMedia?.("print")?.matches ?? false;
  } catch {
    printMedia = false;
  }
  return {
    search: window.location?.search,
    windowFlag: window.__cairnPlotEagerMount,
    printMedia,
  };
}

function LazyGate({
  reservedHeight,
  children,
}: {
  reservedHeight?: number;
  children: React.ReactNode;
}) {
  // Decide once, at mount (the signals are page-global and don't change under
  // us — except print, handled by the `beforeprint` listener below).
  const eager = useMemo(() => isEagerMount(readEagerMountSignals()), []);
  const [mounted, setMounted] = useState(eager);
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const fill = useContext(ChartFillContext);

  useEffect(() => {
    if (mounted) return;
    // Print must render EVERYTHING — mount before the print snapshot is taken.
    const onBeforePrint = () => setMounted(true);
    window.addEventListener("beforeprint", onBeforePrint);
    const cleanupPrint = () => window.removeEventListener("beforeprint", onBeforePrint);

    // No IntersectionObserver (old headless / jsdom) → mount eagerly rather
    // than never: lazy is a perf optimization, not a correctness gate.
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return cleanupPrint;
    }

    // H13. The placeholder ref can still be null at effect time (the element is
    // committed in a later pass, or the pane sits in a container React has not
    // laid out yet). The old code returned early and, because the effect only
    // re-ran on `mounted`, NEVER attached an observer: that pane stayed blank
    // forever. Retry across a bounded number of frames instead, and once
    // attached keep a ResizeObserver on the placeholder so a container that is
    // zero-sized/hidden at attach time (a collapsed panel, a `display:none`
    // tab) re-triggers the intersection check when it finally gains a box.
    let cancelled = false;
    let attempts = 0;
    let frame: ReturnType<typeof requestAnimationFrame> | number | null = null;
    let io: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;

    const schedule = (fn: () => void): ReturnType<typeof requestAnimationFrame> | number =>
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(fn)
        : (setTimeout(fn, 16) as unknown as number);
    const unschedule = (handle: ReturnType<typeof requestAnimationFrame> | number): void => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle as number);
      else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
    };

    const attach = (): void => {
      if (cancelled) return;
      frame = null;
      const el = placeholderRef.current;
      if (!el) {
        if (!shouldRetryObserve(attempts++)) return;
        frame = schedule(attach);
        return;
      }
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io?.disconnect();
            ro?.disconnect();
            setMounted(true);
          }
        },
        { rootMargin: LAZY_ROOT_MARGIN },
      );
      io.observe(el);
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => {
          const node = placeholderRef.current;
          if (!node || !io) return;
          // Re-observing re-delivers an entry for the CURRENT geometry, so a
          // placeholder that has just become visible is evaluated again.
          io.unobserve(node);
          io.observe(node);
        });
        ro.observe(el);
      }
    };
    attach();

    return () => {
      cancelled = true;
      if (frame !== null) unschedule(frame);
      io?.disconnect();
      ro?.disconnect();
      cleanupPrint();
    };
  }, [mounted]);

  // A mounted gate is the one viewport answer this tree has: the pane is at (or
  // within `LAZY_ROOT_MARGIN` of) the viewport, so its preparation work should
  // run before work nobody has evidence is on screen.
  if (mounted) {
    return (
      <PaneVisibilityContext.Provider value={true}>{children}</PaneVisibilityContext.Provider>
    );
  }
  // Layout-preserving placeholder: reserve the SAME height ChartBox will use
  // once the real child mounts (props.height → fill 100% → 400px default), so
  // the swap causes no layout shift for the ChartBox-wrapped renderers.
  return (
    <div
      ref={placeholderRef}
      className="cairn-plot-lazy-placeholder"
      aria-hidden="true"
      style={{
        height: reservedHeight ?? (fill ? "100%" : DEFAULT_CHART_HEIGHT),
        width: "100%",
      }}
    />
  );
}

/** The reserved-height hint for a leaf/compare placeholder: the node's own
 *  `props.height` (px) when present, else undefined (LazyGate falls back to the
 *  ChartBox fill/default heuristic). */
function reservedHeightOf(props: Record<string, unknown> | undefined): number | undefined {
  const h = props?.height;
  return typeof h === "number" ? h : undefined;
}


/**
 * Dispatch on `node.kind`, INSIDE the pane's `PlotCell` (so it can read
 * the pane's sync identity). Phase 3: a compare node in ANY mode (diff AND
 * split/blend) lowers to `ImageHostAdapter` with a synthesized image leaf + a resolved
 * `compareSource` — the SAME component an image plot leaf renders — so every
 * image-compatible stack is homogeneous and a mode switch / stacked flip is a
 * source-swap on the reused pane (NO remount, no `CompositeMediaPane`/
 * `GpuComparePane`, no flicker). The `mode`/`splitPosition`/`blendAlpha` ride the
 * `compareSource`; the pane's MODE menu lifts changes back through the callbacks.
 */
function NodeDispatch({ node, path = "root" }: { node: PlotNode; path?: string }) {
  switch (node.kind) {
    case "grid":
      // Grids are cheap layout — only their leaf/compare descendants gate.
      return <GridView node={node} path={path} />;
    case "plot":
      if (node.type === "image") {
        return <LazyGate reservedHeight={reservedHeightOf(node.props)}><ImageNodeHost node={node} /></LazyGate>;
      }
      return (
        <LazyGate reservedHeight={reservedHeightOf(node.props)}>
          <GenericLeafView node={node} />
        </LazyGate>
      );
    case "compare":
      if (comparisonType(node) === "image") {
        return <LazyGate reservedHeight={reservedHeightOf(node.props)}><ImageNodeHost node={node} /></LazyGate>;
      }
      return <GenericComparisonView node={node} />;
    default:
      return <Message text={`unknown node kind "${(node as PlotNode).kind}"`} error />;
  }
}

/** Generic definition-backed leaf host. Plot-specific behavior belongs behind
 * the registered definition/backend pair; this component only resolves,
 * leases, and connects the cell settings command port. */
function GenericLeafView({ node }: { node: PlotLeafNode }) {
  const { source, shared } = useSharedPlot();
  const cell = useContext(CellSettingsContext);
  const visible = usePaneVisible();
  const key = resolutionKey(source, node);
  const [, bumpRegistry] = useState(0);
  useSyncExternalStore(subscribeResolveCache, resolveCacheVersion, resolveCacheVersion);

  const registered = getReactPlotType(node.type);
  useEffect(() => {
    if (registered) return;
    return onRegisterReactPlotType(() => bumpRegistry((value) => value + 1));
  }, [registered, node.type]);
  useEffect(() => {
    if (!registered || peekResolved(key) !== undefined || peekResolveError(key) !== undefined) return;
    void resolveCached(key, async () => registered.definition.present(
      await registered.definition.resolve(node, {
        source,
        signal: new AbortController().signal,
      }),
    ), "foreground", { visible }).catch(() => {});
  }, [key, node, registered, source, visible]);

  const presentation = peekResolved<unknown>(key);
  useEffect(() => {
    if (presentation === undefined) return;
    const lease = acquireResolved(key);
    return () => lease?.release();
  }, [key, presentation]);

  const error = peekResolveError(key);
  if (error) return <Message text={`Plot error: ${error}`} error />;
  if (!registered) return <Message text={`plot type ${JSON.stringify(node.type)} is not installed`} error />;
  if (presentation === undefined) return <Message text="Loading…" />;
  if (presentation === null || typeof presentation !== "object" || Array.isArray(presentation)) {
    return <Message text={`plot ${JSON.stringify(node.type)} returned an invalid presentation`} error />;
  }
  if (!registered.backends.length) {
    return <Message text={`backend for ${JSON.stringify(node.type)} is not installed`} error />;
  }

  return (
    <ReactBackendOutlet
      backends={registered.backends}
      environment={browserRenderEnvironment()}
      presentation={withoutSettingsPlumbing(presentation as Record<string, unknown>)}
      settings={registered.definition.projectSettings(
        (cell?.syncedSettings ?? {}) as import("../plots/contracts.ts").SettingsRecord,
      )}
      commands={{
        patch: (patch) => cell?.setSyncedSettings?.(patch as PlotSettings),
        reset: () => {
          (cell?.resetSyncedSettings ?? cell?.setSyncedSettings)?.(
            defaultSettingsForNode(node, shared),
          );
        },
      }}
      invalidation="presentation"
    />
  );
}

/** Capability-backed host for comparisons that do not require image continuity. */
function GenericComparisonView({ node }: { node: CompareNode }) {
  const { source, shared } = useSharedPlot();
  const paneSync = useContext(CellSettingsContext);
  const visible = usePaneVisible();
  const key = resolutionKey(source, node, "|comparison");
  useSyncExternalStore(subscribeResolveCache, resolveCacheVersion, resolveCacheVersion);
  const planned = useMemo(() => {
    try {
      return { value: planComparison(node), error: null };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [node]);
  useEffect(() => {
    if (!planned.value || peekResolved(key) !== undefined || peekResolveError(key) !== undefined) return;
    void resolveCached(key, () => resolveComparison(node, {
      source,
      signal: new AbortController().signal,
    }), "foreground", { visible }).catch(() => {});
  }, [key, node, planned.value, source, visible]);
  const presentation = peekResolved<unknown>(key);
  useEffect(() => {
    if (presentation === undefined) return;
    const lease = acquireResolved(key);
    return () => lease?.release();
  }, [key, presentation]);
  const error = planned.error ?? peekResolveError(key);
  if (error) return <Message text={error} error />;
  if (presentation === undefined) return <Message text="Loading…" />;
  if (!planned.value) return <Message text="invalid comparison" error />;
  const registered = getReactPlotType(planned.value.type);
  if (!registered) {
    return <Message text={`comparison host for ${JSON.stringify(planned.value.type)} is not installed`} error />;
  }
  if (presentation === null || typeof presentation !== "object" || Array.isArray(presentation)) {
    return <Message text={`comparison ${JSON.stringify(planned.value.type)} returned an invalid presentation`} error />;
  }
  const settings = {
    ...planned.value.definition.defaults(node),
    ...(paneSync?.syncedSettings ?? {}),
  };
  return (
    <ReactBackendOutlet
      backends={registered.backends}
      environment={browserRenderEnvironment()}
      presentation={presentation as Record<string, unknown>}
      settings={settings as import("../plots/contracts.ts").SettingsRecord}
      commands={{
        patch: (patch) => paneSync?.setSyncedSettings?.(patch as PlotSettings),
        reset: () => {
          (paneSync?.resetSyncedSettings ?? paneSync?.setSyncedSettings)?.(
            defaultSettingsForNode(node, shared),
          );
        },
      }}
      invalidation="presentation"
    />
  );
}

/**
 * Grid nodes are layout only. Plot and comparison nodes create one settings and
 * selection-owning cell. Stacked grids instantiate that same cell explicitly at
 * their stable active-content position, so tab changes update its content
 * without replacing the cell.
 */
export function PlotNodeView({ node, path = "root" }: { node: PlotNode; path?: string }) {
  if (node.kind === "compare" && comparisonType(node) === "image") {
    try {
      const expanded = expandImageComparison(node);
      if (expanded) {
        return <LayoutFrame><NodeDispatch node={expanded} path={`${path}/comparison`} /></LayoutFrame>;
      }
    } catch (error) {
      return <Message text={error instanceof Error ? error.message : String(error)} error />;
    }
  }
  if (node.kind === "grid") {
    return <LayoutFrame><NodeDispatch node={node} path={path} /></LayoutFrame>;
  }
  return (
    <PlotCell sessionId={`cell:${path}`} selectable={isSelectableNode(node)} node={node}>
      <NodeDispatch node={node} path={path} />
    </PlotCell>
  );
}

function isSelectableNode(node: Exclude<PlotNode, GridNode>): boolean {
  return (node.props?.selectable as boolean | undefined) !== false;
}

/** Preserve the old grid-item sizing wrapper without allocating cell state. */
function LayoutFrame({ children }: { children: React.ReactNode }) {
  const fill = useContext(ChartFillContext);
  return (
    <div data-plot-layout-frame="" style={{ minWidth: 0, position: "relative", ...(fill ? { height: "100%" } : null) }}>
      {children}
    </div>
  );
}
