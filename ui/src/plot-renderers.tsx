/**
 * The standalone plot bundle's always-present plot definitions cover the 2D
 * charts, single-image, and table renderers. It imports the SAME pure
 * `lib/cairn-plot` renderers the viewer app
 * uses, so a Python-emitted plot is pixel-identical to the same renderer in
 * the app (consistency by construction).
 *
 * O2 bundle-split: Plotly `figure` is NO LONGER in this map — it ships as a
 * separate addon (`plot-figure-renderer.tsx` → `figure.iife.js`) registered at
 * runtime via `registerRenderer` so a scalar/table/image page never carries
 * Plotly. 3D (three.js) is likewise Phase-D addon territory and absent here.
 * `registerCoreRenderers()` seeds the runtime registry (`plot-registry.tsx`).
 *
 * Each entry is a thin STANDALONE ADAPTER around the pure renderer. The pure
 * renderers are prop-pure but several expect controlled interactive state
 * (e.g. `ScalarPlot`'s `viewport`/`onViewportChange`) or required config the
 * app's cards normally supply; standalone there is no card, so these adapters:
 *   1. own the interactive state locally (`useState`) with sensible seeds,
 *   2. fill required config props with defaults (overridable by the
 *      descriptor's `props`), and
 *   3. give chart renderers (which fill their container via `useContainerSize`)
 *      a default height box so they don't collapse to 0 on a bare page.
 *
 * DATA props arrive already-resolved from the descriptor (`resolveDataProps`)
 * merged over the descriptor's config `props`; adapters spread that as `p`.
 */
import { floatPixelsFrom } from "./lib/cairn-plot/image/pixel-buffer.ts";
import {
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import ScalarPlot from "./lib/cairn-plot/renderers/ScalarPlot";
import { ensureBarPlotType } from "./plots/bar/register";
import { ensureHistogramPlotType } from "./plots/histogram/register";
import { ensureHeatmapPlotType } from "./plots/heatmap/register";
import { ensureParallelPlotType } from "./plots/parallel/register";
import { ensureTablePlotType } from "./plots/table/register";
import CpuImagePane from "./lib/cairn-plot/renderers/CpuImagePane";
import GpuImagePane from "./lib/cairn-plot/renderers/GpuImagePane";
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
} from "./lib/cairn-plot/renderers/gpu-image-gate";
import {
  resolveRenderMode,
  shapeDims,
  type ImageBackend,
  type RenderMode,
} from "./lib/cairn-plot/renderers/image-backend";
import { warnGpuUnavailable } from "./lib/cairn-plot/primitives/capability-notice";
import type { Viewport, PromotedSeriesConfig } from "./lib/cairn-plot/types";
import { useImageView } from "./lib/cairn-plot/settings/use-image-view";
import type { ViewportSettings } from "./lib/cairn-plot/settings/viewport-settings.ts";
import { ChartBox, ChartFillContext, DEFAULT_CHART_HEIGHT } from "./plot-standalone-helpers";
import { ContentAspectFrame } from "./lib/cairn-plot/renderers/ContentAspectFrame";
import {
  GridUniformAspectContext,
  GridCellReporter,
  finitePositive,
} from "./lib/cairn-plot/renderers/grid-uniform-aspect";
import { ensureImagePlotType } from "./plots/image/register.ts";
import { ensureScalarPlotType } from "./plots/scalar/register.ts";
import { ensureScatterPlotType } from "./plots/scatter/register.ts";
import { BarPlotView } from "./plots/bar/view.tsx";
import { HeatmapPlotView } from "./plots/heatmap/view.tsx";
import { HistogramPlotView } from "./plots/histogram/view.tsx";
import { ParallelPlotView } from "./plots/parallel/view.tsx";
import { ScatterPlotView } from "./plots/scatter/view.tsx";
import { TablePlotView } from "./plots/table/view.tsx";
import { resolveDataProps } from "./plot-descriptor.ts";

/** Loose prop bag — resolved data props + descriptor config, unified. */
type P = Record<string, any>;

