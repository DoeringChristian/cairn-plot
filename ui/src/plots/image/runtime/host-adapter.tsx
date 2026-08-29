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
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CompareNode, PlotLeafNode } from "../../../resources/resolve-data.ts";
import FullscreenOverlayShell from "../../../primitives/components/FullscreenOverlayShell.tsx";
import {
  resolutionKey,
  acquireResolved,
  peekResolved,
  peekResolveError,
  resolveCached,
  subscribeResolveCache,
  resolveCacheVersion,
} from "../../../resources/resolution-cache.ts";
import {
  treeHasSelectableChannels,
  type ChannelMenuTree,
  type ChannelSelection,
} from "../components/channel-menu.ts";
import { applyChannelSlice } from "../resources/channel-slice.ts";
import type { PlotSettings } from "../../../settings/schema.ts";
import { defaultSettingsForNode } from "../../settings.ts";
import { CellSettingsContext, useSharedPlot } from "../../../host/plot-context.ts";
import { ReactBackendOutlet } from "../../../host/react-backend.ts";
import { withoutSettingsPlumbing } from "../../../host/presentation.ts";
import {
  getReactPlotType,
  onRegisterReactPlotType,
} from "../../react-registry.ts";
import type { RenderEnvironment } from "../../../backends/contracts.ts";
import {
  planRegisteredImageComparison,
  resolveRegisteredImageComparison,
} from "../runtime/comparison-plan.ts";
import {
  composeImageComparisonPresentation,
  composeSingleImagePresentation,
  type ImageComparisonHostInput,
} from "../runtime/host-presentation.ts";
import { ImageHostRuntimeContext } from "./host-context.ts";

