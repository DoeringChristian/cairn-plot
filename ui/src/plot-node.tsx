/**
 * The recursive cairn-plot compositor (G1). A `PlotDescriptor` is a TREE of
 * `PlotNode`s — `plot` leaves, `grid` layouts, `compare` panes — and this
 * module renders it. `PlotApp` (plot-bootstrap.tsx) is now a thin root wrapper
 * that builds ONE `DataSource` for the whole tree, seeds a `SharedPlotContext`,
 * and mounts `<PlotNodeView node={root} />`.
 *
 * The former flat single-renderer body of `PlotApp` lives on here as
 * `LeafView` (resolveDataProps → bounded wait-for-registration → render via the
 * `*Standalone` adapters in the registry).
 */
import React, {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Colorbar,
  type ColormapName,
} from "./lib/cairn-plot";
import type {
  CompareSource,
  DecodedSource,
  CompareAlign,
  CompareFit,
} from "./lib/cairn-plot/renderers/image-backend";
import {
  resolveDataProps,
  type CompareNode,
  type GridNode,
  type PlotLeafNode,
  type PlotNode,
} from "./plot-descriptor";
import { getRenderer, onRegister } from "./plot-registry";
import { stackLabelFor } from "./lib/cairn-plot/stack/StackedView";
import { InStackedGridContext } from "./lib/cairn-plot/stack/stack-context";
import FullscreenOverlayShell, { InFullscreenOverlayContext } from "./lib/cairn-plot/primitives/FullscreenOverlayShell";
import {
  ChartFillContext,
  DEFAULT_CHART_HEIGHT,
} from "./plot-standalone-helpers";
import {
  isEagerMount,
  LAZY_ROOT_MARGIN,
  type EagerMountSignals,
} from "./lib/cairn-plot/lazy-mount";
import {
  resolutionKey,
  acquireResolved,
  peekResolved,
  peekResolveError,
  resolveCached,
  prefetchResolved,
  subscribeResolveCache,
  resolveCacheVersion,
} from "./lib/cairn-plot/resolve-cache";
import {
  channelToolbarButton,
  treeHasSelectableChannels,
  type ChannelSelection,
  type ChannelMenuTree,
} from "./lib/cairn-plot/image/channel-menu";
import {
  applyChannelSlice,
  syntheticChannelTree,
} from "./lib/cairn-plot/image/channel-slice";
import { type ViewportSettings } from "./lib/cairn-plot/settings/viewport-settings";
import { initialViewportSettings } from "./lib/cairn-plot/settings/viewport-initial-settings.ts";
import { GridLayout, type GridLayoutState } from "./layout/GridLayout.tsx";
import {
  PaneSyncContext,
  SharedPlotContext,
  useSharedPlot,
} from "./host/plot-context.ts";
import { PlotCell } from "./host/PlotCell.tsx";
import { ReactBackendOutlet } from "./host/react-backend.ts";
import { getReactPlotType } from "./plots/react-registry.ts";
import { comparisonRenderer } from "./plots/registry.ts";
import type { RenderEnvironment } from "./backends/contracts.ts";
import {
  planRegisteredImageComparison as synthDiffLeafOf,
  resolveRegisteredImageComparison,
} from "./plots/image/comparison-plan.ts";
import {
  useImageComparisonControl,
  type CompareViewMode,
} from "./plots/image/use-comparison-control.ts";
import { usePlotSessionController } from "./state/session/session-context.ts";
import { getGlobalSelectionStore } from "./lib/cairn-plot/selection/selection-store.ts";
import { getRegisteredPane } from "./plot-selection-pane-registry.ts";

// Compatibility exports for existing standalone/stage imports. The host owns
// these contracts; plot-node only consumes and re-exports them.
export { PaneSyncContext, SharedPlotContext } from "./host/plot-context.ts";
export type { PaneSyncCtx, SharedPlotCtx } from "./host/plot-context.ts";

/**
 * How long a `LeafView` waits for a not-yet-registered renderer (an addon
 * `<script>` still parsing) before surfacing "unknown renderer". Reduced from
 * 8000 (O2 review M1): the addon IIFE is emitted synchronously BEFORE the mount
 * push and runs same-page, so registration always wins in practice; this bound
 * only guards a genuinely unknown/misspelled renderer, which shouldn't stall 8s.
 */
