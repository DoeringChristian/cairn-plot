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
  createContext,
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
  decodeImageSource,
  parseNpy,
  parseOverlay,
  resolveFinalUrl,
  resolveImageViewportItems,
  type ColormapName,
  type CompareFloatSource,
  type DataSource,
  type ImageOverlayData,
} from "./lib/cairn-plot";
import { floatPixelsFrom, floatValues } from "./lib/cairn-plot/image/pixel-buffer.ts";
import type {
  CompareSource,
  DecodedSource,
  CompareAlign,
  CompareFit,
} from "./lib/cairn-plot/renderers/image-backend";
import {
  resolveDataProps,
  type CompareNode,
  type DataSpec,
  type GridNode,
  type PlotLeafNode,
  type PlotNode,
  type SharedProps,
} from "./plot-descriptor";
import { getRenderer, onRegister } from "./plot-registry";
import {
  getGlobalSelectionStore,
  nextSelectionPaneId,
  paneSyncGroups,
  GLOBAL_SELECTION_BASE,
  REFERENCE_COLOR,
  REFERENCE_COLOR_RGB,
  type SelectionMode,
} from "./lib/cairn-plot/viewport/selection-store";
import {
  EnlargeInterceptContext,
  type EnlargeIntercept,
} from "./lib/cairn-plot/renderers/enlarge-intercept";
import {
  isImageCompatibleNode,
  registerSelectionPane,
  unregisterSelectionPane,
} from "./plot-selection-pane-registry";
import {
  GridUniformAspectContext,
  DEFAULT_GRID_CELL_ASPECT,
  VIEWPORT_HEIGHT_MARGIN,
  useUniformGridAspect,
} from "./lib/cairn-plot/renderers/grid-uniform-aspect";
import {
  useStackKeyboard,
  StackTabStrip,
  GridModeToggle,
  stackLabelFor,
} from "./lib/cairn-plot/stack/StackedView";
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
  sourceKey,
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
import { type ImageSyncSettings } from "./lib/cairn-plot/viewport/image-settings-sync";
import {
  useJoinSettingsGroup,
  useViewportSettings,
} from "./lib/cairn-plot/renderers/use-synced-image-settings";

/**
 * How long a `LeafView` waits for a not-yet-registered renderer (an addon
 * `<script>` still parsing) before surfacing "unknown renderer". Reduced from
 * 8000 (O2 review M1): the addon IIFE is emitted synchronously BEFORE the mount
 * push and runs same-page, so registration always wins in practice; this bound
 * only guards a genuinely unknown/misspelled renderer, which shouldn't stall 8s.
 */
const RENDERER_WAIT_MS = 4000;

/** The authored grid `sync.viewport` group fans ONLY the view transform. */
const VIEW_ONLY_KEYS = ["view"] as const;

/** Root-provided context shared by the whole tree: the single `DataSource`,
 *  the nearest grid's `shared` block (colormap/colorRange/reference/…), and
 *  (when that grid opted in via `shared.sync.viewport`) the live viewport-sync
 *  group id for that grid — see `GridView`'s derivation. The SAME id is
 *  threaded to every leaf and drives BOTH sync buses: image panes via
 *  `image-viewport-sync.ts` (`useSyncedImageViewport`) and 2D charts via
 *  `chart-viewport-sync.ts` (`useChartSyncTarget` → `useChartViewport`), so one
 *  flag links a grid's images AND charts. Mirrors the 3D `cameraSyncGroupId`
 *  mechanism (`lib/camera-sync.ts`'s `useCameraSync`), scoped per grid
 *  instead of per card. */
export interface SharedPlotCtx {
  source: DataSource;
  shared?: SharedProps;
  viewportSyncGroupId?: string | null;
}
export const SharedPlotContext = createContext<SharedPlotCtx | null>(null);

function useSharedPlot(): SharedPlotCtx {
  const ctx = useContext(SharedPlotContext);
  if (!ctx) throw new Error("PlotNodeView used outside a SharedPlotContext");
  return ctx;
}

// ---------------------------------------------------------------------------
// Multi-viewport SELECTION (see viewport/selection-store.ts) is PAGE-WIDE. There
// is ONE document-scoped `SelectionStore` (`getGlobalSelectionStore`) shared by
// every pane on the page — standalone `PlotApp` mounts AND grid cells alike, via
// the SAME `PaneSelectionFrame` wrapper (`PlotNodeView` wraps every leaf/compare
// node in one). The frame draws the accent ring on the selected pane, turns a
// click into a store mutation (plain = replace, shift/ctrl/meta = toggle), and
// derives the per-pane sync group ids the leaf consumes: while ≥2 panes are
// selected, every selected pane joins the SAME `cp-global-sel-vp` (viewport) and
// `cp-global-sel-st` (settings) groups so zoom/pan and display-setting changes
// broadcast across the group. The first-selected pane is the ANCHOR whose
// current view + settings a newly-added member adopts. `GridView` keeps ONLY its
// layout role — it no longer owns a selection store or wraps cells itself.
// ---------------------------------------------------------------------------

/** Per-pane overrides the enclosing `PaneSelectionFrame` hands its leaf: the
 *  selection-derived viewport/settings sync group ids + which pane is the group
 *  anchor. `undefined` on a field means "no override" (the leaf falls back to
 *  the grid-wide static `viewportSyncGroupId`). Only populated while this pane
 *  is part of a ≥2 selection. Consumed by `LeafView` (image leaves) and
 *  `CompareView` (compare panes). */