// ---------------------------------------------------------------------------
// resolveImageRenderer — the render-mode BACKEND seam for the standalone
// image path (formalized from Task 8's WebGPU-or-legacy check; see
// `docs/superpowers/specs/2026-07-16-webgpu-engine-design.md`). Two
// interchangeable backends — `CpuImagePane` (CPU/2D-canvas) and
// `GpuImagePane` (WebGPU engine) — accept the SAME `ImageBackendProps`
// (`lib/cairn-plot/renderers/image-backend.ts`); THIS is where one is chosen
// per mount, by the user-settable `RenderMode` (cpu | gpu | auto — see
// `resolveRenderMode` for the prop → window global → `?render=` → "auto"
// precedence). The rest of the app is backend-agnostic.
//
// The RUNTIME safety net (a mounted `GpuImagePane` that fails mid-render
// self-heals to `CpuImagePane` — the C1 fix, `GpuImagePane.tsx`'s
// `engineFailed` state) is a SEPARATE, later line of defense — both land on
// the same CPU backend, so a page never blanks whether WebGPU is simply
// unavailable (this seam) or available-but-fails-at-runtime (C1).
//
// `GpuImagePane` ships IN core (addon-fold ruling 2026-08-26) — the async
// part that remains is DEVICE acquisition, owned by `gpu-image-gate.ts`:
// image surfaces render the CPU backend until the probe settles, then flip.
// Warn once (not per render) when `"gpu"` is forced but the engine backend
// is genuinely unavailable and the CPU backend is substituted.
let warnedForcedGpuUnavailable = false;

/**
 * Resolves the image BACKEND component to render THIS mount, by `mode`:
 *   - `"cpu"`  → `CpuImagePane`, always.
 *   - `"gpu"`  → the engine's `GpuImagePane` if the gpu-image addon has
 *     registered it (`window.__cairnPlotGpuImagePane`, set once
 *     `getSharedDevice()` resolves — bypassing the `__cairnPlotUseGpuImage`
 *     opt-out, since an explicit force outranks the default gate); if the
 *     addon/WebGPU is genuinely unavailable, `console.warn` once and fall
 *     back to `CpuImagePane` — never a blank pane.
 *   - `"auto"` → today's behavior: `GpuImagePane` when the addon has loaded
 *     AND the capability flag is on (`__cairnPlotUseGpuImage === true`),
 *     else `CpuImagePane` — covering "addon hasn't run yet", "opted out",
 *     and "`getSharedDevice()` rejected" uniformly.
 *
 * Implemented as a React hook (despite the name — no `use` prefix, since
 * this is the seam's public name, not just an internal implementation
 * detail) because it must re-render the caller once, the instant the addon
 * finishes, via the `GPU_IMAGE_READY_EVENT` it dispatches — fixing the
 * async-registration race where the addon's `getSharedDevice()` check
 * resolves AFTER this component's first paint. Return type is the shared
 * `ImageBackend` interface (`image-backend.ts`) — both backends this
 * resolves between accept the same `ImageBackendProps` shape.
 */
function resolveImageRenderer(mode: RenderMode): ImageBackend {
  const gate = useSyncExternalStore(subscribeGpuImageGate, gpuImageGateState, gpuImageGateState);
  // Kick the LAZY device probe from the first image surface (an effect, so
  // render stays pure; idempotent afterwards).
  useEffect(() => {
    if (mode !== "cpu") ensureGpuImageProbe();
  }, [mode]);
  if (typeof window === "undefined" || mode === "cpu") return CpuImagePane;
  if (mode === "gpu") {
    if (gate === "ready") return GpuImagePane;
    // WebGPU GENUINELY absent (`navigator.gpu` hidden — unsupported browser OR
    // an insecure origin, which `[SecureContext]`-gates it away) → the shared
    // bootstrap-level, two-case, once-per-page warn. `unknown` = the probe
    // hasn't settled yet — the flip to the engine pane follows automatically.
    if (gate === "unavailable") {
      if (!("gpu" in navigator)) {
        warnGpuUnavailable();
      } else if (!warnedForcedGpuUnavailable) {
        warnedForcedGpuUnavailable = true;
        // eslint-disable-next-line no-console
        console.warn(
          'cairn-plot: render mode "gpu" was forced but the WebGPU image backend is unavailable — ' +
            "falling back to the CPU backend",
        );
      }
    }
    return CpuImagePane;
  }
  // "auto": engine once the probe confirms it (the host opt-out short-circuits
  // the probe to "unavailable" inside the gate).
  return gate === "ready" ? GpuImagePane : CpuImagePane;
}