const RENDERER_WAIT_MS = 4000;

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

// TEST-ONLY no-flash instrumentation. `LeafView` reads its resolved value straight
// from the subscribable resolve-cache (a pure function of `resolveKey`), so there is
// no component-held `state` cell that can hold a PREVIOUS slot's resolution across a
// flip: a WARM/prefetched slot resolves synchronously (instant, no placeholder); a
// COLD slot renders a brief `"Loading…"` (accepted). `placeholderMounts` lets a
// harness prove a WARM flip storm never drops to a placeholder. (The former
// `staleDiffHolds` counter is retired — the stale-operand / reference-leak window it
// witnessed is now UNREPRESENTABLE: the leaf never emits a `compareSource` with an
// undefined `b`, because it only builds one from a RESOLVED diff-pair.) No production
// code reads this; the increment is a single integer.
interface LeafResolveStats {
  placeholderMounts: number;
}
const leafResolveStats: LeafResolveStats = { placeholderMounts: 0 };
if (typeof window !== "undefined") {
  (window as unknown as { __cairnLeafResolveStats?: LeafResolveStats }).__cairnLeafResolveStats = leafResolveStats;
}

// ---------------------------------------------------------------------------
// Leaf — the former flat `PlotApp` body. Resolves the leaf's DataSpec against
// the shared source, waits (bounded) for its renderer to register, and renders
// the registered `*Standalone` adapter. `shared.colormap`/`colorRange` merge in
// BELOW the leaf's own props (leaf props win).
// ---------------------------------------------------------------------------
function LeafView({ node, diffSpec }: { node: PlotLeafNode; diffSpec?: DiffLeafSpec }) {
  const { source, shared } = useSharedPlot();
  // Per-pane selection-derived sync overrides (undefined outside a ≥2 selection).
  const paneSync = useContext(PaneSyncContext);
  // True inside a STACKED viewport — threaded to the pane so it treats its display
  // settings as the stack's ONE SHARED object (a pick applies to all slots + survives
  // flips; authored props are seeds; HOME adopts the focused slot; exit discards).
  const inStackedGrid = useContext(InStackedGridContext);
  // DIFF path (Phase 2c): a diff-mode compare lowers to THIS component (so an
  // `[image, diff]` stack is homogeneous — no remount on a flip). When present,
  // BOTH operands resolve through the compare resolver (`node.data` = reference =
  // `source`; `diffSpec.fgData` = foreground = `compareSource.b`) instead of the
  // single-image `resolveDataProps`, and a `compareSource` is threaded to the
  // image renderer. The channel strip / exr tree / shared-colormap merge below
  // are single-image concerns and are inert on this path.
  const isDiff = !!diffSpec;
  const activeDefaults = diffSpec?.viewportDefaults ?? initialViewportSettings(node, shared) ?? {};
  const resetViewportSettings = useCallback(() => {
    (paneSync?.resetSyncedSettings ?? paneSync?.setSyncedSettings)?.(activeDefaults);
  }, [paneSync?.resetSyncedSettings, paneSync?.setSyncedSettings, activeDefaults]);

  // CHANNEL-STRIP selection override (EXR part/layer). `null` = follow the
  // node's own `data.part`/`data.layer`. Resolves at RENDER through the one
  // lookup: store value > local state (the local cell serves only a viewport
  // with no store). Deliberately NOT reset on a node swap: in a STACKED
  // viewport the same LeafView instance flips between slots, and the picked
  // layer must carry across (shared-settings semantics).
  const [localChSel, setChSel] = useState<ChannelSelection | null>(null);
  const syncedChannelSelect = paneSync?.syncedSettings?.["image.channelSelect"];
  const chSel =
    syncedChannelSelect !== undefined
      ? (syncedChannelSelect as ChannelSelection | null)
      : localChSel;
  const chSelRef = useRef<ChannelSelection | null>(null);
  chSelRef.current = chSel;
  // The last UNSLICED resolve's channel tree (see the menu block below).
  const baseChannelTreeRef = useRef<ChannelMenuTree | undefined>(undefined);
  // The ONE write path for a channel pick (store when present, local else) —
  // shared by the strip handler and the failed-decode revert.
  const setSyncedRef = useRef(paneSync?.setSyncedSettings);
  setSyncedRef.current = paneSync?.setSyncedSettings;
  const applyChannelSelect = useCallback((next: ChannelSelection | null) => {
    // TOP-OF-STACK write (transient-group ruling): the store when present
    // (group while selected — transient; local otherwise — sticks); the local
    // cell only serves a storeless viewport. Writing both would let a
    // group-session pick survive unselect through the local cell.
    if (setSyncedRef.current) setSyncedRef.current({ "image.channelSelect": next });
    else setChSel(next);
  }, []);
  // SINGLE-PANE FULLSCREEN (enlarge) — the flag lives HERE, above the async-
  // resolve swap: a channel pick's cold re-resolve renders the "Loading…"
  // placeholder, unmounting the whole renderer subtree — component-local
  // enlarge state there was reset, throwing the user out of fullscreen (the
  // reported bug). LeafView survives that swap, so the pane consumes this as
  // a CONTROLLED `enlargeControl` and fullscreen persists across re-resolves.
  const [paneEnlarged, setPaneEnlarged] = useState(false);
  const enlargeControl = useMemo(
    () => ({ enlarged: paneEnlarged, setEnlarged: setPaneEnlarged }),
    [paneEnlarged],
  );
  // Theme origin for the enlarged-placeholder overlay (null → default theme;
  // the ready pane's own overlay re-themes from its real in-tree element).
  const placeholderOriginRef = useRef<HTMLElement | null>(null);

  // The EFFECTIVE data spec: the strip override merged over the node's data
  // (image specs only — the strip never renders for other kinds).
  const effectiveData = useMemo(() => {
    if (!chSel || node.data.kind !== "image") return node.data;
    return { ...node.data, part: chSel.part, layer: chSel.layer };
  }, [node.data, chSel]);
  // The resolve-cache key includes the override so each selection caches its own
  // decode (flipping BACK to a seen layer is instant).
  const selLayerKey = Array.isArray(chSel?.layer) ? chSel.layer.join(",") : (chSel?.layer ?? "");
  const selKey = chSel ? `|${chSel.part ?? ""}|${selLayerKey}` : "";
  // The resolve-cache key: the diff pair (reference + foreground, decoded once)
  // when in diff mode; the single-image (+ channel override) key otherwise.
  const resolveKey = resolutionKey(source, node, isDiff ? "|diffpair" : selKey);

  // SUBSCRIBABLE RESOLVE (the flip-commit model). The async-resolved DATA props are
  // NOT held in a component `state` cell — they are read PURELY from the resolve-cache
  // (a `useSyncExternalStore` over the cache) keyed by THIS render's `resolveKey`. So
  // the resolved value is a pure function of `resolveKey`: a WARM/prefetched flip
  // resolves the new slot SYNCHRONOUSLY in the flip commit itself (instant, no
  // placeholder), and a COLD swap (cache miss) renders a brief `"Loading…"` — the
  // accepted loading state (user ruling: brief loading OK), never a HOLD of the
  // previous slot's frame. There is therefore no lag cell to leak a stale operand:
  // the stale-diff / reference-flash windows are structurally unrepresentable, not
  // guarded. The shared-block + selection-sync props are merged at RENDER time (below)
  // so a selection change re-renders WITHOUT re-fetching the data.
  useSyncExternalStore(subscribeResolveCache, resolveCacheVersion, resolveCacheVersion);
  // Local error surface for a renderer-registration TIMEOUT only; a decode/resolve
  // error lives in the cache (read via `peekResolveError`).
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [, bumpRegistry] = useState(0);

  useEffect(() => {
    const key = resolveKey;
    // Already resolved (warm/prefetched) or errored → nothing to kick off; the pure
    // read below shows it. On resolution the cache NOTIFIES and this leaf re-renders.
    if (peekResolved(key) !== undefined || peekResolveError(key) !== undefined) return;
    let cancelled = false;
    // DIFF path: resolve BOTH operands through the compare resolver; the cached payload
    // carries the decoded foreground (`__diffB`) + content keys alongside the reference
    // `source`. SIGN convention: `source` = reference, `compareSource.b` = foreground
    // (`diff = source − b`, byte-parity with the compare pane's `texA − texB`).
    if (diffSpec) {
      void resolveCached(key, () => resolveRegisteredImageComparison(diffSpec.node, source)).catch(() => {
        /* error is cached (peekResolveError) — the pure read surfaces it */
      });
      return () => {
        cancelled = true;
      };
    }
    void resolveCached(key, async () => {
      const registered = getReactPlotType(node.renderer);
      const dp = registered
        ? registered.definition.present(await registered.definition.resolve(
            { ...node, data: effectiveData },
            { source, signal: new AbortController().signal },
          )) as Record<string, unknown>
        : await resolveDataProps(effectiveData, source);
      // FORMAT-AGNOSTIC channel selection: EXR selects at decode (dp.exrTree present —
      // the selector already rode `effectiveData`); everything else is an N-channel
      // array and the selection is a pure post-decode SLICE.
      const describedSelectable =
        !!dp.exrTree && treeHasSelectableChannels(dp.exrTree as ChannelMenuTree);
      if (chSelRef.current?.layer != null && !describedSelectable) {
        return applyChannelSlice(dp, chSelRef.current.layer);
      }
      return dp;
    }).catch((err) => {
      if (cancelled) return;
      // A CHANNEL-OVERRIDE decode that fails must never strand the pane in an error
      // state with no way back (the CHANNELS menu only renders on the ready pane):
      // revert the override (a different resolveKey re-resolves the base source) and
      // keep the last good frame. A non-channel error stays in the cache and the pure
      // read surfaces it as the error state.
      if (chSelRef.current) {
        // eslint-disable-next-line no-console
        console.warn("cairn-plot: channel selection failed, reverting:", err);
        applyChannelSelect(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [node, source, selKey, effectiveData, resolveKey, diffSpec]);

  // Strip pick: ONE store write (a group flips every pane to the same
  // part/layer BY NAME; a lone viewport's pick sticks in its local store).
  const selectChannels = useCallback(
    (sel: ChannelSelection) => {
      const next = sel.part == null && sel.layer == null ? null : sel;
      applyChannelSelect(next);
    },
    [applyChannelSelect],
  );

  // PURE READ of THIS render's resolveKey (the flip-commit guarantee). `peekResolved`
  // returns the SAME cached object across renders, so `dataProps` is reference-stable;
  // a flip swaps `resolveKey` and the value it reads in the SAME commit — a warm slot
  // is instant, a cold slot misses (→ `undefined` → the brief loading state). There is
  // no `state` fallback, so a previous slot's resolution can never leak: the stale-diff
  // reference-flash is structurally impossible, not guarded.
  const resolvedNow: Record<string, unknown> | undefined = peekResolved<Record<string, unknown>>(resolveKey);
  useEffect(() => {
    if (resolvedNow === undefined) return;
    const lease = acquireResolved(resolveKey);
    return () => lease?.release();
  }, [resolveKey, resolvedNow]);
  const cacheError = peekResolveError(resolveKey);
  // CHANNEL-PICK HOLD (user ruling: a channel pick must NEVER create a new
  // pane). The pick rides the settings store like any other display setting,
  // so its pending re-resolve must not swap the viewport for a placeholder —
  // the SAME pane instance keeps showing the previous channel's payload and
  // the new decode swaps IN PLACE as a prop change when it lands (exactly how
  // a colormap change propagates; the pane re-uploads, nothing remounts).
  // Gated to the SAME BASE SOURCE (`sourceKey(node)` unchanged — only the
  // channel-selection suffix differs): a STACKED-slot flip changes the base
  // key, so the flip-commit ruling ("a cold flip renders loading, never a
  // hold of the previous slot's frame" — the stale-diff guarantee) is
  // untouched, as is the first mount (no previous payload to hold).
  const baseKey = resolutionKey(source, node, isDiff ? "|diffpair" : "");
  const lastReadyRef = useRef<{ base: string; dataProps: Record<string, unknown> } | null>(null);
  const held =
    resolvedNow === undefined && cacheError === undefined && lastReadyRef.current?.base === baseKey
      ? lastReadyRef.current.dataProps
      : undefined;
  const dataProps = resolvedNow ?? held;
  if (resolvedNow !== undefined) {
    lastReadyRef.current = { base: baseKey, dataProps: resolvedNow };
  }
  // A `kind:"diff"` payload STRUCTURALLY carries its foreground (`__diffB`) — the leaf
  // only builds a `compareSource` from a RESOLVED diff pair, so `b` is never undefined.
  // This guard is defensive (should be unreachable): if a diff payload ever lacked its
  // operand, render loading rather than a half-built `compareSource`.
  const diffOperandMissing = !!diffSpec && dataProps !== undefined && dataProps.__diffB === undefined;
  const errorMsg = rendererError ?? cacheError;
  const status: "loading" | "error" | "ready" =
    dataProps !== undefined && !diffOperandMissing ? "ready" : errorMsg !== undefined ? "error" : "loading";

  // Merge the shared block + the live sync group ids over the resolved data
  // props at render (leaf `node.props` win over `shared`, data props win over
  // all). The viewport-sync group id is the selection override when this pane is
  // in a ≥2 selection, else the grid-wide static `shared.sync.viewport` group;
  // the settings-sync group + anchor flag come only from an active selection.
  const mergedProps = useMemo<Record<string, unknown>>(() => {
    if (!dataProps) return {};
    // COMPARE path (diff + split/blend): the resolved reference `source` + the
    // LIVE `compareSource` (the decoded foreground + content keys from the cache,
    // plus the per-render mode/kernel/split/blend settings + callbacks). No
    // shared-colormap merge, no channel strip — those are single-image concerns.
    // `node.props` carries the synth leaf's view controls
    // (interpolation/showAxes/toolbar/pixelValueNotation).
    if (diffSpec) {
      const dp = dataProps;
      // `dp` is a RESOLVED diff pair, so `__diffB` (the foreground operand) is always
      // present — `status` already forced loading otherwise (`diffOperandMissing`), so
      // this memo never builds a `compareSource` with an undefined `b`. Defensive:
      // if it were somehow missing, return benign props (not rendered — status loading).
      if (dp.__diffB === undefined) return {};
      const dsync: Record<string, unknown> = {};
      if (paneSync?.syncedSettings) dsync.syncedSettings = paneSync.syncedSettings;
      if (paneSync?.setSyncedSettings) dsync.setSyncedSettings = paneSync.setSyncedSettings;
      if (paneSync?.applySyncedSettings) dsync.applySyncedSettings = paneSync.applySyncedSettings;
      dsync.resetViewportSettings = resetViewportSettings;
      const compareSource: CompareSource = {
        b: dp.__diffB as DecodedSource,
        opId: diffSpec.diffKernel,
        mode: diffSpec.mode,
        colormap: diffSpec.colormap,
        align: diffSpec.align,
        fit: diffSpec.fit,
        contentKeyA: dp.__diffContentKeyA as string,
        contentKeyB: dp.__diffContentKeyB as string,
        referenceLabel: diffSpec.referenceLabel,
        foregroundLabel: diffSpec.foregroundLabel,
        splitPosition: diffSpec.splitPosition,
        inStackedGrid: diffSpec.inStackedGrid,
        inOverlay: diffSpec.inOverlay,
        onDiffKernelChange: diffSpec.onDiffKernelChange,
        onCompareModeChange: diffSpec.onCompareModeChange,
        onSplitPositionChange: diffSpec.onSplitPositionChange,
        compareModified: diffSpec.compareModified,
      };
      return {
        ...(node.props ?? {}),
        source: dp.source,
        compareSource,
        enlargeControl,
        ...(dp.__diffOverlay ? { overlay: dp.__diffOverlay } : {}),
        ...dsync,
      };
    }
    const sharedProps: Record<string, unknown> = {};
    if (shared?.colormap != null) sharedProps.colormap = shared.colormap;
    if (shared?.colorRange != null) sharedProps.colorRange = shared.colorRange;
    if (paneSync?.syncedSettings) sharedProps.syncedSettings = paneSync.syncedSettings;
    if (paneSync?.setSyncedSettings) sharedProps.setSyncedSettings = paneSync.setSyncedSettings;
    if (paneSync?.applySyncedSettings) sharedProps.applySyncedSettings = paneSync.applySyncedSettings;
    sharedProps.resetViewportSettings = resetViewportSettings;
    // CHANNELS toolbar menu (EXR part/layer): built here (the owner of the
    // selection state) and handed to the pane as a standard ToolbarButtonSpec —
    // the pane renders it with its other leading menus and folds the override
    // into HOME (reset clears back to the authored selection).
    // The channel tree is FORMAT-AGNOSTIC: EXRs carry their described tree;
    // any other multi-channel source gets a synthesized R/G/B/A tree — after
    // decode the file type has no bearing on what a channel selection means.
    const described = dataProps.exrTree as ChannelMenuTree | undefined;
    // A deep-only described tree offers nothing to select — fall back to the
    // synthetic RGBA tree over the FLATTENED pixels (format-agnostic slice).
    const resolvedTree =
      (described && treeHasSelectableChannels(described) ? described : undefined) ??
      (syntheticChannelTree(dataProps.source as never) as ChannelMenuTree | null) ??
      undefined;
    // A SLICED resolve (a single channel picked) can carry NO selectable tree
    // (the sliced source is k=1), which would drop the CHANNELS menu and make
    // the pick irreversible. Remember the last UNSLICED tree and offer it while
    // a selection is active, so the channel choice stays changeable.
    if (chSel == null && resolvedTree) baseChannelTreeRef.current = resolvedTree;
    const exrTree = resolvedTree ?? (chSel != null ? baseChannelTreeRef.current : undefined);
    if (exrTree && (node.data.kind === "image" || node.data.kind === "imghdr" || node.data.kind === "inline" || node.data.kind === "url")) {
      const effSel: ChannelSelection =
        chSel ??
        (node.data.kind === "image"
          ? { part: node.data.part, layer: node.data.layer }
          : {});
      const menu = channelToolbarButton(exrTree, effSel, (sel) => selectChannels(sel ?? {}));
      if (menu) {
        sharedProps.channelMenu = menu;
        sharedProps.channelModified = chSel != null;
        sharedProps.onChannelReset = () => selectChannels({});
      }
    }
    sharedProps.enlargeControl = enlargeControl;
    return { ...sharedProps, ...(node.props ?? {}), ...dataProps, inStackedGrid };
  }, [dataProps, shared, paneSync, node.props, chSel, selectChannels, node.data, diffSpec, inStackedGrid, enlargeControl]);

  // Wait-for-registration: re-render the instant the renderer arrives, else
  // surface a bounded "unknown renderer" error.
  const rendererMissing = status === "ready" && !getReactPlotType(node.renderer) && !getRenderer(node.renderer);
  useEffect(() => {
    if (status !== "ready" || getReactPlotType(node.renderer) || getRenderer(node.renderer)) return;
    const name = node.renderer;
    let settled = false;
    const unsub = onRegister(() => {
      if (!settled && getRenderer(name)) {
        settled = true;
        setRendererError(null); // renderer arrived → clear any prior timeout error
        bumpRegistry((n) => n + 1);
      }
    });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setRendererError(`unknown renderer "${name}"`);
      }
    }, RENDERER_WAIT_MS);
    return () => {
      settled = true;
      unsub();
      clearTimeout(timer);
    };
  }, [status, rendererMissing, node.renderer]);

  // While ENLARGED, the loading/error placeholder renders INSIDE the fullscreen
  // overlay chrome (same backdrop/✕/Escape seam), so a slow re-resolve (an EXR
  // channel pick's decode) never visually drops the user back to the grid —
  // the pane re-enters the shell-owned overlay when ready (`enlargeControl`).
  const placeholderInShell = (child: JSX.Element) =>
    paneEnlarged ? (
      <FullscreenOverlayShell
        open
        onClose={() => setPaneEnlarged(false)}
        originRef={placeholderOriginRef}
        ariaLabel="Enlarged plot"
      >
        {child}
      </FullscreenOverlayShell>
    ) : (
      child
    );
  if (status === "loading") {
    leafResolveStats.placeholderMounts++;
    return placeholderInShell(<Message text="Loading…" />);
  }
  if (status === "error") {
    return placeholderInShell(<Message text={`Plot error: ${errorMsg ?? "unknown"}`} error />);
  }
  const Renderer = getRenderer(node.renderer);
  const registered = getReactPlotType(node.renderer);
  if (registered) {
    const settings = (paneSync?.syncedSettings ?? {}) as import("./plots/contracts.ts").SettingsRecord;
    return (
      <ReactBackendOutlet
        backends={registered.backends}
        environment={browserRenderEnvironment()}
        presentation={mergedProps}
        settings={settings}
        invalidation="presentation"
      />
    );
  }
  return Renderer ? (
    <Suspense fallback={<Message text="Loading renderer…" />}>
      <Renderer {...mergedProps} />
    </Suspense>
  ) : (
    <Message text="Loading renderer…" />
  );
}

function browserRenderEnvironment(): RenderEnvironment {
  return {
    webgpu: typeof navigator !== "undefined" && "gpu" in navigator,
    webgl2: typeof WebGL2RenderingContext !== "undefined",
    pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  };
}

/** The LIVE compare settings + resolved foreground operand a compare node hands
 *  `LeafView` (Phase 3: EVERY mode — diff AND split — lowers here, so the
 *  whole compare family renders through the ONE unified pane). The reference
 *  operand IS the synthesized leaf's `node.data` (resolved through the leaf's own
 *  cache); this carries everything else. */
interface DiffLeafSpec {
  /** Durable comparison used to resolve through its registered capability. */
  node: CompareNode;
  /** The compare MODE (`diff` | `split`) — lifted state. Diff renders the
   *  scalar-error kernel; split renders the LIGHT slide compositor. */
  mode: CompareViewMode;
  /** The diff KERNEL (a menu token) — always a real kernel, seeds the pane's diff
   *  face even while `mode` is a compositor mode. */
  diffKernel: string;
  /** Authored colormap override (`"none"` follows the kernel default). */
  colormap: CompareSource["colormap"];
  /** Authored/default settings of the currently visible compare content. */
  viewportDefaults: ViewportSettings;
  /** Split-divider position (`mode:"split"`) — lifted control state. */
  splitPosition: number;
  align?: CompareAlign;
  fit?: CompareFit;
  referenceLabel?: string;
  foregroundLabel?: string;
  /** True when this compare is inside a STACKED grid / FULLSCREEN overlay —
   *  threaded to the addon-bundled pane's `useSplitFlipKeys` (its own context read
   *  would miss across the bundle boundary). */
  inStackedGrid: boolean;
  inOverlay: boolean;
  /** Pane MODE / divider callbacks → the lifted control (keeps routing +
   *  the reused-instance control state coherent). */
  onDiffKernelChange: (id: string) => void;
  onCompareModeChange: (mode: CompareViewMode) => void;
  onSplitPositionChange: (p: number) => void;
  /** True when the hoisted compare control differs from the descriptor (HOME dot). */
  compareModified: boolean;
}

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
  const viewSettingsGroupId = node.shared?.sync?.viewport
    ? `plot-grid-view-${localId}`
    : null;
  const sessionController = usePlotSessionController();
  const sessionId = `grid:${path}`;
  const [layoutState, setLayoutState] = useState<GridLayoutState>({
    mode: node.mode ?? "normal",
    activeSlot: 0,
  });
  useEffect(() => {
    if (!sessionController) return;
    return sessionController.registerGrid(sessionId, setLayoutState, layoutState);
    // Registration deliberately captures only the authored initial state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionController, sessionId]);
  const changeLayoutState = useCallback((next: GridLayoutState) => {
    if (layoutState.mode === "normal" && next.mode === "stacked" && sessionController) {
      const selectedEntry = getGlobalSelectionStore().getSelected()
        .map(getRegisteredPane)
        .find((entry) => entry?.sessionId?.startsWith(`cell:${path}/`));
      const saved = sessionController.getSession();
      const firstSettings = Object.entries(saved.viewports)
        .find(([id]) => id.startsWith(`cell:${path}/`))?.[1].settings;
      sessionController.seedViewport(
        `stack:${path}`,
        selectedEntry?.settings?.get() ?? firstSettings ?? {},
      );
    }
    setLayoutState(next);
    sessionController?.recordGrid(sessionId, next);
  }, [layoutState.mode, path, sessionController, sessionId]);

  const renderNormal = useCallback(
    (index: number) => <PlotNodeView node={children[index]!} path={`${path}/${index}`} />,
    [children, path],
  );
  const renderStacked = useCallback(
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
            run: () => resolveDataProps(child.data, source),
          });
        } else if (child.kind === "compare") {
          // Comparison preparation belongs to its installed plot host. The
          // transitional production host below currently implements image.
          if (comparisonRenderer(child) !== "image") continue;
          const synth = synthDiffLeafOf(child);
          entries.push({
            key: resolutionKey(source, synth.leaf, "|diffpair"),
            run: () => resolveRegisteredImageComparison(child, source),
          });
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
      initialMode={node.mode}
      state={layoutState}
      onStateChange={changeLayoutState}
      switchable={node.switchable !== false}
      labels={children.map((child, index) => stackLabelFor(child, index))}
      renderNormal={renderNormal}
      renderStacked={renderStacked}
      preload={preload}
    />
  );
  const body = node.shared && node.shared !== parentShared ? (
    <SharedPlotContext.Provider value={{ source, shared, viewSettingsGroupId }}>
      {grid}
    </SharedPlotContext.Provider>
  ) : grid;

  if (!node.shared?.colorbar) return body;
  const cbColormap = (node.shared.colormap as ColormapName | undefined) ?? "turbo";
  const [min, max] = node.shared.colorRange ?? [undefined, undefined];
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
// `lib/cairn-plot/lazy-mount.ts` for the pure decision fn.
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
    const el = placeholderRef.current;
    if (!el) return cleanupPrint;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: LAZY_ROOT_MARGIN },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cleanupPrint();
    };
  }, [mounted]);

  if (mounted) return <>{children}</>;
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
 * split/blend) lowers to `LeafView` with a synthesized image leaf + a resolved
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
      if (node.renderer === "image") return <ImageCompatibleView node={node} />;
      return (
        <LazyGate reservedHeight={reservedHeightOf(node.props)}>
          <LeafView node={node} />
        </LazyGate>
      );
    case "compare":
      if (comparisonRenderer(node) === "image") return <ImageCompatibleView node={node} />;
      return <Message text={`comparison host for ${JSON.stringify(comparisonRenderer(node))} is not installed`} error />;
    default:
      return <Message text={`unknown node kind "${(node as PlotNode).kind}"`} error />;
  }
}

