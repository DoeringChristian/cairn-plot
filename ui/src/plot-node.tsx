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
  CompositeMediaPane,
  decodeImageSource,
  parseNpy,
  parseOverlay,
  resolveFinalUrl,
  resolveImageViewportItems,
  type ColormapName,
  type CompareFloatSource,
  type DataSource,
  type DiffMode,
  type ImageOverlayData,
  type ImageProcessing,
  type Interpolation,
} from "./lib/cairn-plot";
import { f16BitsToFloat32 } from "./lib/cairn-plot/image/half";
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
import { useSyncedImageViewport } from "./lib/cairn-plot/renderers/use-synced-image-viewport";
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
  type GridUniformAspectApi,
} from "./lib/cairn-plot/renderers/grid-uniform-aspect";
import { representativeAspect } from "./lib/cairn-plot/selection/pack-grid";
import {
  ChartBox,
  ChartFillContext,
  DEFAULT_CHART_HEIGHT,
} from "./plot-standalone-helpers";
import {
  isEagerMount,
  LAZY_ROOT_MARGIN,
  type EagerMountSignals,
} from "./lib/cairn-plot/lazy-mount";

/**
 * How long a `LeafView` waits for a not-yet-registered renderer (an addon
 * `<script>` still parsing) before surfacing "unknown renderer". Reduced from
 * 8000 (O2 review M1): the addon IIFE is emitted synchronously BEFORE the mount
 * push and runs same-page, so registration always wins in practice; this bound
 * only guards a genuinely unknown/misspelled renderer, which shouldn't stall 8s.
 */
const RENDERER_WAIT_MS = 4000;

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
}
export const PaneSyncContext = createContext<PaneSyncCtx | null>(null);

function Message({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={`card p-4 text-sm ${error ? "text-red-400" : "text-fg-muted"}`}>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaf — the former flat `PlotApp` body. Resolves the leaf's DataSpec against
// the shared source, waits (bounded) for its renderer to register, and renders
// the registered `*Standalone` adapter. `shared.colormap`/`colorRange` merge in
// BELOW the leaf's own props (leaf props win).
// ---------------------------------------------------------------------------
function LeafView({ node }: { node: PlotLeafNode }) {
  const { source, shared, viewportSyncGroupId } = useSharedPlot();
  // Per-pane selection-derived sync overrides (undefined outside a ≥2 selection).
  const paneSync = useContext(PaneSyncContext);
  // Only the async-resolved DATA props live in state; the shared-block +
  // selection-sync props are merged at RENDER time (below) so a selection change
  // (which flips the sync group ids) re-renders WITHOUT re-fetching the data.
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; dataProps: Record<string, unknown> }
  >({ status: "loading" });
  const [, bumpRegistry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dataProps = await resolveDataProps(node.data, source);
        if (cancelled) return;
        setState({ status: "ready", dataProps });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [node, source]);

  // Merge the shared block + the live sync group ids over the resolved data
  // props at render (leaf `node.props` win over `shared`, data props win over
  // all). The viewport-sync group id is the selection override when this pane is
  // in a ≥2 selection, else the grid-wide static `shared.sync.viewport` group;
  // the settings-sync group + anchor flag come only from an active selection.
  const mergedProps = useMemo<Record<string, unknown>>(() => {
    if (state.status !== "ready") return {};
    const sharedProps: Record<string, unknown> = {};
    if (shared?.colormap != null) sharedProps.colormap = shared.colormap;
    if (shared?.colorRange != null) sharedProps.colorRange = shared.colorRange;
    const vpGroup = paneSync?.viewportSyncGroupId ?? viewportSyncGroupId;
    if (vpGroup) sharedProps.viewportSyncGroupId = vpGroup;
    if (paneSync?.settingsSyncGroupId) {
      sharedProps.settingsSyncGroupId = paneSync.settingsSyncGroupId;
    }
    if (paneSync?.syncIsAnchor) sharedProps.syncIsAnchor = true;
    return { ...sharedProps, ...(node.props ?? {}), ...state.dataProps };
  }, [state, shared, viewportSyncGroupId, paneSync, node.props]);

  // Wait-for-registration: re-render the instant the renderer arrives, else
  // surface a bounded "unknown renderer" error.
  const rendererMissing = state.status === "ready" && !getRenderer(node.renderer);
  useEffect(() => {
    if (state.status !== "ready" || getRenderer(node.renderer)) return;
    const name = node.renderer;
    let settled = false;
    const unsub = onRegister(() => {
      if (!settled && getRenderer(name)) {
        settled = true;
        bumpRegistry((n) => n + 1);
      }
    });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setState({ status: "error", message: `unknown renderer "${name}"` });
      }
    }, RENDERER_WAIT_MS);
    return () => {
      settled = true;
      unsub();
      clearTimeout(timer);
    };
  }, [state, rendererMissing, node.renderer]);

  if (state.status === "loading") return <Message text="Loading…" />;
  if (state.status === "error") return <Message text={`Plot error: ${state.message}`} error />;
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
      const data32 =
        rt.precision === "f16-bits"
          ? f16BitsToFloat32(rt.data as Uint16Array)
          : rt.data instanceof Float32Array
            ? rt.data
            : Float32Array.from(rt.data);
      return {
        url: null,
        float: { data: data32, width, height, channels, contentKey: data.hash },
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
        data: Float32Array.from(npy.data),
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
 *  minus the kernel short names which ride on `diff` via `diffKernel`). */