interface PaneSyncCtx {
  viewportSyncGroupId?: string;
  settingsSyncGroupId?: string;
  syncIsAnchor?: boolean;
  /** The viewport's EFFECTIVE settings — the `group > local` merge from the ONE
   *  store hook per viewport (`useViewportSettings`, run by the context PROVIDER —
   *  `PaneSelectionFrame` / the enlarge `StageCell`). The provider is the single
   *  subscriber per viewport; every consumer (the pane's display props,
   *  `useCompareControl`'s mode/kernel/split, `LeafView`'s channel select) reads
   *  these top-down — no consumer subscribes to the bus itself. */
  syncedSettings?: ImageSyncSettings | null;
  /** The ONE write path into the viewport's settings store: merges a patch into
   *  the GROUP store while selected (transient — gone on unselect), else the
   *  LOCAL store (sticks). Threaded to the panes as a prop (the bundle split
   *  rules out context on the addon side). */
  setSyncedSettings?: (patch: ImageSyncSettings) => void;
  /** The viewport's stable settings-entry id (`vp-st-<paneId>`) — the id group
   *  memberships attach to. `LeafView` uses it to join the AUTHORED grid
   *  `sync.viewport` group (scoped to `view`). */
  localStoreId?: string;
}
export const PaneSyncContext = createContext<PaneSyncCtx | null>(null);

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
  const { source, shared, viewportSyncGroupId } = useSharedPlot();
  // Per-pane selection-derived sync overrides (undefined outside a ≥2 selection).
  const paneSync = useContext(PaneSyncContext);
  // AUTHORED grid sync (`shared.sync.viewport`): join this viewport's settings
  // entry to the grid-wide group, SCOPED to the `view` key — an authored grid
  // sync still links only transforms (today's semantics), while the selection
  // group (joined by PaneSelectionFrame, unscoped) fans everything. Image
  // zoom/pan rides the settings entry (`settings.view`) since NOSTACK.
  useJoinSettingsGroup(paneSync?.localStoreId, viewportSyncGroupId, VIEW_ONLY_KEYS);
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

  // CHANNEL-STRIP selection override (EXR part/layer). `null` = follow the
  // node's own `data.part`/`data.layer`. Resolves at RENDER through the one
  // lookup: store value > local state (the local cell serves only a viewport
  // with no store). Deliberately NOT reset on a node swap: in a STACKED
  // viewport the same LeafView instance flips between slots, and the picked
  // layer must carry across (shared-settings semantics).
  const [localChSel, setChSel] = useState<ChannelSelection | null>(null);
  const syncedChannelSelect = paneSync?.syncedSettings?.channelSelect;
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
    if (setSyncedRef.current) setSyncedRef.current({ channelSelect: next });
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
  const resolveKey = isDiff ? sourceKey(node) + "|diffpair" : sourceKey(node) + selKey;

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

  const diffFgData = diffSpec?.fgData;
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
    if (diffSpec && diffFgData) {
      void resolveCached(key, () => resolveDiffPair(node.data, diffFgData, source)).catch(() => {
        /* error is cached (peekResolveError) — the pure read surfaces it */
      });
      return () => {
        cancelled = true;
      };
    }
    void resolveCached(key, async () => {
      const dp = await resolveDataProps(effectiveData, source);
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
  }, [node, source, selKey, effectiveData, resolveKey, diffSpec, diffFgData]);

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
  const baseKey = isDiff ? sourceKey(node) + "|diffpair" : sourceKey(node);
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
      const vpg = paneSync?.viewportSyncGroupId ?? viewportSyncGroupId;
      if (vpg) dsync.viewportSyncGroupId = vpg;
      if (paneSync?.settingsSyncGroupId) dsync.settingsSyncGroupId = paneSync.settingsSyncGroupId;
      if (paneSync?.syncIsAnchor) dsync.syncIsAnchor = true;
      if (paneSync?.syncedSettings) dsync.syncedSettings = paneSync.syncedSettings;
      if (paneSync?.setSyncedSettings) dsync.setSyncedSettings = paneSync.setSyncedSettings;
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
        onCompareReset: diffSpec.onCompareReset,
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
    const vpGroup = paneSync?.viewportSyncGroupId ?? viewportSyncGroupId;
    if (vpGroup) sharedProps.viewportSyncGroupId = vpGroup;
    if (paneSync?.settingsSyncGroupId) {
      sharedProps.settingsSyncGroupId = paneSync.settingsSyncGroupId;
    }
    if (paneSync?.syncIsAnchor) sharedProps.syncIsAnchor = true;
    if (paneSync?.syncedSettings) sharedProps.syncedSettings = paneSync.syncedSettings;
    if (paneSync?.setSyncedSettings) sharedProps.setSyncedSettings = paneSync.setSyncedSettings;
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
  }, [dataProps, shared, viewportSyncGroupId, paneSync, node.props, chSel, selectChannels, node.data, diffSpec, inStackedGrid, enlargeControl]);

  // Wait-for-registration: re-render the instant the renderer arrives, else
  // surface a bounded "unknown renderer" error.
  const rendererMissing = status === "ready" && !getRenderer(node.renderer);
  useEffect(() => {
    if (status !== "ready" || getRenderer(node.renderer)) return;
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
  return Renderer ? (
    <Suspense fallback={<Message text="Loading renderer…" />}>
      <Renderer {...mergedProps} />
    </Suspense>
  ) : (
    <Message text="Loading renderer…" />
  );
}

// ---------------------------------------------------------------------------
// Compare — two DataSpec frames composited into one pane. Resolves each frame
// to a compare source (image → DataSource lookup or the `url` client-decode
// seam, url → verbatim), picks the reference by `baselineIndex`, and delegates
// to `CompositeMediaPane`. Wrapped in `ChartBox` so it fills a sized grid cell
// (fill) or gets a default height standalone.
//
// Resolution is ASYNC (like `LeafView`): a `url`-bearing `image` side is
// FETCHED + decoded (`decodeImage`), the SAME client-decode seam the image
// LEAF uses — u8 → a browser-decodable data URL (the texture path), float
// (`.exr`/float `.npy`) → a decoded `CompareFloatSource` the GPU pane uploads
// as `rgba32float`. A side that resolves to NEITHER a url nor a float payload
// surfaces the standard error state — never a silent blank pane (the bug this
// fixes: a compare node whose sides were `url`-only `image` specs resolved to
// null hashes and rendered nothing).
// ---------------------------------------------------------------------------
interface ResolvedCompareFrame {
  url: string | null;
  float?: CompareFloatSource;
  overlay?: ImageOverlayData;
}

async function resolveFrame(
  data: DataSpec,
  source: DataSource,
): Promise<ResolvedCompareFrame> {
  if (data.kind === "url") {
    // Resolve to the FINAL post-redirect URL so a live/redirecting query URL
    // keys the GPU diff cache (via this frame's `url`) on the content-addressed
    // digest, not the mutable request URL. Non-redirecting/`data:` URLs resolve
    // to themselves; a CORS-blocked fetch falls back to the raw URL.
    const url = await resolveFinalUrl(data.src);
    return { url, overlay: parseOverlay(data.metadata) ?? undefined };
  }
  if (data.kind === "image") {
    // Direct-URL CLIENT-DECODE seam — the compare mirror of the image LEAF's
    // `image.url` path (`plot-descriptor.ts`): fetch the bytes and normalize
    // through `decodeImage` (sniffed by Content-Type → URL ext → magic bytes).
    // Float buffers (`.exr`/float `.npy`) become a `CompareFloatSource` (the
    // GPU pane uploads them as `rgba32float`, diffing in true float values);
    // uint8/browser-native buffers become an `imageUrl` PNG data URL (the
    // existing texture path). CORS applies to the fetch.
    if (data.url) {
      // Shared decode-to-CompareFloatSource seam (viewport/data-sources.ts):
      // fetch (redirect-following, final url = content key), sniff, and route
      // float → a `CompareFloatSource` (`rgba*float`, true float diff) vs u8 →
      // a PNG `data:` URL (the texture path). NOTE: no `deepLiveFlatten` here —
      // the DEPTH slider is RESTRICTED to single-image panes for now, so a deep
      // EXR in Compare shows the FULL composite (Z ≤ zMax), same as before.
      const resolved = await decodeImageSource({ url: data.url });
      const overlay = parseOverlay(data.metadata) ?? undefined;
      return { url: resolved.url, float: resolved.float, overlay };
    }
    const res = resolveImageViewportItems(
      {
        hashes: [data.hash ?? null],
        referenceHashes: [data.referenceHash ?? null],
        metadata: [data.metadata ?? null],
      },
      source,
      parseOverlay,
    );
    const item = res.items[0] ?? null;
    return { url: item?.url ?? null, overlay: item?.overlay ?? undefined };
  }
  if (data.kind === "imghdr") {
    // True float-HDR side (`cp.Image(hdr_float)`): fetch the float `.npy` from
    // the store/endpoint and hand the GPU compare pane a `CompareFloatSource`
    // (uploaded as `rgba32float`), mirroring the `.exr`/float-`.npy` URL path
    // above. This is what makes `mode="flip"` auto-dispatch to HDR-FLIP on baked
    // HDR arrays. The store hash is the stable diff-cache content key. No `meta`
    // needed — shape/channels come from the npy header itself.
    if (!data.hash) return { url: null };
    // RUNTIME fast path (JS-authored compare): a float buffer registered by
    // `window.cairnPlot` rides by reference into the GPU compare pane, skipping
    // the `.npy` encode/parse. `f16-bits` (a `Uint16Array`) is expanded to
    // float32 for the `rgba32float` upload the compare pane takes.
    const rt = source.runtime?.(data.hash);
    if (rt && rt.kind === "float") {
      const height = rt.shape[0] ?? 0;
      const width = rt.shape[1] ?? 0;
      const channels = rt.shape.length >= 3 ? (rt.shape[2] ?? 1) : 1;
      if (!width || !height) return { url: null };
      return {
        url: null,
        // The SELF-DESCRIBING buffer keeps the runtime payload's representation
        // intact (f16 bits stay half through to the rgba16float upload).
        float: {
          pixels: floatPixelsFrom(
            rt.data instanceof Float32Array || rt.data instanceof Uint16Array
              ? rt.data
              : Float32Array.from(rt.data),
            rt.precision,
          ),
          width,
          height,
          channels,
          contentKey: data.hash,
        },
      };
    }
    const npy = parseNpy(await source.bytes(data.hash));
    const height = npy.shape[0] ?? 0;
    const width = npy.shape[1] ?? 0;
    const channels = npy.shape.length >= 3 ? (npy.shape[2] ?? 1) : 1;
    if (!width || !height) return { url: null };
    return {
      url: null,
      float: {
        pixels: floatValues(Float32Array.from(npy.data)),
        width,
        height,
        channels,
        contentKey: data.hash,
      },
    };
  }
  // `inline` frames have no image URL — compare needs images.
  return { url: null };
}

/** The compare view modes the client can switch between (the flat Python enum,
 *  minus the kernel short names which ride on `diff` via `diffKernel`). The
 *  `blend` mode was removed (user ruling); a legacy `blend` aliases to `split`
 *  on read (see `normalizeCompareViewMode`). */
type CompareViewMode = "split" | "diff";

// Back-compat: a legacy descriptor / synced patch may still carry the removed
// `"blend"` view mode. Alias it to `"split"` on read (never hard-fail an old
// baked report) and warn ONCE per session.
let warnedBlendRemoved = false;
function normalizeCompareViewMode(mode: string | undefined | null): CompareViewMode {
  if (mode === "blend") {
    if (!warnedBlendRemoved) {
      warnedBlendRemoved = true;
      // eslint-disable-next-line no-console
      console.warn("cairn-plot: the 'blend' compare mode was removed; rendering as 'split'.");
    }
    return "split";
  }
  return mode === "diff" ? "diff" : "split";
}

// ---------------------------------------------------------------------------
// DIFF ROUTING (content-op unification, Phase 2c Landing 2). A compare node in
// a DIFF mode lowers to the SAME `LeafView` → `image` renderer → `GpuImagePane`
// family an image leaf uses, with a resolved `compareSource` (b = foreground),
// so a `[image, diff]` stack is HOMOGENEOUS and flips are a source-swap (no
// remount, no flicker). slide/blend still route to `CompareView` (the one
// documented remaining remount). See {@link NodeDispatch}.
// ---------------------------------------------------------------------------

/** Convert a resolved compare frame into the unified dtype-tagged decoded
 *  source the image backend consumes (`float` → `FloatSource`, `url` →
 *  `Uint8Source`). Reuses the compare resolver for both operands so the diff
 *  decode is byte-identical to `GpuComparePane`'s. */
function frameToSource(f: ResolvedCompareFrame): DecodedSource | null {
  if (f.float) {
    const { pixels, width, height, channels } = f.float;
    // The SELF-DESCRIBING buffer travels whole — the representation can no
    // longer be dropped in transit (the 2^14 "compare exposure" bug class;
    // see image/pixel-buffer.ts).
    return {
      dtype: "float",
      pixels,
      shape: channels > 1 ? [height, width, channels] : [height, width],
    };
  }
  if (f.url != null) return { dtype: "uint8", url: f.url };
  return null;
}

/** Stable content-identity cache key for a resolved frame — a source URL or the
 *  float payload's content key, NOT the decoded bytes (survives remount). */
function frameContentKey(f: ResolvedCompareFrame, fallback: string): string {
  return f.float?.contentKey ?? f.url ?? fallback;
}

/** Resolve BOTH operands of a diff pair (reference = `refData`, foreground =
 *  `fgData`) and pack the decoded reference `source` + the foreground (`__diffB`)
 *  + content keys into the dataProps `LeafView` folds into a `compareSource`. ONE
 *  source of truth, shared by `LeafView`'s resolve effect AND the stacked PREFETCH
 *  (`GridView`), so a `[image, diff]` stack warms its `|diffpair` key on mount and
 *  the FIRST flip into the diff tab is a synchronous cache hit — the flip commit
 *  carries the full diff dataProps, so it is paint-atomic (no async hold, no
 *  outgoing-slot frame inside the incoming tab). SIGN convention: `source` =
 *  reference, `compareSource.b` = foreground (`diff = source − b`). */
async function resolveDiffPair(
  refData: DataSpec,
  fgData: DataSpec,
  source: DataSource,
): Promise<Record<string, unknown>> {
  const [refFrame, fgFrame] = await Promise.all([
    resolveFrame(refData, source),
    resolveFrame(fgData, source),
  ]);
  const refSource = frameToSource(refFrame);
  const bSource = frameToSource(fgFrame);
  if (!refSource) throw new Error("compare reference did not resolve to an image source");
  if (!bSource) throw new Error("compare foreground did not resolve to an image source");
  return {
    source: refSource,
    __diffB: bSource,
    __diffContentKeyA: frameContentKey(refFrame, "diff:a"),
    __diffContentKeyB: frameContentKey(fgFrame, "diff:b"),
    __diffOverlay: fgFrame.overlay,
  };
}

/** The LIVE compare settings + resolved foreground operand a compare node hands
 *  `LeafView` (Phase 3: EVERY mode — diff AND split — lowers here, so the
 *  whole compare family renders through the ONE unified pane). The reference
 *  operand IS the synthesized leaf's `node.data` (resolved through the leaf's own
 *  cache); this carries everything else. */
interface DiffLeafSpec {
  /** The foreground/comparison operand (`compareSource.b`). */
  fgData: DataSpec;
  /** The compare MODE (`diff` | `split`) — lifted state. Diff renders the
   *  scalar-error kernel; split renders the LIGHT slide compositor. */
  mode: CompareViewMode;
  /** The diff KERNEL (a menu token) — always a real kernel, seeds the pane's diff
   *  face even while `mode` is a compositor mode. */
  diffKernel: string;
  /** Authored colormap override (`"none"` follows the kernel default). */
  colormap: CompareSource["colormap"];
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
  /** HOME / double-click on the pane: restore the hoisted compare control (mode +
   *  kernel + split) to the descriptor. */
  onCompareReset: () => void;
  /** True when the hoisted compare control differs from the descriptor (HOME dot). */
  compareModified: boolean;
}

/** The synthesized image leaf + static per-side derivations for a compare node,
 *  memoized on the node OBJECT so its identity is STABLE across renders and
 *  stacked flips (a stable `sourceKey` ⇒ the resolve cache hits synchronously on
 *  flip-back — no "Loading…" flash). Only the LIVE diff settings (kernel/
 *  colormap/callbacks) are rebuilt per render in {@link NodeDispatch}. */
interface SynthDiffLeaf {
  leaf: PlotLeafNode;
  fgData: DataSpec;
  align?: CompareAlign;
  fit?: CompareFit;
  referenceLabel?: string;
  foregroundLabel?: string;
}
const synthDiffLeafCache = new WeakMap<CompareNode, SynthDiffLeaf>();
function synthDiffLeafOf(node: CompareNode): SynthDiffLeaf {
  let e = synthDiffLeafCache.get(node);
  if (!e) {
    const baseIdx = node.baselineIndex ?? 0;
    const refData = baseIdx === 0 ? node.a : node.b;
    const fgData = baseIdx === 0 ? node.b : node.a;
    const props = (node.props ?? {}) as Record<string, unknown>;
    const labelA = typeof props.labelA === "string" ? props.labelA : undefined;
    const labelB = typeof props.labelB === "string" ? props.labelB : undefined;
    const legacyLabel = typeof props.label === "string" ? props.label : undefined;
    const referenceLabel = baseIdx === 0 ? labelA : labelB;
    const foregroundLabel = (baseIdx === 0 ? labelB : labelA) ?? legacyLabel;
    const leafProps: Record<string, unknown> = {
      interpolation: (props.interpolation as string | undefined) ?? "auto",
      showAxes: (props.showAxes as boolean | undefined) ?? false,
    };
    if (props.toolbar !== undefined) leafProps.toolbar = props.toolbar;
    if (props.pixelValueNotation !== undefined) leafProps.pixelValueNotation = props.pixelValueNotation;
    if (props.processing !== undefined) leafProps.processing = props.processing;
    if (typeof props.height === "number") leafProps.height = props.height;
    const leaf: PlotLeafNode = { kind: "plot", renderer: "image", data: refData, props: leafProps };
    e = { leaf, fgData, align: node.align, fit: node.fit, referenceLabel, foregroundLabel };
    synthDiffLeafCache.set(node, e);
  }
  return e;
}

/** The lifted compare view-mode state a compare node's `NodeDispatch` owns and
 *  threads to the unified pane via `compareSource` — hoisted so it survives the
 *  mode-switch op-swap and the stacked flip (the reused-instance control state). */
interface CompareControl {
  viewMode: CompareViewMode;
  setViewMode: (m: CompareViewMode) => void;
  diffKernel: string;
  setDiffKernel: (id: string) => void;
  splitPos: number;
  setSplitPos: (p: number) => void;
  /** HOME / double-click: drop every override → the control follows the DESCRIPTOR
   *  again (mode + kernel + split). The pane's own HOME can't reach this
   *  hoisted state, so it calls this via `compareSource.onCompareReset`. */
  reset: () => void;
  /** True when any of mode/kernel/split differs from the descriptor. */
  modified: boolean;
}

// ---------------------------------------------------------------------------
// Grid — children in a CSS grid. `colWidths`/`rowHeights`: number → `Nfr`,
// string → verbatim CSS. When `rowHeights` is set, cells fill (`height:100%`)
// and `ChartFillContext` publishes `true` so chart leaves fill their cell. A
// single shared `Colorbar` renders beside the grid when `shared.colorbar`.
// ---------------------------------------------------------------------------
function trackList(
  sizes: Array<number | string> | undefined,
  fallbackCount: number,
): string {
  if (!sizes || sizes.length === 0) return `repeat(${fallbackCount}, 1fr)`;
  return sizes.map((s) => (typeof s === "number" ? `${s}fr` : s)).join(" ");
}

/** Beyond this pointer travel a press is treated as a DRAG (pan / compare-split),
 *  not a selection click. */
const SELECTION_CLICK_SLOP_PX = 5;

/**
 * Wraps ONE pane (standalone mount OR grid cell — `PlotNodeView` puts one around
 * every leaf/compare node) with PAGE-WIDE selection behaviour: it draws the
 * accent ring on the selected pane, turns a stationary click into a mutation on
 * the ONE document-scoped `SelectionStore` (plain = replace, shift/ctrl/meta =
 * toggle), and provides the per-pane sync overrides its leaf consumes while ≥2
 * panes are selected. A `selectable={false}` frame (a nested grid) ignores
 * clicks and never rings — it stays only as the layout wrapper (`minWidth:0`).
 *
 * The pane id is process-unique (`nextSelectionPaneId`, NOT `useId` — which
 * collides across the gallery's separate React roots) and memoized so it is
 * stable across re-renders; it is removed from the selection on unmount so an
 * unmounted pane can't linger as a phantom group member.
 *
 * Click detection reads pointer events in the CAPTURE phase (so it still sees
 * them while the inner pane pointer-captures for a pan) but never
 * preventDefault/stopPropagation — so drag-to-pan, wheel/pinch zoom and compare
 * drag-to-split are untouched; only a near-stationary press (< slop) selects.
 * A press that STARTS on a toolbar control drives the control, never selects.
 */
function PaneSelectionFrame({
  selectable,
  node,
  children,
}: {
  selectable: boolean;
  /** The pane's descriptor node — registered so the page-level selection stage
   *  can rebuild this pane (as an enlarge grid cell or a compare operand). */
  node: PlotNode;
  children: React.ReactNode;
}) {
  // ONE page-wide store shared by every frame on the page (across all mounts).
  const store = getGlobalSelectionStore();
  // The shared source/shared block this pane resolves against — captured into
  // the registry so the stage can render a FRESH leaf under the same context.
  const { source, shared } = useSharedPlot();
  // A process-unique, render-stable id for this pane instance.
  const [paneId] = useState(nextSelectionPaneId);
  // The frame's own element — the theme ORIGIN the body-portaled stage/action
  // bar copies tokens from (it stays in the page's theme scope).
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Grid cells fill their track (rowHeights → height:100%); standalone panes
  // don't. `ChartFillContext` (set by the enclosing `GridView`) tells us which.
  const fill = useContext(ChartFillContext);
  // In a `cp.Grid` an image-compatible cell (an image LEAF *or* a `compare`
  // pane) is sized to the grid's ONE uniform aspect (auto rows) so every viewport
  // in a row is identical AND the pane fills the cell — making THIS selectable
  // frame the viewport, so the ring matches it exactly. In fill mode the fixed
  // row already sizes the cell. Non-image cells (scalars, nested grids) keep
  // their natural sizing. A `compare` cell fills the SAME aspect box: its
  // `GpuComparePane` is a single object-contain viewport (`ImagePaneShell`),
  // whose toolbar + metrics are ABSOLUTE overlays — so the box carries only the
  // content, exactly like an image pane. `CompareView` fills the box via a
  // `GridCellReporter` (mirroring `ImageStandalone`), which also reports the
  // compare's content aspect up so the grid's median covers both cell types.
  const gridUniform = useContext(GridUniformAspectContext);
  const uniformImageCell =
    !!gridUniform && !fill && isImageCompatibleNode(node);
  // The pane-sync context from an ENCLOSING provider (e.g. the fullscreen stage
  // or a STACKED grid, which give their cells a shared settings-sync group). A
  // frame must PASS THIS THROUGH whenever it has no active selection group of its
  // own — for a `selectable={false}` frame OR a selectable one that isn't part of
  // a live ≥2 selection — else the enclosing group id never reaches the fresh
  // leaf/compare it wraps (Bug 3 + stacked-grid settings sync). An active
  // selection's own groups (`paneSync`) take precedence when present.
  const inheritedPaneSync = useContext(PaneSyncContext);

  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  // Track the COMBINED snapshot ({selected, reference}) — the reference drives
  // the distinct ORANGE ring on the reference pane (Bug 2), and a reference-only
  // change keeps `selected` array-stable, so subscribing to `getSelected()` alone
  // would miss it.
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const selected = snapshot.selected;

  // Register this pane's render descriptor for the page-level stage, and keep it
  // current as the node/source change. Unregister on unmount so the stage never
  // rebuilds a gone pane.
  useEffect(() => {
    if (!selectable) return;
    registerSelectionPane({
      paneId,
      node,
      source,
      shared,
      imageCompatible: isImageCompatibleNode(node),
      getElement: () => frameRef.current,
    });
    return () => unregisterSelectionPane(paneId);
  }, [paneId, selectable, node, source, shared]);

  // Drop this pane from the selection when it unmounts (lazy-scroll teardown, a
  // grid remount, …) so a stale id never keeps a phantom member in a sync group.
  useEffect(() => {
    if (!selectable) return;
    return () => store.remove(paneId);
  }, [store, paneId, selectable]);

  // ENLARGE-INTERCEPT: while this pane is one of ≥2 selected, its enlarge button
  // opens the page-level ENLARGE stage (a grid of ALL selected panes) instead of
  // the single-pane overlay. An UNselected pane (or a lone selection) falls
  // through to today's single-pane enlarge. Decoupled from the stage — this only
  // pokes the store's stage channel, which the overlay host listens on.
  const enlargeIntercept = useMemo<EnlargeIntercept>(
    () => ({
      onEnlarge() {
        if (selectable && store.count() >= 2 && store.isSelected(paneId)) {
          store.requestStage("enlarge");
          return true;
        }
        return false;
      },
    }),
    [store, paneId, selectable],
  );

  const isSelected = selectable && selected.includes(paneId);
  // The REFERENCE among a ≥2 selection reads with a DISTINCT orange ring (Bug 2)
  // — the pane every comparison is taken against. Only meaningful once a pair is
  // selected; a lone selection is just a highlight, not a reference.
  const isReference =
    isSelected && selected.length >= 2 && snapshot.reference === paneId;
  // Sync groups (null unless this pane is one of ≥2 selected) — the shared
  // derivation `paneSyncGroups` against the ONE page-wide base is the same one
  // the integration test asserts on.
  const groups =
    selectable ? paneSyncGroups(store, paneId, GLOBAL_SELECTION_BASE) : null;

  // The ONE settings entry per viewport (NOSTACK — see
  // use-synced-image-settings.ts for the contract): a flat entry keyed by the
  // pane's stable id. While this pane is one of >=2 selected it JOINS the
  // per-episode selection group — edits on any member fan out into every
  // member's own entry, PERSISTENTLY (leaving the selection changes nothing).
  // `settings`/`set` are handed DOWN via context/props; nothing below
  // subscribes to the registry.
  const vst = useViewportSettings(
    `vp-st-${paneId}`,
    groups?.settingsGroupId ? [{ id: groups.settingsGroupId }] : undefined,
  );

  const downRef = useRef<{ x: number; y: number; onControl: boolean } | null>(null);
  const onPointerDownCapture = useCallback((e: React.PointerEvent) => {
    // A press that STARTS on an interactive control (toolbar button, slider,
    // menu item, link) drives that control — never a selection. Recorded at
    // down so a control click is excluded even if the pointer drifts a little.
    const onControl = !!(e.target as Element | null)?.closest?.(
      'button, input, select, textarea, a, [role="menu"], [role="menuitem"], [contenteditable="true"]',
    );
    downRef.current = { x: e.clientX, y: e.clientY, onControl };
  }, []);
  const onPointerUpCapture = useCallback(
    (e: React.PointerEvent) => {
      const d = downRef.current;
      downRef.current = null;
      if (!d || d.onControl) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > SELECTION_CLICK_SLOP_PX) return;
      const mode: SelectionMode = e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace";
      store.select(paneId, mode);
    },
    [store, paneId],
  );

  const style: React.CSSProperties = {
    minWidth: 0,
    position: "relative",
    ...(fill ? { height: "100%" } : null),
    // Uniform image cell (auto rows): a definite width-driven box at the grid's
    // ONE aspect, so all cells in a row are identical and the pane fills it. A
    // `DEFAULT_GRID_CELL_ASPECT` fallback gives a definite box before any cell has
    // reported (avoids a 0-height mount). `alignSelf:start` keeps it from being
    // stretched by a taller non-image sibling in the same row. The cell FILLS its
    // column (no maxWidth here) so figures sit edge-to-edge with no gaps between
    // them; the page-HEIGHT cap is applied to the grid CONTAINER width in
    // `GridView` (which narrows the whole cluster and centres it), so a tall grid
    // image stays viewable in one screenful without leaving space between figures.
    ...(uniformImageCell
      ? {
          width: "100%",
          aspectRatio: String(gridUniform!.uniformAspect ?? DEFAULT_GRID_CELL_ASPECT),
          alignSelf: "start",
        }
      : null),
  };
  if (isSelected) {
    // A CLEARLY VISIBLE selection ring: a full-opacity outline plus a soft glow so
    // it reads over busy image/3D content (a 1px 50%-opacity border — the 3D
    // canvas's decorative chrome — is far too faint to serve as a selection
    // indicator; that made selection look absent). Every selected pane (2D and 3D)
    // uses THIS shared ring, so the look is consistent everywhere. `outline` +
    // negative offset never shifts layout. Raise the selected cell (`z-index`) so
    // its ring paints ABOVE later grid siblings (never occluded).
    //
    // The REFERENCE pane (the compare baseline) rings in a DISTINCT ORANGE
    // (`REFERENCE_COLOR`); every other selected pane rings in the blue
    // `--color-accent`. Two visually separable states so the reference is obvious.
    if (isReference) {
      style.outline = `2px solid ${REFERENCE_COLOR}`;
      style.boxShadow = `0 0 0 1px ${REFERENCE_COLOR}, 0 0 8px 1px rgb(${REFERENCE_COLOR_RGB} / 0.5)`;
    } else {
      style.outline = "2px solid var(--color-accent)";
      style.boxShadow =
        "0 0 0 1px var(--color-accent), 0 0 8px 1px rgb(var(--color-accent-rgb) / 0.45)";
    }
    style.outlineOffset = "-2px";
    style.borderRadius = "4px";
    style.zIndex = 1;
  }

  // Provider precedence: own-selection ctx > inherited ctx (an enclosing stage/
  // overlay group must keep reaching a fresh unselected leaf — Bug 3) > the
  // pane's LOCAL-store ctx (a lone viewport still has its group-of-one store, so
  // its picks persist and survive re-lowers).
  const paneSync = useMemo<PaneSyncCtx | null>(
    () =>
      groups
        ? {
            viewportSyncGroupId: groups.viewportGroupId,
            settingsSyncGroupId: groups.settingsGroupId,
            syncIsAnchor: groups.isAnchor,
            syncedSettings: vst.settings,
            setSyncedSettings: vst.set,
            localStoreId: `vp-st-${paneId}`,
          }
        : null,
    [groups?.viewportGroupId, groups?.settingsGroupId, groups?.isAnchor, vst.settings, vst.set, paneId],
  );
  const localSync = useMemo<PaneSyncCtx | null>(
    () =>
      selectable
        ? {
            syncedSettings: vst.settings,
            setSyncedSettings: vst.set,
            localStoreId: `vp-st-${paneId}`,
          }
        : null,
    [selectable, vst.settings, vst.set, paneId],
  );

  return (
    <div
      ref={frameRef}
      style={style}
      data-plot-pane-id={paneId}
      data-selectable={selectable ? "true" : "false"}
      data-selected={isSelected ? "true" : undefined}
      data-reference={isReference ? "true" : undefined}
      onPointerDownCapture={selectable ? onPointerDownCapture : undefined}
      onPointerUpCapture={selectable ? onPointerUpCapture : undefined}
    >
      <PaneSyncContext.Provider value={paneSync ?? inheritedPaneSync ?? localSync}>
        <EnlargeInterceptContext.Provider value={enlargeIntercept}>
          {children}
        </EnlargeInterceptContext.Provider>
      </PaneSyncContext.Provider>
    </div>
  );
}