// --- ScalarPlot: cell-owned viewport + local promoted-series presentation --
function ScalarPlotStandalone(p: P) {
  const [localViewport, setLocalViewport] = useState<Viewport>(
    p.viewport ?? { xMin: null, xMax: null, yMin: null, yMax: null },
  );
  const scalarSettings = p.syncedSettings as ViewportSettings | null | undefined;
  const setScalarSettings = p.setSyncedSettings as ((patch: ViewportSettings) => void) | undefined;
  const domainX = scalarSettings?.["chart.domainX"];
  const domainY = scalarSettings?.["chart.domainY"];
  const viewport: Viewport = setScalarSettings
    ? {
        xMin: domainX?.[0] ?? null,
        xMax: domainX?.[1] ?? null,
        yMin: domainY?.[0] ?? null,
        yMax: domainY?.[1] ?? null,
      }
    : localViewport;
  const setViewport = useCallback((next: Viewport) => {
    if (!setScalarSettings) {
      setLocalViewport(next);
      return;
    }
    setScalarSettings({
      "chart.domainX": next.xMin == null || next.xMax == null ? null : [next.xMin, next.xMax],
      "chart.domainY": next.yMin == null || next.yMax == null ? null : [next.yMin, next.yMax],
    });
  }, [setScalarSettings]);
  const [localPromoted, setLocalPromoted] = useState<Record<string, PromotedSeriesConfig>>(
    p.promotedSeries ?? {},
  );
  const promoted = setScalarSettings
    ? scalarSettings?.["chart.promotedSeries"] ?? {}
    : localPromoted;
  const setPromoted = useCallback((next: Record<string, PromotedSeriesConfig>) => {
    if (setScalarSettings) setScalarSettings({ "chart.promotedSeries": next });
    else setLocalPromoted(next);
  }, [setScalarSettings]);
  const {
    height,
    viewport: _v,
    promotedSeries: _p,
    syncedSettings: _settings,
    setSyncedSettings: _setSettings,
    resetViewportSettings: _resetSettings,
    ...rest
  } = p;
  return (
    <ChartBox height={height}>
      <ScalarPlot
        series={p.series ?? []}
        xAxis={p.xAxis ?? "step"}
        xScale={p.xScale ?? "linear"}
        yScale={p.yScale ?? "linear"}
        xRange={p.xRange ?? [null, null]}
        yRange={p.yRange ?? [null, null]}
        {...rest}
        viewport={viewport}
        onViewportChange={setViewport}
        promotedSeries={promoted}
        onPromotedSeriesChange={setPromoted}
      />
    </ChartBox>
  );
}

// `useImageView` (the pane viewport ↔ selection-group sync hook) now
// lives in `renderers/use-image-view.ts` so both this module's
// `ImageStandalone` and `plot-node.tsx`'s `CompareView` drive it from ONE
// definition (imported above).