type CompareViewMode = "split" | "blend" | "diff";

/** Event the gpu-image addon dispatches once it's initialized (name mirrored,
 *  not imported — core must not depend back on an addon file). */
const GPU_IMAGE_READY_EVENT = "cairn-plot:gpu-image-ready";

function CompareView({ node }: { node: CompareNode }) {
  const { source, shared } = useSharedPlot();
  // Compare panes are in the "image" sync-kind: while this pane is one of ≥2
  // selected panes, its zoom/pan locks to the group (shared with image leaves)
  // via the SAME viewport-sync bus. The frame provides the group id + anchor
  // flag; outside a selection these are absent and the viewport is purely local.
  const paneSync = useContext(PaneSyncContext);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; a: ResolvedCompareFrame; b: ResolvedCompareFrame }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          resolveFrame(node.a, source),
          resolveFrame(node.b, source),
        ]);
        if (cancelled) return;
        // Silent-empty guard (the bug): a side that resolves to NEITHER a url
        // nor a float payload is unrenderable — surface the standard error
        // state instead of a blank pane.
        const missing: string[] = [];
        if (!a.url && !a.float) missing.push("a");
        if (!b.url && !b.float) missing.push("b");
        if (missing.length) {
          setState({
            status: "error",
            message: `compare side ${missing.join(" & ")} did not resolve to an image source`,
          });
          return;
        }
        setState({ status: "ready", a, b });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [node, source]);

  // F2: honour the compare node's own `props` (interpolation/colormap/diff
  // submode/split/blend/…) — CompareView previously dropped them entirely. A
  // node prop wins over the inherited `shared` block, which wins over defaults.
  const props = (node.props ?? {}) as Record<string, unknown>;
  const colormap =
    (props.colormap as ColormapName | undefined) ??
    (shared?.colormap as ColormapName | undefined) ??
    "viridis";
  // Host seam (`cp.Compare(toolbar=False)`): drop this compare's chrome so a host
  // can drive it from its own menu. Gates BOTH the side-view owner toolbar below
  // AND the composited `GpuComparePane` shell toolbar (via `CompositeMediaPane`).
  const toolbar = (props.toolbar as boolean | undefined) ?? true;

  // View-mode state (Change 2): CompareView OWNS the slide ⇄ blend ⇄ kernel
  // selection — the layer that owns which composition renders (the composited
  // `CompositeMediaPane`/`GpuComparePane`). The descriptor's `mode` SEEDS it;
  // menu changes stay view-local. `diffKernel` holds the last selected kernel
  // token so a slide ⇄ diff round-trip re-seeds the pane to it. Declared
  // unconditionally (rules-of-hooks) BEFORE the loading/error returns below.
  // Migrate the removed legacy `side` view to the surviving `split` (Slide) so
  // an old persisted descriptor opens as Slide instead of rendering a dead mode.
  const [viewMode, setViewMode] = useState<CompareViewMode>(
    (node.mode as string) === "side" ? "split" : node.mode,
  );
  const [diffKernel, setDiffKernel] = useState<string>(
    (props.diffSubmode as string | undefined) ??
      (node.diffSubmode as string | undefined) ??
      "absolute",
  );

  // Re-render when the gpu-image addon finishes initializing, so the side
  // view's MODE menu picks up the kernel entries the moment they're published.
  const [, bumpReady] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReady = () => bumpReady((n) => n + 1);
    window.addEventListener(GPU_IMAGE_READY_EVENT, onReady);
    return () => window.removeEventListener(GPU_IMAGE_READY_EVENT, onReady);
  }, []);

  // The split-view separator is a CONTROLLED drag handle: MediaComparePane's
  // divider calls `onSplitPositionChange` but renders `splitPosition` from
  // props, so without local state the separator has nowhere to write and can't
  // move. Own the split position here, seeded from the node's own prop.
  const [splitPos, setSplitPos] = useState<number>(
    (props.splitPosition as number | undefined) ?? 0.5,
  );

  // Blend alpha, lifted to state so a settings-sync peer's patch can apply it
  // (`GpuComparePane` has no in-pane blend slider — the value travels only via
  // the anchor snapshot / a peer patch today). Seeded from the node prop.
  const [blendAlpha, setBlendAlpha] = useState<number>(
    (props.blendAlpha as number | undefined) ?? 0.5,
  );

  // Own the live viewport (zoom/pan) so wheel-zoom + drag-pan work in the
  // compare view exactly like the single ImageStandalone pane. The compositor
  // forwards this SAME zoom/pan to BOTH panes, so split/blend/diff (and the two
  // side panes) zoom in lock-step. `useSyncedImageViewport` links it to the
  // selection group when this pane is selected (with ≥1 peer) — the identical
  // hook `ImageStandalone` uses — so a compare + image selection pans together;
  // absent a group it is a plain local `{zoom,pan}` state.
  const [viewport, setViewport] = useSyncedImageViewport(
    paneSync?.viewportSyncGroupId,
    { zoom: 1, pan: { x: 0, y: 0 } },
    !!paneSync?.syncIsAnchor,
  );

  // The MODE menu (slide · blend · <kernels>) is hosted by `GpuComparePane`'s
  // shell toolbar (built there via `buildCompareModeMenu`); its selections flow
  // back through this component's `viewMode`/`diffKernel` state via the
  // `onCompareModeChange`/`onDiffKernelChange` callbacks on the composited pane.

  if (state.status === "loading") return <Message text="Loading…" />;
  if (state.status === "error") return <Message text={`Plot error: ${state.message}`} error />;

  const baseIdx = node.baselineIndex ?? 0;
  const reference = baseIdx === 0 ? state.a : state.b;
  const foreground = baseIdx === 0 ? state.b : state.a;

  // Per-side captions, matched to the a/b slots (`props.labelA`/`labelB`); the
  // reference/foreground split follows `baselineIndex`, exactly like the frames
  // above. The legacy single `props.label` (older descriptors) still names the
  // FOREGROUND caption for back-compat, but a per-side label takes precedence.
  const labelA = typeof props.labelA === "string" ? (props.labelA as string) : undefined;
  const labelB = typeof props.labelB === "string" ? (props.labelB as string) : undefined;
  const legacyLabel = typeof props.label === "string" ? (props.label as string) : undefined;
  const referenceLabel = baseIdx === 0 ? labelA : labelB;
  const foregroundLabel = (baseIdx === 0 ? labelB : labelA) ?? legacyLabel;

  const interpolation = (props.interpolation as Interpolation | undefined) ?? "auto";
  const showAxes = (props.showAxes as boolean | undefined) ?? false;
  const processing = props.processing as ImageProcessing | undefined;
  const pixelValueNotation = props.pixelValueNotation as "decimal" | "int" | undefined;

  // Composited views (slide/blend/diff): `CompositeMediaPane` → `GpuComparePane`
  // (when the engine is present), whose shell hosts the MODE menu. Its
  // selections flow back up through the callbacks below so this component's
  // lifted view-mode state stays coherent.
  return (
    <ChartBox>
      <CompositeMediaPane
        toolbar={toolbar}
        mode={viewMode}
        imageUrl={foreground.url}
        baselineUrl={reference.url}
        imageFloat={foreground.float}
        baselineFloat={reference.float}
        diffSubmode={diffKernel as DiffMode}
        diffKernel={diffKernel}
        align={node.align}
        fit={node.fit}
        onDiffKernelChange={setDiffKernel}
        onCompareModeChange={setViewMode}
        colormap={colormap}
        interpolation={interpolation}
        showAxes={showAxes}
        processing={processing}
        splitPosition={splitPos}
        onSplitPositionChange={setSplitPos}
        blendAlpha={blendAlpha}
        onBlendAlphaChange={setBlendAlpha}
        settingsSyncGroupId={paneSync?.settingsSyncGroupId}
        syncIsAnchor={!!paneSync?.syncIsAnchor}
        zoom={viewport.zoom}
        pan={viewport.pan}
        onViewportChange={setViewport}
        label=""
        referenceLabel={referenceLabel}
        foregroundLabel={foregroundLabel}
        overlay={foreground.overlay}
        pixelValueNotation={pixelValueNotation}
      />
    </ChartBox>
  );
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
  // In a `cp.Grid` an image-LEAF cell is sized to the grid's ONE uniform aspect
  // (auto rows) so every viewport in a row is identical AND the pane fills the
  // cell — making THIS selectable frame the viewport, so the ring matches it
  // exactly. In fill mode the fixed row already sizes the cell. Non-image cells
  // (scalars, nested grids) keep their natural sizing. A `compare` cell is
  // EXCLUDED: `CompareView` owns its own two-frame layout and never reports an
  // aspect, so forcing a box on it could letterbox/overflow.
  const gridUniform = useContext(GridUniformAspectContext);
  const uniformImageCell =
    !!gridUniform && !fill && node.kind === "plot" && isImageCompatibleNode(node);
  // The pane-sync context from an ENCLOSING provider (e.g. the fullscreen stage,
  // which gives its cells a shared settings-sync group). A `selectable={false}`
  // frame must PASS THIS THROUGH rather than clobber it with `null`, else the
  // stage's group id never reaches the fresh leaf/compare it wraps (Bug 3).
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
    // stretched by a taller non-image sibling in the same row.
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

  const paneSync = useMemo<PaneSyncCtx | null>(
    () =>
      groups
        ? {
            viewportSyncGroupId: groups.viewportGroupId,
            settingsSyncGroupId: groups.settingsGroupId,
            syncIsAnchor: groups.isAnchor,
          }
        : null,
    [groups?.viewportGroupId, groups?.settingsGroupId, groups?.isAnchor],
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
      <PaneSyncContext.Provider value={selectable ? paneSync : inheritedPaneSync}>
        <EnlargeInterceptContext.Provider value={enlargeIntercept}>
          {children}
        </EnlargeInterceptContext.Provider>
      </PaneSyncContext.Provider>
    </div>
  );
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

  // UNIFORM image-cell sizing: image cells report their content aspect here; the
  // grid picks the REPRESENTATIVE (median) aspect and every image cell sizes to
  // it, so viewports in a row are identical (and the selection ring, drawn on the
  // cell, matches the pane exactly). Collected at runtime because a URL/EXR
  // image's dims are known only after decode.
  const [cellAspects, setCellAspects] = useState<ReadonlyMap<string, number>>(() => new Map());
  const reportAspect = useCallback((key: string, aspect: number | null) => {
    setCellAspects((prev) => {
      const cur = prev.get(key);
      if (aspect == null) {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      }
      if (cur === aspect) return prev;
      const next = new Map(prev);
      next.set(key, aspect);
      return next;
    });
  }, []);
  const uniformAspect = useMemo<number | null>(() => {
    const xs = [...cellAspects.values()];
    return xs.length ? representativeAspect(xs) : null;
  }, [cellAspects]);
  const gridAspectApi = useMemo<GridUniformAspectApi>(
    () => ({ report: reportAspect, uniformAspect }),
    [reportAspect, uniformAspect],
  );

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: trackList(node.colWidths, Math.max(cols, 1)),
    width: "100%",
  };
  if (fill) gridStyle.gridTemplateRows = trackList(node.rowHeights, 1);
  if (node.gap != null) {
    gridStyle.gap = typeof node.gap === "number" ? `${node.gap}px` : node.gap;
  }

  // A grid re-seeds the shared context for its subtree (its own `shared` wins,
  // falling back to the parent's for nesting).
  const shared = node.shared ?? parentShared;

  // The group id is derived fresh from THIS node's own `shared.sync.viewport`
  // (never inherited from a parent grid — same "no accidental cross-grid
  // link" scoping `useCameraSync` documents) and only when this node actually
  // re-seeds the context below (`node.shared && node.shared !== parentShared`).
  const viewportSyncGroupId = node.shared?.sync?.viewport ? `plot-grid-viewport-${localId}` : null;

  // GridView is LAYOUT ONLY now — selection lives page-wide in each child's own
  // `PaneSelectionFrame` (wrapped by `PlotNodeView`), obtained from the ONE
  // document-scoped store. `ChartFillContext` still tells fill-mode children
  // (and their frames) to take `height:100%`.
  const grid = (
    <ChartFillContext.Provider value={fill}>
      <GridUniformAspectContext.Provider value={gridAspectApi}>
        <div style={gridStyle}>
          {children.map((child, i) => (
            <PlotNodeView key={i} node={child} />
          ))}
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
  const cbColormap = (node.shared.colormap as ColormapName | undefined) ?? "viridis";
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
 * Render one node — dispatch on `kind`. Every node is wrapped in the SAME
 * `PaneSelectionFrame` (page-wide selection), so a standalone mount, a grid
 * cell, an image, a compare and a chart all get selection from ONE mechanism.
 * A `plot`/`compare` is selectable unless it opts out (`props.selectable:false`);
 * a `grid` is never selectable (layout only) but keeps a non-selectable frame so
 * a nested grid still gets the `minWidth:0` grid-item wrapper it had before.
 */
export function PlotNodeView({ node }: { node: PlotNode }) {
  const selectable =
    node.kind !== "grid" && (node.props?.selectable as boolean | undefined) !== false;
  let inner: React.ReactNode;
  switch (node.kind) {
    case "plot":
      inner = (
        <LazyGate reservedHeight={reservedHeightOf(node.props)}>
          <LeafView node={node} />
        </LazyGate>
      );
      break;
    case "grid":
      // Grids are cheap layout — only their leaf/compare descendants gate.
      inner = <GridView node={node} />;
      break;
    case "compare":
      inner = (
        <LazyGate reservedHeight={reservedHeightOf(node.props)}>
          <CompareView node={node} />
        </LazyGate>
      );
      break;
    default:
      return <Message text={`unknown node kind "${(node as PlotNode).kind}"`} error />;
  }
  return (
    <PaneSelectionFrame selectable={selectable} node={node}>
      {inner}
    </PaneSelectionFrame>
  );
}