/** The renderer identity of a grid child — a HOMOGENEOUS stacked viewport shows
 *  the ACTIVE child through ONE reused renderer (source-swap), which only works
 *  when every child lowers to the same component. Phase 3: a compare node in ANY
 *  mode (diff AND split/blend) lowers to the SAME `image` leaf family (`LeafView`
 *  + `GpuImagePane` with `compareSource`), so EVERY image-compatible child shares
 *  the image leaf's key — `[image, diff]`, `[image, split]`, `[diff, blend]` …
 *  are all homogeneous and flip with no remount/flicker (the last cross-kind
 *  remount — the 341c577 `mixedImageStack` mount-swap — is retired). */
function stackKindKey(node: PlotNode): string {
  if (node.kind === "plot") return `plot:${node.renderer}`;
  if (node.kind === "compare") return "plot:image";
  return node.kind; // "grid", …
}
function homogeneousStack(children: PlotNode[]): boolean {
  if (children.length < 2) return false;
  const k0 = stackKindKey(children[0]!);
  return children.every((c) => stackKindKey(c) === k0);
}

function GridView({ node }: { node: GridNode }) {
  const { source, shared: parentShared } = useSharedPlot();
  // Image viewport sync (`shared.sync.viewport`, SharedProps in
  // plot-descriptor.ts) — mirrors `lib/camera-sync.ts`'s `useCameraSync`: a
  // stable id (`useId()`) scoped to THIS grid instance, so a grid's own image
  // leaves mirror each other's zoom/pan, but two different (sibling or
  // nested) synced grids never share a group by default. Called
  // unconditionally (rules-of-hooks) but only consulted when this node
  // actually declares its own `shared.sync.viewport` below.
  const localId = useId();
  const children = node.children ?? [];
  const cols = node.cols ?? node.colWidths?.length ?? children.length ?? 1;
  const fill = !!node.rowHeights && node.rowHeights.length > 0;

  // UNIFORM image-cell sizing via the ONE shared mechanism (also used by the
  // compare/enlarge stage): image cells report their content aspect, the grid
  // picks the REPRESENTATIVE (median) aspect, and every image cell sizes to it —
  // so viewports in a row are identical (and the selection ring, drawn on the
  // cell, matches the pane exactly).
  const gridAspectApi = useUniformGridAspect();

  // VIEW MODE: `normal` (uniform CSS grid) vs `stacked` (one child at a time +
  // a keyboard-driven tab strip). Seeded from `node.mode`; a live toggle flips
  // it. Stacking is offered for a HOMOGENEOUS ≥2 grid — Phase 3 makes EVERY
  // image-compatible grid (image leaves + compare panes, any mode) homogeneous
  // (all key `plot:image`), so the active child ALWAYS shows through ONE reused
  // renderer (source-swap fast path — no mount-swap, no sync groups). Non-image
  // mixes (a chart next to an image, a nested grid) still aren't stackable (the
  // ▭ toggle is hidden).
  const canStack = homogeneousStack(children);
  const [mode, setMode] = useState<"normal" | "stacked">(node.mode === "stacked" ? "stacked" : "normal");
  const [active, setActive] = useState(0);
  const effectiveMode = canStack ? mode : "normal";
  const clampedActive = Math.min(active, Math.max(0, children.length - 1));
  const stackRootRef = useRef<HTMLDivElement | null>(null);

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: trackList(node.colWidths, Math.max(cols, 1)),
    width: "100%",
  };
  if (fill) gridStyle.gridTemplateRows = trackList(node.rowHeights, 1);
  const gapPx = typeof node.gap === "number" ? node.gap : 0;
  if (node.gap != null) {
    gridStyle.gap = typeof node.gap === "number" ? `${node.gap}px` : node.gap;
  }
  // PAGE-HEIGHT CAP for a grid of TALL images: cap the grid CONTAINER width so its
  // `1fr` columns never exceed the per-column width whose aspect-derived height
  // would exceed the window — then the cells (which FILL their columns) stay ≤ one
  // page tall. Capping the container (not the cells) keeps figures edge-to-edge
  // with no gaps between them; the leftover space becomes ONE centred outer margin
  // (`marginInline:auto`). Wide/short grids: the cap is larger than the container,
  // so it never binds. `vh` tracks window resizes with no JS. Auto rows only.
  if (!fill && gridAspectApi.uniformAspect != null && gridAspectApi.uniformAspect > 0) {
    const c = Math.max(cols, 1);
    gridStyle.maxWidth = `calc(${c} * (100vh - ${VIEWPORT_HEIGHT_MARGIN}px) * ${gridAspectApi.uniformAspect} + ${(c - 1) * gapPx}px)`;
    gridStyle.marginInline = "auto";
  }

  // A grid re-seeds the shared context for its subtree (its own `shared` wins,
  // falling back to the parent's for nesting).
  const shared = node.shared ?? parentShared;

  // The group id is derived fresh from THIS node's own `shared.sync.viewport`
  // (never inherited from a parent grid — same "no accidental cross-grid
  // link" scoping `useCameraSync` documents) and only when this node actually
  // re-seeds the context below (`node.shared && node.shared !== parentShared`).
  const viewportSyncGroupId = node.shared?.sync?.viewport ? `plot-grid-viewport-${localId}` : null;

  // GridView is LAYOUT ONLY — selection lives page-wide in each child's own
  // `PaneSelectionFrame` (wrapped by `PlotNodeView`), obtained from the ONE
  // document-scoped store. `ChartFillContext` still tells fill-mode children
  // (and their frames) to take `height:100%`.
  //
  // NORMAL mode: every child rendered side by side.
  const panes = children.map((child, i) => <PlotNodeView key={i} node={child} />);

  // STACKED mode: render ONLY the active child, through ONE reused renderer
  // instance (stable tree position → React reuses it; flipping the active child
  // only SWAPS its source, resolved from the `resolve-cache` → instant, no
  // remount, no `display:none` park/restore, no blank). Because it's one
  // instance, display settings + camera are shared BY CONSTRUCTION — no
  // settings-sync bus, no anchor. `InStackedGridContext` marks the subtree so a
  // compare child routes its slide-flip to the dedicated `[`/`]` keys (arrows
  // drive the tabs). Content-aspect capped at one page tall like a 1-cell grid;
  // `fill` (the stage) takes 100%.
  //
  // The viewport BOX is LATCHED for the life of stacked mode: with only the
  // ACTIVE slot mounted, it is the grid's ONLY aspect reporter, so the live
  // "representative" aspect would just track whichever image is active — the
  // canvas would RESIZE on every flip (and the shared zoom would read
  // differently against each box). One viewport = ONE fixed surface: freeze the
  // first established aspect and let a differently-shaped slot letterbox WITHIN
  // it. Normal mode clears the latch (the live median over all cells is correct
  // there); re-entering stacked re-latches the then-current representative.
  const stackAspectRef = useRef<number | null>(null);
  if (effectiveMode === "stacked") {
    if (stackAspectRef.current == null && gridAspectApi.uniformAspect != null) {
      stackAspectRef.current = gridAspectApi.uniformAspect;
    }
  } else {
    stackAspectRef.current = null;
  }
  const stackAspect = stackAspectRef.current ?? gridAspectApi.uniformAspect;
  // The frozen context the stacked subtree sizes against: same reporter (the
  // active slot still reports, establishing the latch on first mount), but a
  // LATCHED `uniformAspect` so the cell's `aspect-ratio` box never follows a
  // flip.
  const stackedAspectApi = useMemo<typeof gridAspectApi>(
    () => ({ ...gridAspectApi, uniformAspect: stackAspect }),
    [gridAspectApi, stackAspect],
  );
  const stackedViewStyle: React.CSSProperties = fill
    ? { width: "100%", height: "100%" }
    : stackAspect != null && stackAspect > 0
      ? {
          maxWidth: `calc((100vh - ${VIEWPORT_HEIGHT_MARGIN}px) * ${stackAspect})`,
          marginInline: "auto",
        }
      : {};
  // Phase 3: EVERY stackable grid is now HOMOGENEOUS (image leaves + compare
  // panes all key `plot:image`), so the active child ALWAYS shows through ONE
  // reused renderer instance — zoom/pan + display settings + compare mode are
  // shared BY CONSTRUCTION, no sync-group + PaneSyncContext plumbing needed (the
  // 341c577 mixed-stack mount-swap machinery is retired).
  const activeChild = children[clampedActive];
  const stackedPane = activeChild ? (
    <InStackedGridContext.Provider value={true}>
      <GridUniformAspectContext.Provider value={stackedAspectApi}>
        <div
          data-cairn-stacked-view=""
          data-cairn-stack-active={clampedActive}
          style={{ minWidth: 0, minHeight: 0, ...(fill ? { height: "100%" } : null), ...stackedViewStyle }}
        >
          <div
            data-cairn-stacked-pane="active"
            style={{ minWidth: 0, ...(fill ? { height: "100%" } : null) }}
          >
            <PlotNodeView node={activeChild} />
          </div>
        </div>
      </GridUniformAspectContext.Provider>
    </InStackedGridContext.Provider>
  ) : null;
  // Keyboard tab-flip attaches to the WHOLE grid area (header + pane) so keys
  // work while hovering anywhere over the grid (only in stacked mode).
  useStackKeyboard(stackRootRef, effectiveMode === "stacked", clampedActive, children.length, setActive);

  // PREFETCH: warm every stacked child's data in the background so the FIRST flip
  // to a tab is already resolved (no wait). Plot leaves only — compare children
  // resolve on first visit and cache thereafter (still flash-free via the cache).
  useEffect(() => {
    if (effectiveMode !== "stacked") return;
    const entries: Array<{ key: string; run: () => Promise<unknown> }> = [];
    for (const c of children) {
      if (c.kind === "plot") {
        entries.push({ key: sourceKey(c), run: () => resolveDataProps(c.data, source) });
      } else if (c.kind === "compare") {
        // Warm the DIFF PAIR under the SAME `|diffpair` key `LeafView` resolves it
        // by (the memoized synth leaf's `sourceKey` — stable across renders/flips),
        // so a first flip into the diff tab is a synchronous cache hit and the flip
        // commit is paint-atomic, not a cold async resolve that holds the outgoing
        // slot for a frame. Previously compare children were skipped, so EVERY first
        // diff flip hit the async hold path — a prime source of the reported flash.
        const synth = synthDiffLeafOf(c);
        entries.push({
          key: sourceKey(synth.leaf) + "|diffpair",
          run: () => resolveDiffPair(synth.leaf.data, synth.fgData, source),
        });
      }
    }
    prefetchResolved(entries);
  }, [effectiveMode, children, source]);
  const grid = (
    <ChartFillContext.Provider value={fill}>
      <GridUniformAspectContext.Provider value={gridAspectApi}>
        <div
          ref={stackRootRef}
          data-cairn-grid-root=""
          className={canStack ? "group" : undefined}
          style={{ minWidth: 0, width: "100%" }}
        >
          {/* A thin HEADER above the viewports (never overlaps pane controls):
              the mode toggle, plus the tab strip in stacked mode. */}
          {canStack && (
            <div data-cairn-grid-header="" className="mb-1 flex items-center gap-2" style={{ minHeight: 26 }}>
              {effectiveMode === "stacked" ? (
                <StackTabStrip
                  labels={children.map((c, i) => stackLabelFor(c, i))}
                  active={clampedActive}
                  onSelect={setActive}
                />
              ) : (
                <div className="flex-1" />
              )}
              <GridModeToggle mode={effectiveMode} onChange={setMode} />
            </div>
          )}
          {effectiveMode === "stacked" ? stackedPane : <div style={gridStyle}>{panes}</div>}
        </div>
      </GridUniformAspectContext.Provider>
    </ChartFillContext.Provider>
  );

  const body =
    node.shared && node.shared !== parentShared ? (
      <SharedPlotContext.Provider value={{ source, shared, viewportSyncGroupId }}>
        {grid}
      </SharedPlotContext.Provider>
    ) : (
      grid
    );

  // F1: gate the colorbar on the node's OWN `shared.colorbar` (owner-only). A
  // nested grid that merely INHERITS `colorbar:true` (via `shared` above, used
  // for leaf colormap/colorRange) must NOT draw a second colorbar — only the
  // grid that actually declares `colorbar` renders one.
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
 * The lifted compare view-mode state (Phase 2c). Held HERE — inside the pane's
 * `PaneSelectionFrame`, so it can read the pane's own sync identity — and called
 * UNCONDITIONALLY for every node (inert for non-compare, rules-of-hooks safe),
 * so a stacked `NodeDispatch` reused across an image↔diff flip keeps ONE mode
 * state that survives the flip. The mode/kernel/split are seeded from the
 * descriptor and updated from two sources: the panes' menu callbacks
 * (`setViewMode`/…) AND the group's `syncedSettings` handed down from the ONE
 * node-level bus receiver (`PaneSelectionFrame`/stage) — so mode still syncs
 * across a page-wide selection even when the mounted pane is a DIFF `GpuImagePane`
 * (which can't itself apply a `compareMode` patch — that's a routing decision
 * above the pane). Never PUBLISHES (the panes already publish these keys) and
 * NEVER subscribes to the bus (the receiver is the single subscriber). Absent a
 * group (a homogeneous stack) `syncedSettings` is null and the ONE reused instance
 * shares settings by construction.
 */