/**
 * One stable React boundary for ordinary images and image comparisons. A stack
 * flip between them therefore updates the retained LeafView/surface in place.
 */
function ImageCompatibleView({ node }: { node: PlotLeafNode | CompareNode }) {
  const { shared } = useSharedPlot();
  const paneSync = useContext(PaneSyncContext);
  const inStackedGrid = useContext(InStackedGridContext);
  const inOverlay = useContext(InFullscreenOverlayContext);
  const control = useImageComparisonControl(
    node,
    paneSync?.syncedSettings,
    paneSync?.setSyncedSettings,
    paneSync?.applySyncedSettings,
  );
  if (node.kind === "plot") {
    return (
      <LazyGate reservedHeight={reservedHeightOf(node.props)}>
        <LeafView node={node} />
      </LazyGate>
    );
  }
  let synth;
  try {
    synth = synthDiffLeafOf(node);
  } catch (error) {
    return <Message text={error instanceof Error ? error.message : String(error)} error />;
  }
  const diffSpec: DiffLeafSpec = {
    node,
    mode: control.viewMode,
    diffKernel: control.diffKernel,
    colormap: ((paneSync?.syncedSettings?.["image.encoding"] as CompareSource["colormap"] | undefined) ??
      (node.props?.colormap as CompareSource["colormap"]) ??
      (shared?.colormap as CompareSource["colormap"]) ??
      "none") as CompareSource["colormap"],
    splitPosition: control.splitPos,
    align: synth.align,
    fit: synth.fit,
    referenceLabel: synth.referenceLabel,
    foregroundLabel: synth.foregroundLabel,
    inStackedGrid,
    inOverlay,
    onDiffKernelChange: control.setDiffKernel,
    onCompareModeChange: control.setViewMode,
    onSplitPositionChange: control.setSplitPos,
    viewportDefaults: initialViewportSettings(node, shared) ?? {},
    compareModified: control.modified,
  };
  return (
    <LazyGate reservedHeight={reservedHeightOf(node.props)}>
      <LeafView node={synth.leaf} diffSpec={diffSpec} />
    </LazyGate>
  );
}

/**
 * Grid nodes are layout only. Plot and comparison nodes create one settings and
 * selection-owning cell. Stacked grids instantiate that same cell explicitly at
 * their stable active-content position, so tab changes update its content
 * without replacing the cell.
 */
export function PlotNodeView({ node, path = "root" }: { node: PlotNode; path?: string }) {
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