// --- ImagePane: content/aspect-sized, fills required config with defaults ---
// Like ScalarPlotStandalone, owns the interactive viewport locally: ImagePane's
// wheel-zoom (modifier-gated) + drag-pan are CONTROLLED — they need a
// `zoom`/`pan` value plus an `onViewportChange` callback to persist the gesture.
// Standalone has no settings store, so the adapter holds the state itself,
// seeded from descriptor-provided `zoom`/`pan`. Grid linking is handled by the
// owning frame's key-scoped settings membership, not by this adapter.
export function ImageStandalone(p: P) {
  // DEFAULT framing: size the pane's box to the image's CONTENT aspect within the
  // available space. `ChartFillContext` (set by a grid with `rowHeights`, or the
  // compare/enlarge stage) decides fill-the-cell vs the standalone default height.
  const fill = useContext(ChartFillContext);
  // Inside ANY grid layout — a `cp.Grid` OR the compare/enlarge stage — every
  // image viewport is UNIFORM (the grid picks ONE representative aspect and sizes
  // every cell to it): the pane FILLS its cell and this reporter feeds the cell's
  // content aspect up so the grid can choose that representative. Absent (a
  // standalone mount) ⇒ null ⇒ the per-content `ContentAspectFrame` framing below.
  const gridUniform = useContext(GridUniformAspectContext);
  // NOSTACK: the viewport is a pure projection of the settings entry
  // (`settings.view`), written through the ONE settings write path — group
  // fan-out (selection / authored grid sync) rides the settings bus. A bare
  // host mount (no store) falls back to hook-local state.
  const [viewport, onViewportChange] = useImageView(
    p.syncedSettings,
    p.setSyncedSettings,
    { zoom: p.zoom ?? 1, pan: p.pan ?? { x: 0, y: 0 } },
  );
  // resolveImageRenderer: the backend for this mount (GpuImagePane or
  // CpuImagePane — both satisfy the ONE `ImageBackendProps` contract, so the
  // swap is a drop-in replacement), chosen by the user-settable render mode:
  // explicit `renderMode` → `window.__cairnPlotRenderMode` → `?render=` → "auto".
  const Pane = resolveImageRenderer(resolveRenderMode(p.renderMode));
  // The ONE dtype-tagged decoded source arrives resolved from `resolveDataProps`.
  // Back-compat: a legacy `imageUrl`/`hdr` prop (e.g. a hand-built descriptor)
  // is normalized to a `source` here so a single code path renders both.
  const source =
    p.source ??
    (p.hdr
      ? {
          dtype: "float" as const,
          // Legacy WIRE bridge (hand-built descriptors author {data, precision}):
          // interpreted exactly ONCE, into the self-describing buffer.
          pixels: floatPixelsFrom(p.hdr.data, p.hdr.precision),
          shape: p.hdr.shape,
          numpyDtype: p.hdr.dtype,
          deep: p.hdr.deep,
        }
      : { dtype: "uint8" as const, url: p.imageUrl ?? null });
  const pane = (
    <Pane
      source={source}
      compareSource={p.compareSource}
      toolbar={p.toolbar}
      baselineUrl={p.baselineUrl ?? null}
      diffMode={p.diffMode ?? "none"}
      interpolation={p.interpolation ?? "auto"}
      colormap={p.colormap ?? "none"}
      tonemap={p.tonemap}
      exposure={p.exposure}
      offset={p.offset}
      peak={p.peak}
      gamma={p.gamma}
      processing={p.processing}
      showAxes={p.showAxes ?? false}
      label={p.label ?? ""}
      overlay={p.overlay}
      overlaySettings={p.overlaySettings}
      pixelValueNotation={p.pixelValueNotation}
      zoom={viewport.zoom}
      pan={viewport.pan}
      onViewportChange={onViewportChange}
      syncedSettings={p.syncedSettings}
      setSyncedSettings={p.setSyncedSettings}
      applySyncedSettings={p.applySyncedSettings}
      resetViewportSettings={p.resetViewportSettings}
      channelMenu={p.channelMenu}
      channelModified={p.channelModified}
      onChannelReset={p.onChannelReset}
      enlargeControl={p.enlargeControl}
      inStackedGrid={p.inStackedGrid}
    />
  );
  // A FLOAT/EXR source carries its pixel dims in `source.shape` ([H, W, …]) — the
  // content aspect is known SYNCHRONOUSLY (before the WebGPU pane is ready / the
  // payload is decoded). uint8/URL sources have no upfront shape (the pane's
  // `<img>` onload reports it) → null.
  const dims = source.dtype === "float" && source.shape.length >= 2 ? shapeDims(source.shape) : null;
  const knownAspect = dims ? finitePositive(dims.w / dims.h) : null;
  // In a grid the pane FILLS its (uniformly-sized) cell — no per-cell shrink —
  // and reports its aspect so the grid can size every cell to ONE representative
  // aspect (uniform viewports; selection ring = cell = viewport).
  if (gridUniform) return <GridCellReporter seedAspect={knownAspect}>{pane}</GridCellReporter>;
  // Otherwise the pane's box tracks the CONTENT aspect within the available space.
  // The OUTER frame keeps the pre-existing sizing so the component stays a
  // well-behaved embeddable: it FILLS a grid cell (`fill`) or a host-sized box
  // (a uint8/URL image previously rendered a bare, host-filling pane), and only a
  // FLOAT image on a BARE page keeps the standalone default height (the old
  // `ChartBox` behaviour). Within that box the drawable viewport shrink-wraps the
  // image, so the empty letterbox/pillarbox bands are minimised.
  const outerHeight: number | string =
    fill || source.dtype !== "float" ? "100%" : (p.height ?? DEFAULT_CHART_HEIGHT);
  // Hand the frame the known aspect (float/EXR) so it sizes the viewport to the
  // content aspect IMMEDIATELY — not after the pane's async natural-size report
  // (which for the WebGPU float path only fires post-`paneReady` + decode; until
  // then the frame sits in its tall `outerHeight` fallback → a portrait viewport).
  return (
    <ContentAspectFrame outerHeight={outerHeight} contentAspect={knownAspect}>
      {pane}
    </ContentAspectFrame>
  );
}

/** Seed the typed runtime registry with every always-present core plot. */
export function registerCoreRenderers(): void {
  ensureImagePlotType(ImageStandalone, resolveDataProps);
  ensureScalarPlotType(ScalarPlotStandalone, resolveDataProps);
  ensureScatterPlotType(ScatterPlotView, resolveDataProps);
  ensureBarPlotType(BarPlotView, resolveDataProps);
  ensureHistogramPlotType(HistogramPlotView, resolveDataProps);
  ensureHeatmapPlotType(HeatmapPlotView, resolveDataProps);
  ensureParallelPlotType(ParallelPlotView, resolveDataProps);
  ensureTablePlotType(TablePlotView, resolveDataProps);
}