function useCompareControl(
  node: PlotNode,
  syncedSettings: ImageSyncSettings | null | undefined,
  setSettings?: (patch: ImageSyncSettings) => void,
): CompareControl {
  const cmp = node.kind === "compare" ? node : null;
  const props = (cmp?.props ?? {}) as Record<string, unknown>;
  // `normalizeCompareViewMode` folds the removed `"blend"` (and legacy `"side"`)
  // into `"split"` so an old baked descriptor still lowers.
  const descriptorMode: CompareViewMode = cmp
    ? normalizeCompareViewMode(cmp.mode as string)
    : "split";
  const descriptorKernel =
    (props.diffSubmode as string | undefined) ?? (cmp?.diffSubmode as string | undefined) ?? "absolute";
  const descriptorSplit = (props.splitPosition as number | undefined) ?? 0.5;

  // Overrides (null ⇒ follow the descriptor) — the STORELESS fallback only.
  const [viewModeOverride, setViewModeOverride] = useState<CompareViewMode | null>(null);
  const [kernelOverride, setKernelOverride] = useState<string | null>(null);
  const [splitOverride, setSplitOverride] = useState<number | null>(null);
  // TOP-OF-STACK writes (transient-group ruling): with a settings store the
  // panes PUBLISH every mode/kernel/split change and the store derives back
  // down, so the local overrides must NOT also be written — a group-session
  // change would survive unselect through them. They serve only a storeless
  // control (no `setSettings` threaded).
  const hasStore = !!setSettings;
  const setViewMode = useCallback(
    (m: CompareViewMode) => {
      if (!hasStore) setViewModeOverride(m);
    },
    [hasStore],
  );
  const setDiffKernel = useCallback(
    (k: string) => {
      if (!hasStore) setKernelOverride(k);
    },
    [hasStore],
  );
  const setSplitPos = useCallback(
    (p: number) => {
      if (!hasStore) setSplitOverride(p);
    },
    [hasStore],
  );

  // ONE precedence, derived every render (no adoption effects): settings store >
  // local override > descriptor. Every change publishes to the store (the panes
  // publish mode/kernel/split; HOME publishes the descriptor defaults), so the
  // store is the single source of truth and simply propagates down.
  const syncMode = syncedSettings?.compareMode;
  const syncKernel = syncedSettings?.diffKernel;
  const syncSplit = syncedSettings?.splitPosition;
  const viewMode =
    syncMode !== undefined
      ? normalizeCompareViewMode(syncMode)
      : (viewModeOverride ?? descriptorMode);
  const diffKernel = syncKernel !== undefined ? syncKernel : (kernelOverride ?? descriptorKernel);
  const splitPos = syncSplit !== undefined ? syncSplit : (splitOverride ?? descriptorSplit);

  // HOME / double-click: drop every override so the control follows the DESCRIPTOR
  // again. This is the compare half of the pane's HOME the old `GpuComparePane` did
  // in-pane (`setCompareMode(compareModeMeta.default)` …); hoisting the mode out of
  // the pane moved it out of the pane HOME's reach, so the pane routes HOME back
  // here via `compareSource.onCompareReset`.
  const reset = useCallback(() => {
    setViewModeOverride(null);
    setKernelOverride(null);
    setSplitOverride(null);
    // HOME is a STORE write (a lone viewport is a group of one): set the
    // DESCRIPTOR defaults by value — local store + group store — so every synced
    // member resets with the clicked viewport and the reset values persist.
    setSettings?.({
      compareMode: descriptorMode,
      diffKernel: descriptorKernel,
      splitPosition: descriptorSplit,
    });
  }, [setSettings, descriptorMode, descriptorKernel, descriptorSplit]);
  const modified =
    viewMode !== descriptorMode || diffKernel !== descriptorKernel || splitPos !== descriptorSplit;

  return {
    viewMode,
    setViewMode,
    diffKernel,
    setDiffKernel,
    splitPos,
    setSplitPos,
    reset,
    modified,
  };
}