/**
 * How long an image host waits for a not-yet-registered backend (an addon
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

// TEST-ONLY no-flash instrumentation. `ImageLeafView` reads its resolved value straight
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
// the registered backend. Authored display state is already in the cell's
// settings; presentation props remain non-interactive rendering inputs.
// ---------------------------------------------------------------------------
export function ImageHostAdapter({
  node,
  comparison,
}: {
  node: PlotLeafNode;
  comparison?: ImageComparisonHostInput;
}) {
  const diffSpec = comparison;
  const { source, shared } = useSharedPlot();
  // Per-pane selection-derived sync overrides (undefined outside a ≥2 selection).
  const paneSync = useContext(CellSettingsContext);
  // True inside a STACKED viewport — threaded to the pane so it treats its display
  // settings as the stack's ONE SHARED object (a pick applies to all slots + survives
  // flips; authored props are seeds; HOME adopts the focused slot; exit discards).
  // DIFF path (Phase 2c): a diff-mode compare lowers to THIS component (so an
  // `[image, diff]` stack is homogeneous — no remount on a flip). When present,
  // BOTH operands resolve through the compare resolver (`node.data` = reference =
  // `source`; `diffSpec.fgData` = foreground = `compareSource.b`) instead of the
  // single-image `resolveDataProps`, and a `compareSource` is threaded to the
  // image renderer. The channel strip / exr tree / shared-colormap merge below
  // are single-image concerns and are inert on this path.
  const isDiff = !!diffSpec;
  const activeDefaults = diffSpec?.cellDefaults ?? defaultSettingsForNode(node, shared);
  const resetSettings = useCallback(() => {
    (paneSync?.resetSyncedSettings ?? paneSync?.setSyncedSettings)?.(activeDefaults);
  }, [paneSync?.resetSyncedSettings, paneSync?.setSyncedSettings, activeDefaults]);

  // Channel selection is an ordinary cell setting. It changes resolution but
  // never creates a renderer-local fallback store.
  const syncedChannelSelect = paneSync?.syncedSettings?.["image.channelSelect"];
  const chSel = (syncedChannelSelect as ChannelSelection | null | undefined) ?? null;
  const chSelRef = useRef<ChannelSelection | null>(null);
  chSelRef.current = chSel;
  // The last UNSLICED resolve's channel tree (see the menu block below).
  const baseChannelTreeRef = useRef<ChannelMenuTree | undefined>(undefined);
  // SINGLE-PANE FULLSCREEN (enlarge) — the flag lives HERE, above the async-
  // resolve swap: a channel pick's cold re-resolve renders the "Loading…"
  // placeholder, unmounting the whole renderer subtree — component-local
  // enlarge state there was reset, throwing the user out of fullscreen (the
  // reported bug). ImageLeafView survives that swap, so the pane consumes this as
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
      const registered = getReactPlotType(node.type);
      if (!registered) {
        throw new Error(`cairn-plot: plot type ${JSON.stringify(node.type)} is not registered`);
      }
      const dp = registered.definition.present(await registered.definition.resolve(
        { ...node, data: effectiveData },
        { source, signal: new AbortController().signal },
      )) as Record<string, unknown>;
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
        paneSync?.setSyncedSettings?.({ "image.channelSelect": null });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [node, source, selKey, effectiveData, resolveKey, diffSpec, paneSync]);

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
  // all). The view-sync group id is the selection override when this pane is
  // in a ≥2 selection, else the grid-wide static `shared.sync.view` group;
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
      return composeImageComparisonPresentation({
        leaf: node,
        resolved: dataProps,
        comparison: diffSpec,
      });
    }
    const composed = composeSingleImagePresentation({
      leaf: node,
      resolved: dataProps,
      shared,
      channelSelection: chSel,
      baseChannelTree: baseChannelTreeRef.current,
    });
    baseChannelTreeRef.current = composed.baseChannelTree;
    return composed.presentation;
  }, [dataProps, shared, node, chSel, diffSpec]);

  // Wait-for-registration: re-render the instant the renderer arrives, else
  // surface a bounded "unknown renderer" error.
  const typedRegistration = getReactPlotType(node.type);
  const rendererMissing = status === "ready" &&
    (!typedRegistration || typedRegistration.backends.length === 0);
  useEffect(() => {
    if (status !== "ready" || getReactPlotType(node.type)?.backends.length) return;
    const name = node.type;
    let settled = false;
    const registered = () => {
      if (!settled && getReactPlotType(name)?.backends.length) {
        settled = true;
        setRendererError(null); // renderer arrived → clear any prior timeout error
        bumpRegistry((n) => n + 1);
      }
    };
    const unsubTyped = onRegisterReactPlotType(registered);
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setRendererError(`unknown renderer "${name}"`);
      }
    }, RENDERER_WAIT_MS);
    return () => {
      settled = true;
      unsubTyped();
      clearTimeout(timer);
    };
  }, [status, rendererMissing, node.type]);

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
  const registered = getReactPlotType(node.type);
  if (registered?.backends.length) {
    const settings = registered.definition.projectSettings(
      (paneSync?.syncedSettings ?? {}) as import("../../contracts.ts").SettingsRecord,
    );
    return (
      <ImageHostRuntimeContext.Provider value={{ enlargeControl }}>
      <ReactBackendOutlet
        backends={registered.backends}
        environment={browserRenderEnvironment()}
        presentation={withoutSettingsPlumbing(mergedProps)}
        settings={settings}
        commands={{
          patch: (patch) => paneSync?.setSyncedSettings?.(patch as PlotSettings),
          reset: resetSettings,
        }}
        invalidation="presentation"
      />
      </ImageHostRuntimeContext.Provider>
    );
  }
  return <Message text="Loading renderer…" />;
}


function browserRenderEnvironment(): RenderEnvironment {
  return {
    webgpu: typeof navigator !== "undefined" && "gpu" in navigator,
    webgl2: typeof WebGL2RenderingContext !== "undefined",
    pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  };
}

/** Image-owned adapter for ordinary images and image comparisons. */
export function ImageNodeHost({ node }: { node: PlotLeafNode | CompareNode }) {
  const { shared } = useSharedPlot();
  if (node.kind === "plot") return <ImageHostAdapter node={node} />;

  let planned;
  try {
    planned = planRegisteredImageComparison(node);
  } catch (error) {
    return <Message text={error instanceof Error ? error.message : String(error)} error />;
  }
  const comparison: ImageComparisonHostInput = {
    node,
    align: planned.align,
    fit: planned.fit,
    referenceLabel: planned.referenceLabel,
    foregroundLabel: planned.foregroundLabel,
    cellDefaults: defaultSettingsForNode(node, shared),
  };
  return <ImageHostAdapter node={planned.leaf} comparison={comparison} />;
}
