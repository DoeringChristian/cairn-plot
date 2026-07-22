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
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Colorbar,
  CompositeMediaPane,
  decodeImage,
  decodedU8ToDataUrl,
  parseNpy,
  parseOverlay,
  resolveImageViewportItems,
  type ColormapName,
  type CompareFloatSource,
  type DataSource,
  type DiffMode,
  type ImageOverlayData,
  type ImageProcessing,
  type Interpolation,
} from "./lib/cairn-plot";
import type { Viewport as ImageViewport } from "./lib/cairn-plot/hooks/use-image-viewport";
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
  ChartBox,
  ChartFillContext,
  DEFAULT_CHART_HEIGHT,
} from "./plot-standalone-helpers";
import {
  isEagerMount,
  LAZY_ROOT_MARGIN,
  type EagerMountSignals,
} from "./lib/cairn-plot/lazy-mount";
import PlotToolbar from "./lib/cairn-plot/primitives/PlotToolbar";
import {
  useImageController,
  IMAGE_TOOLBAR_CONFIG,
} from "./lib/cairn-plot/renderers/use-image-controller";
import type { ToolbarButtonSpec } from "./lib/cairn-plot/controls/ToolbarConfig";
import { buildCompareModeMenu } from "./lib/cairn-plot/media-compare/compare-mode-menu";

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
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; props: Record<string, unknown> }
  >({ status: "loading" });
  const [, bumpRegistry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dataProps = await resolveDataProps(node.data, source);
        if (cancelled) return;
        const sharedProps: Record<string, unknown> = {};
        if (shared?.colormap != null) sharedProps.colormap = shared.colormap;
        if (shared?.colorRange != null) sharedProps.colorRange = shared.colorRange;
        // Viewport sync (`shared.sync.viewport`) — threaded down as one group
        // id every synced leaf picks up: `image`/`imagehdr` adapters via
        // `useSyncedImageViewport`, and 2D chart adapters via
        // `ChartSyncBoundary` → `useChartViewport` (see `plot-renderers.tsx`).
        // Harmless on leaves that don't sync (an unused prop), same as
        // `colormap`/`colorRange` above.
        if (viewportSyncGroupId) sharedProps.viewportSyncGroupId = viewportSyncGroupId;
        setState({
          status: "ready",
          props: { ...sharedProps, ...(node.props ?? {}), ...dataProps },
        });
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
  }, [node, source, shared, viewportSyncGroupId]);

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
      <Renderer {...state.props} />
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
    return { url: data.src, overlay: parseOverlay(data.metadata) ?? undefined };
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
      const res = await fetch(data.url);
      if (!res.ok) {
        throw new Error(
          `cairn-plot: failed to fetch compare image ${data.url} (${res.status})`,
        );
      }
      const bytes = await res.arrayBuffer();
      // NOTE: no `deepLiveFlatten` here — the DEPTH slider is RESTRICTED to
      // single-image panes for now (folding zClip into the compare diff
      // contentKey + re-flatten plumbing is disproportionate to the payoff). A
      // deep EXR in Compare shows the FULL composite (Z ≤ zMax), same as before.
      const decoded = await decodeImage({
        bytes,
        url: data.url,
        mime: res.headers.get("content-type") ?? undefined,
      });
      const overlay = parseOverlay(data.metadata) ?? undefined;
      if (decoded.kind === "f32") {
        return {
          url: null,
          float: {
            data: decoded.data,
            width: decoded.width,
            height: decoded.height,
            channels: decoded.channels,
            precision: decoded.precision,
            // The ORIGINAL source URL is the stable diff-cache content key —
            // NOT the decoded bytes — so a rerender with the same URL is a hit.
            contentKey: data.url,
          },
          overlay,
        };
      }
      return { url: decodedU8ToDataUrl(decoded), overlay };
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
type CompareViewMode = "side" | "split" | "blend" | "diff";

/** Read the diff-kernel MENU list the gpu-image addon publishes on `window`
 *  (`plot-gpu-image-addon.tsx`). Empty when the addon hasn't loaded / no WebGPU
 *  — the menu then shows only side · slide · blend (no kernels to switch to
 *  without the engine). Kept off a static import so `engine/kernels` (all the
 *  WGSL sources) never enters `core.iife.js`. */
function readDiffMenuModes(): { id: string; label: string }[] {
  if (typeof window === "undefined") return [];
  return (
    (window as unknown as { __cairnPlotDiffMenuModes?: { id: string; label: string }[] })
      .__cairnPlotDiffMenuModes ?? []
  );
}

/** Event the gpu-image addon dispatches once it's initialized (name mirrored,
 *  not imported — core must not depend back on an addon file). */
const GPU_IMAGE_READY_EVENT = "cairn-plot:gpu-image-ready";