/**
 * Dispatch on `node.kind`, INSIDE the pane's `PaneSelectionFrame` (so it can read
 * the pane's sync identity). Phase 3: a compare node in ANY mode (diff AND
 * split/blend) lowers to `LeafView` with a synthesized image leaf + a resolved
 * `compareSource` — the SAME component an image plot leaf renders — so every
 * image-compatible stack is homogeneous and a mode switch / stacked flip is a
 * source-swap on the reused pane (NO remount, no `CompositeMediaPane`/
 * `GpuComparePane`, no flicker). The `mode`/`splitPosition`/`blendAlpha` ride the
 * `compareSource`; the pane's MODE menu lifts changes back through the callbacks.
 */
function NodeDispatch({ node }: { node: PlotNode }) {
  const { shared } = useSharedPlot();
  const paneSync = useContext(PaneSyncContext);
  // In a stacked grid / fullscreen overlay — read on the CORE side (the addon
  // bundle's context identity differs) and threaded to the pane so
  // `useSplitFlipKeys` scopes its arrow aliases correctly.
  const inStackedGrid = useContext(InStackedGridContext);
  const inOverlay = useContext(InFullscreenOverlayContext);
  // The mode hook runs for EVERY node (rules-of-hooks); inert for non-compare.
  const control = useCompareControl(node, paneSync?.syncedSettings, paneSync?.setSyncedSettings);
  // Static synth-leaf derivation (memoized on the node object) — only meaningful
  // for a compare node; computed unconditionally to keep hook order stable.
  const synth = node.kind === "compare" ? synthDiffLeafOf(node) : null;

  switch (node.kind) {
    case "grid":
      // Grids are cheap layout — only their leaf/compare descendants gate.
      return <GridView node={node} />;
    case "plot":
      return (
        <LazyGate reservedHeight={reservedHeightOf(node.props)}>
          <LeafView node={node} />
        </LazyGate>
      );
    case "compare": {
      if (!synth) return <Message text="invalid compare node" error />;
      const diffSpec: DiffLeafSpec = {
        fgData: synth.fgData,
        mode: control.viewMode,
        diffKernel: control.diffKernel,
        colormap:
          ((node.props?.colormap as CompareSource["colormap"]) ??
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
        onCompareReset: control.reset,
        compareModified: control.modified,
      };
      return (
        <LazyGate reservedHeight={reservedHeightOf(node.props)}>
          <LeafView node={synth.leaf} diffSpec={diffSpec} />
        </LazyGate>
      );
    }
    default:
      return <Message text={`unknown node kind "${(node as PlotNode).kind}"`} error />;
  }
}

/**
 * Render one node. Every node is wrapped in the SAME `PaneSelectionFrame`
 * (page-wide selection), so a standalone mount, a grid cell, an image, a compare
 * and a chart all get selection from ONE mechanism. A `plot`/`compare` is
 * selectable unless it opts out (`props.selectable:false`); a `grid` is never
 * selectable (layout only) but keeps a non-selectable frame so a nested grid
 * still gets the `minWidth:0` grid-item wrapper it had before. The kind + mode
 * DISPATCH lives in {@link NodeDispatch}, one level INSIDE the frame, so the
 * lifted compare-mode state can read the pane's sync identity and the dispatch
 * collapses (image plot AND diff compare both render `LeafView` at the stacked
 * slot — the no-remount flicker fix).
 */
export function PlotNodeView({ node }: { node: PlotNode }) {
  const selectable =
    node.kind !== "grid" && (node.props?.selectable as boolean | undefined) !== false;
  return (
    <PaneSelectionFrame selectable={selectable} node={node}>
      <NodeDispatch node={node} />
    </PaneSelectionFrame>
  );
}