function CompareView({ node }: { node: CompareNode }) {
  const { source, shared } = useSharedPlot();
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

  // View-mode state (Change 2): CompareView OWNS the side ⇄ slide ⇄ blend ⇄
  // kernel selection — the layer that owns which layout renders (the 2-pane
  // side-by-side vs the composited `CompositeMediaPane`/`GpuComparePane`). The
  // descriptor's `mode` SEEDS it; menu changes stay view-local. `diffKernel`
  // holds the last selected kernel token so a side ⇄ diff round-trip re-seeds
  // the pane to it. Declared unconditionally (rules-of-hooks) BEFORE the
  // loading/error returns below.
  const [viewMode, setViewMode] = useState<CompareViewMode>(node.mode);
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

  // Own the live viewport (zoom/pan) locally so wheel-zoom + drag-pan work in
  // the compare view exactly like the single ImageStandalone pane. The
  // compositor forwards this SAME zoom/pan to BOTH panes, so split/blend/diff
  // (and the two side panes) zoom in lock-step.
  const [viewport, setViewport] = useState<ImageViewport>({
    zoom: 1,
    pan: { x: 0, y: 0 },
  });

  // The MODE menu (side · slide · blend · <kernels>) — matches the Python enum.
  // Hosted TWO ways: (1) in the side view, by CompareView's own PlotToolbar
  // (below), since the 2-pane layout has no toolbar of its own; (2) in the
  // composited views, by `GpuComparePane`'s shell toolbar (which builds the same
  // list + a "Side" entry wired to `onRequestSide`). Both stay in sync through
  // this component's `viewMode`/`diffKernel` state.
  const modeMenu = useMemo<ToolbarButtonSpec>(
    () =>
      buildCompareModeMenu({
        mode: viewMode,
        kernel: diffKernel,
        kernelOptions: readDiffMenuModes(),
        onSide: () => setViewMode("side"),
        onSlide: () => setViewMode("split"),
        onBlend: () => setViewMode("blend"),
        onKernel: (id) => {
          setViewMode("diff");
          setDiffKernel(id);
        },
      }),
    [viewMode, diffKernel],
  );

  // A controller for the side view's overlay toolbar, bound to the SAME shared
  // viewport the two side panes render from (so its zoom/reset drive both).
  const sideRef = useRef<HTMLDivElement | null>(null);
  const sideController = useImageController({
    rootRef: sideRef,
    zoom: viewport.zoom,
    pan: viewport.pan,
    onViewportChange: setViewport,
  });
  const sideToolbarConfig = useMemo(
    () => ({ ...IMAGE_TOOLBAR_CONFIG, leadingButtons: [modeMenu] }),
    [modeMenu],
  );

  if (state.status === "loading") return <Message text="Loading…" />;
  if (state.status === "error") return <Message text={`Plot error: ${state.message}`} error />;

  const baseIdx = node.baselineIndex ?? 0;
  const reference = baseIdx === 0 ? state.a : state.b;
  const foreground = baseIdx === 0 ? state.b : state.a;

  const interpolation = (props.interpolation as Interpolation | undefined) ?? "auto";
  const showAxes = (props.showAxes as boolean | undefined) ?? false;
  const processing = props.processing as ImageProcessing | undefined;
  const pixelValueNotation = props.pixelValueNotation as "decimal" | "int" | undefined;

  // SIDE view: the 2-pane side-by-side (rendered by `CompositeMediaPane`'s side
  // branch) plus CompareView's OWN overlay PlotToolbar hosting the MODE menu —
  // the toolbar the composited views get from the pane shell, here supplied by
  // the layout owner. `group` enables the toolbar's hover-reveal.
  if (viewMode === "side") {
    return (
      <ChartBox>
        <div ref={sideRef} className="relative h-full w-full group">
          <PlotToolbar controller={sideController} config={sideToolbarConfig} />
          <CompositeMediaPane
            mode="side"
            imageUrl={foreground.url}
            baselineUrl={reference.url}
            imageFloat={foreground.float}
            baselineFloat={reference.float}
            diffSubmode={diffKernel as DiffMode}
            colormap={colormap}
            interpolation={interpolation}
            showAxes={showAxes}
            processing={processing}
            splitPosition={splitPos}
            onSplitPositionChange={setSplitPos}
            blendAlpha={props.blendAlpha as number | undefined}
            zoom={viewport.zoom}
            pan={viewport.pan}
            onViewportChange={setViewport}
            label=""
            overlay={foreground.overlay}
            pixelValueNotation={pixelValueNotation}
          />
        </div>
      </ChartBox>
    );
  }

  // Composited views (slide/blend/diff): `CompositeMediaPane` → `GpuComparePane`
  // (when the engine is present), whose shell hosts the MODE menu (with a "Side"
  // entry). Its selections flow back up through the callbacks below so this
  // component's lifted view-mode state stays coherent for side round-trips.
  return (
    <ChartBox>
      <CompositeMediaPane
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
        onRequestSide={() => setViewMode("side")}
        colormap={colormap}
        interpolation={interpolation}
        showAxes={showAxes}
        processing={processing}
        splitPosition={splitPos}
        onSplitPositionChange={setSplitPos}
        blendAlpha={props.blendAlpha as number | undefined}
        zoom={viewport.zoom}
        pan={viewport.pan}
        onViewportChange={setViewport}
        label=""
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

  const grid = (
    <ChartFillContext.Provider value={fill}>
      <div style={gridStyle}>
        {children.map((child, i) => (
          <div key={i} style={fill ? { height: "100%", minWidth: 0 } : { minWidth: 0 }}>
            <PlotNodeView node={child} />
          </div>
        ))}
      </div>
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

/** Render one node — dispatch on `kind`. */
export function PlotNodeView({ node }: { node: PlotNode }) {
  switch (node.kind) {
    case "plot":
      return (
        <LazyGate reservedHeight={reservedHeightOf(node.props)}>
          <LeafView node={node} />
        </LazyGate>
      );
    case "grid":
      // Grids are cheap layout — only their leaf/compare descendants gate.
      return <GridView node={node} />;
    case "compare":
      return (
        <LazyGate reservedHeight={reservedHeightOf(node.props)}>
          <CompareView node={node} />
        </LazyGate>
      );
    default:
      return <Message text={`unknown node kind "${(node as PlotNode).kind}"`} error />;
  }
}
