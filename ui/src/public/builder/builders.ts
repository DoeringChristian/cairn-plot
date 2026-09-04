/**
 * The `cairnPlot.*` builder functions — the first-class JS/HTML face that
 * mirrors the Python `cairn_plot` builder surface one-to-one. Each returns a
 * {@link PlotHandle} (`.mount(el)` / `.toElement()`), lowering to the SAME
 * `PlotSpec` tree the Python emitter produces, validated by the same
 * rules (`./validate`) and shaped by the same data contracts (`./shapers`,
 * `./data`) — so a JS-authored plot is identical to its Python twin.
 */
import type { DataSpec, PlotNode } from "../../../../packages/spec/src/spec.ts";
import type { JsonValue } from "../../../../packages/spec/src/json.ts";
import type { RuntimeStoreEntry } from "../../resources/data/runtime-store.ts";
import { makeHandle, type Mounter, type PlotHandle } from "./handle.ts";
import { shapeImageData, type ShapedImage } from "./data.ts";
import {
  barData,
  heatmapMatrix,
  histogramCheckPrecomputed,
  histogramFromSamples,
  lineSeriesList,
  parallelFromDimensions,
  scatterPoints,
  tableData,
} from "./shapers.ts";
import {
  checkAlign,
  checkChartColormap,
  checkCompareMode,
  checkFit,
  checkImageColormap,
  checkPixelValueNotation,
  checkTonemap,
  COMPARE_OPERATION_MODES,
} from "./validate.ts";

type Opts = Record<string, unknown>;
type Runtime = Array<[string, RuntimeStoreEntry]>;

function assertJsonValue(value: unknown, path: string, seen: Set<object>): asserts value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError(`cairnPlot: ${path} must be finite JSON data`);
  }
  if (typeof value !== "object") {
    throw new TypeError(`cairnPlot: ${path} is not JSON-serializable`);
  }
  if (seen.has(value)) throw new TypeError(`cairnPlot: ${path} contains a cycle`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, seen));
    seen.delete(value);
    return;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`cairnPlot: ${path} must contain only plain JSON objects`);
  }
  for (const [key, item] of Object.entries(value)) {
    assertJsonValue(item, `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function jsonRecord(value: object, path: string): Record<string, JsonValue> {
  assertJsonValue(value, path, new Set());
  return value as Record<string, JsonValue>;
}

/** The camelCase builder names shared by BOTH faces — pinned to
 *  `schema/cairn-plot-contracts.json`'s `builders` by the parity test, so the
 *  JS namespace and the Python composable surface can't drift. */
export const BUILDER_NAMES = [
  "line",
  "scatter",
  "bar",
  "histogram",
  "heatmap",
  "parallelCoordinates",
  "image",
  "table",
  "compare",
  "grid",
  "mesh",
  "pointcloud",
  "volume",
  "boxes",
] as const;

const num = (v: unknown): number => Number(v);

// ---------------------------------------------------------------------------
// image config props (mirrors Python `_image_display_props` / `_image_hdr_props`)
// ---------------------------------------------------------------------------

function imageDisplayProps(o: Opts, suppressGamma = false, suppressExposureOffset = false): Opts {
  const props: Opts = {};
  const { exposure, gamma, brightness, contrast, offset, flipSign, colormap, interpolation, pixelValueNotation } = o;
  // `gamma` is suppressed here when a UNIFIED tone-map transfer is engaged, so
  // the Gamma operator's γ is never ALSO applied as the CSS-filter
  // `processing.gamma` (mirrors Python `_image_display_props` gamma=None wiring).
  const gammaForProcessing = suppressGamma ? null : gamma;
  // `exposure`/`offset` are suppressed here on the UNIFIED non-float path, where
  // they are lifted TOP-LEVEL (in-shader) instead — the float surface discards
  // `processing`, so routing them here silently drops them for a float URL. Same
  // "lift out of processing" mechanism as `suppressGamma`.
  const exposureForProcessing = suppressExposureOffset ? null : exposure;
  const offsetForProcessing = suppressExposureOffset ? null : offset;
  if ([exposureForProcessing, gammaForProcessing, brightness, contrast, offsetForProcessing, flipSign].some((v) => v != null)) {
    props.processing = {
      brightness: brightness != null ? num(brightness) : 0,
      contrast: contrast != null ? num(contrast) : 0,
      gamma: gammaForProcessing != null ? num(gammaForProcessing) : 1,
      exposure: exposureForProcessing != null ? num(exposureForProcessing) : 0,
      offset: offsetForProcessing != null ? num(offsetForProcessing) : 0,
      flipSign: flipSign != null ? Boolean(flipSign) : false,
    };
  }
  if (colormap != null) props.colormap = checkImageColormap(String(colormap));
  if (interpolation != null) props.interpolation = interpolation;
  if (pixelValueNotation != null) props.pixelValueNotation = checkPixelValueNotation(String(pixelValueNotation));
  return props;
}

/**
 * UNIFIED tone-map props for a NON-float (uint8/URL) image — emitted TOP-LEVEL
 * (`tonemap`/`gamma`/`peak`), distinct from the CSS-filter `processing` block.
 * Mirrors Python `_image_sdr_transfer_props`: the client sRGB-decodes the 8-bit
 * source to scene-linear, so all 5 operators + `peak` are meaningful. Returns
 * `{}` when nothing is set (client default `srgb`, an identity round-trip). A
 * `gamma=` without a `tonemap=` selects the Gamma operator. Keeping this on the
 * non-float path preserves `tonemap`/`peak` for a raw-buffer URL image (which no
 * longer routes to a separate HDR renderer) instead of silently dropping them.
 */
function imageSdrTransferProps(o: Opts): Opts {
  if (o.tonemap == null && o.gamma == null && o.peak == null) return {};
  const tm = o.tonemap != null ? checkTonemap(String(o.tonemap)) : o.gamma != null ? "gamma" : "srgb";
  const props: Opts = { tonemap: tm };
  if (o.gamma != null) props.gamma = num(o.gamma);
  if (o.peak != null) props.peak = num(o.peak);
  return props;
}

function imageHdrProps(o: Opts): Opts {
  // UNIFIED surface: emit `tonemap` only when set (unset → the client's surface
  // default: Linear + managed PEAK on HDR, sRGB on SDR). A `gamma=` without a
  // `tonemap=` selects the Gamma operator (mirrors Python). `peak` (P) is the
  // HDR mode; every operator clips at it.
  const tm =
    o.tonemap != null ? checkTonemap(String(o.tonemap)) : o.gamma != null ? "gamma" : undefined;
  const props: Opts = { exposure: o.exposure != null ? num(o.exposure) : 0 };
  if (tm != null) props.tonemap = tm;
  // Base OFFSET — display-offset counterpart of `exposure` (controlled surface).
  if (o.offset != null) props.offset = num(o.offset);
  if (o.gamma != null) props.gamma = num(o.gamma);
  if (o.peak != null) props.peak = num(o.peak);
  if (o.interpolation != null) props.interpolation = o.interpolation;
  if (o.pixelValueNotation != null) props.pixelValueNotation = checkPixelValueNotation(String(o.pixelValueNotation));
  return props;
}

// ---------------------------------------------------------------------------
// The factory — binds every builder to one `Mounter` (the CORE-installed one).
// ---------------------------------------------------------------------------

export interface CairnPlot {
  line(y: unknown, x?: unknown, opts?: Opts): PlotHandle;
  scatter(xs: unknown, ys: unknown, opts?: Opts): PlotHandle;
  bar(values: unknown, opts?: Opts): PlotHandle;
  histogram(x?: unknown, opts?: Opts): PlotHandle;
  heatmap(z: unknown, opts?: Opts): PlotHandle;
  parallelCoordinates(dimensions: unknown, opts?: Opts): PlotHandle;
  image(data: unknown, opts?: Opts): PlotHandle;
  table(rows: unknown, opts?: Opts): PlotHandle;
  compare(a: unknown, b: unknown, opts?: Opts): PlotHandle;
  grid(children: unknown[] | unknown[][], opts?: Opts): PlotHandle;
  mesh(...args: unknown[]): PlotHandle;
  pointcloud(...args: unknown[]): PlotHandle;
  volume(...args: unknown[]): PlotHandle;
  boxes(...args: unknown[]): PlotHandle;
  /** Register in-memory runtime data (advanced/manual use). */
  registerRuntime(entries: Runtime): void;
}

function leaf(type: string, data: DataSpec, props?: Opts, settings?: Opts): PlotNode {
  const node: PlotNode = { kind: "plot", type, data };
  if (settings && Object.keys(settings).length) {
    node.settings = jsonRecord(settings, `${type}.settings`);
  }
  if (props && Object.keys(props).length) {
    node.props = jsonRecord(props, `${type}.props`);
  }
  return node;
}

function takeImageSettings(props: Opts): Opts {
  const settings: Opts = {};
  const take = (prop: string, key: string, map: (value: unknown) => unknown = (value) => value) => {
    if (props[prop] === undefined) return;
    settings[key] = map(props[prop]);
    delete props[prop];
  };
  take("tonemap", "image.encoding");
  take("gamma", "image.tonemapGamma");
  take("peak", "image.peak");
  take("exposure", "image.exposureEV");
  take("offset", "image.offset");
  take("colorRange", "image.colorRange", (value) => {
    const range = value as [number, number];
    return { min: range[0], max: range[1] };
  });
  take("colormap", "image.encoding", (value) => value === "viridis" ? "turbo" : value);
  const zoom = props.zoom;
  const pan = props.pan;
  if (zoom !== undefined || pan !== undefined) {
    settings["image.view"] = {
      zoom: zoom ?? 1,
      pan: pan ?? { x: 0, y: 0 },
    };
    delete props.zoom;
    delete props.pan;
  }
  take("splitPosition", "compare.split");
  take("operation", "compare.operation");
  if (props.settings && typeof props.settings === "object") {
    Object.assign(settings, props.settings);
    delete props.settings;
  }
  return settings;
}

/** Builder shapers produce plain JSON objects; this is their wire boundary. */
function inline(props: object): DataSpec {
  return { kind: "inline", props: jsonRecord(props, "inline.props") };
}

/** Pull the image/url/imghdr `DataSpec` + runtime out of a handle OR shape a
 *  raw image input into one (mirrors Python's `_leaf_dataspec` requirement that
 *  compare operands be image-like). */
function compareSide(input: unknown): { data: DataSpec; runtime: Runtime } {
  if (isHandle(input)) {
    const node = input.node;
    if (node.kind === "plot" && ["image", "url", "imghdr"].includes(node.data.kind)) {
      return { data: node.data, runtime: input.runtime };
    }
    throw new Error(
      "cairnPlot: compare(...) requires image-like operands (cairnPlot.image or an image handle); " +
        "for arbitrary cells side by side use cairnPlot.grid([...], { cols: 2 })",
    );
  }
  const shaped = shapeImageData(input);
  return { data: shaped.data, runtime: shaped.runtime };
}

function isHandle(x: unknown): x is PlotHandle {
  return typeof x === "object" && x !== null && "node" in x && "spec" in x;
}

function rendererLoaded(name: string): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.__cairnPlotHasRenderer === "function" &&
    window.__cairnPlotHasRenderer(name)
  );
}

function threeGate(name: string): never {
  if (rendererLoaded(name)) {
    throw new Error(
      `cairnPlot: 3D ${name}(...) authoring from JavaScript is not yet supported — bake it from ` +
        `Python (cairn_plot.${name}). The three.js addon is loaded; only the JS data path is pending.`,
    );
  }
  throw new Error(
    `cairnPlot: 3D ${name}(...) needs the three.js addon — include dist/plot-inline/three.iife.js ` +
      `AFTER core.iife.js (it registers the "${name}" renderer).`,
  );
}

export function createCairnPlot(mount?: Mounter): CairnPlot {
  const handle = (node: PlotNode, runtime: Runtime = []): PlotHandle =>
    makeHandle(node, { runtime }, mount);

  return {
    line(y, x, opts = {}) {
      const series = lineSeriesList(y, { x, label: opts.label as string | undefined });
      return handle(leaf("scalar", inline({ series })));
    },

    scatter(xs, ys, opts = {}) {
      const points = scatterPoints(xs, ys, { color: opts.color, labels: opts.labels });
      const cfg: Opts = { colormap: checkChartColormap(String(opts.colormap ?? "turbo")) };
      if (opts.xLabel != null) cfg.xLabel = opts.xLabel;
      if (opts.yLabel != null) cfg.yLabel = opts.yLabel;
      if (opts.colorLabel != null) cfg.colorLabel = opts.colorLabel;
      if (opts.xLog) cfg.xLog = true;
      if (opts.yLog) cfg.yLog = true;
      return handle(leaf("scatter", inline({ points }), cfg));
    },

    bar(values, opts = {}) {
      const bars = barData(values, { labels: opts.labels, colors: opts.colors });
      const cfg: Opts = {};
      if (opts.valueLabel != null) cfg.valueLabel = opts.valueLabel;
      if (opts.logX) cfg.logX = true;
      return handle(leaf("bar", inline({ bars }), cfg));
    },

    histogram(x, opts = {}) {
      const o = opts;
      let counts: number[];
      let edges: number[];
      if (o.counts != null || o.edges != null) {
        if (x != null) throw new Error("cairnPlot: histogram(...): pass samples OR precomputed counts/edges, not both");
        if (o.counts == null || o.edges == null) throw new Error("cairnPlot: histogram({counts, edges}): both are required");
        ({ counts, edges } = histogramCheckPrecomputed(o.counts, o.edges));
      } else {
        if (x == null) throw new Error("cairnPlot: histogram(...) requires samples or precomputed counts/edges");
        ({ counts, edges } = histogramFromSamples(x, o.bins != null ? Number(o.bins) : 30));
      }
      const cfg: Opts = { view: "bars" };
      if (o.logY) cfg.logY = true;
      return handle(leaf("histogram", inline({ counts, edges }), cfg));
    },

    heatmap(z, opts = {}) {
      const matrix = heatmapMatrix(z);
      const cfg: Opts = { colormap: checkChartColormap(String(opts.colormap ?? "turbo")) };
      if (opts.zmin != null) cfg.min = num(opts.zmin);
      if (opts.zmax != null) cfg.max = num(opts.zmax);
      if (opts.logColor) cfg.logColor = true;
      if (opts.originTop === false) cfg.originTop = false;
      if (opts.xLabel != null) cfg.xLabel = opts.xLabel;
      if (opts.yLabel != null) cfg.yLabel = opts.yLabel;
      if (opts.valueLabel != null) cfg.valueLabel = opts.valueLabel;
      return handle(leaf("heatmap", inline({ matrix }), cfg));
    },

    parallelCoordinates(dimensions, opts = {}) {
      const { columns, rows, columnDomains } = parallelFromDimensions(dimensions);
      const cfg: Opts = { colormap: checkChartColormap(String(opts.colormap ?? "turbo")) };
      return handle(leaf("parallel", inline({ columns, rows, columnDomains }), cfg));
    },

    image(data, opts = {}) {
      const shaped: ShapedImage = shapeImageData(data, {
        shape: opts.shape as number[] | undefined,
      });
      // ONE renderer ("image"). Prop STYLE keys on the AUTHORED input type, not
      // the extension: genuinely-float input (buffers/nested) gets the HDR-style
      // controls (top-level tonemap/exposure/offset/gamma/peak); every other
      // input gets the display block + the unified SDR tone-map transfer.
      let props: Opts;
      if (shaped.float) {
        props = imageHdrProps(opts);
      } else {
        const transfer = imageSdrTransferProps(opts);
        props = imageDisplayProps(opts, Object.keys(transfer).length > 0, /* suppressExposureOffset */ true);
        Object.assign(props, transfer);
        // Emit `exposure`/`offset` TOP-LEVEL (in-shader), NOT into the CSS-filter
        // `processing` block. The unified FLOAT surface discards `processing`, so
        // a float URL (.exr/.npy/…) would silently drop them; BOTH surfaces read
        // them top-level (Uint8SurfaceProps for uint8, the HDR reconstruction for
        // float). Suppressed from `processing` above so they are never applied
        // twice. Mirrors how `gamma` is lifted via `suppressGamma`.
        if (opts.exposure != null) props.exposure = num(opts.exposure);
        if (opts.offset != null) props.offset = num(opts.offset);
      }
      // Host seam: emit `toolbar:false` only when explicitly disabled (omitted at
      // the default `true`), mirroring Python `cp.Image(toolbar=...)`.
      if (opts.toolbar === false) props.toolbar = false;
      // EXR PART/CHANNEL selection (mirrors Python `cp.Image(part=, channels=)`):
      // `part` = index or part name; `channels` = group ("diffuse") or full
      // channel name ("diffuse.G", "Z"). Rides the client-decode `image` DataSpec
      // — a baked array / browser-native URL has no parts to select.
      if (opts.part != null || opts.channels != null) {
        if (shaped.data.kind !== "image") {
          throw new Error(
            "cairnPlot: image({part, channels}) requires a client-decoded URL source (e.g. an .exr URL)",
          );
        }
        const d = shaped.data as { part?: number | string; layer?: string | string[] };
        if (opts.part != null) d.part = opts.part as number | string;
        if (opts.channels != null) {
          // Group/channel name, or an ARBITRARY list of up to 3 full channel
          // names (packed into R,G,B slots in order).
          d.layer = Array.isArray(opts.channels)
            ? (opts.channels as unknown[]).map(String)
            : String(opts.channels);
        }
      }
      const settings = takeImageSettings(props);
      return handle(leaf("image", shaped.data, props, settings), shaped.runtime);
    },

    table(rows) {
      const table = tableData(rows);
      const node = leaf("table", inline({ table }));
      // The Table renderer benefits from a default height box standalone.
      (node as { props?: Opts }).props = { height: 200 };
      return handle(node);
    },

    compare(a, b, opts = {}) {
      // HDR FLIP is its own public operation now. Python drops the keyword, so
      // `flip_mode=` raises TypeError; this bag would silently swallow it and
      // hand the caller SDR FLIP.
      if (opts.flipMode != null) {
        throw new Error(
          'cairnPlot.compare: flipMode was removed; use mode:"flip_hdr" for HDR FLIP',
        );
      }
      const mode = checkCompareMode(String(opts.mode ?? "split"));
      const align = checkAlign(String(opts.align ?? "top-left"));
      const fit = checkFit(String(opts.fit ?? "crop"));
      let presentation: "split" | "difference";
      let comparisonOperationId: string | null = null;
      if (mode === "split") presentation = "split";
      else {
        presentation = "difference";
        comparisonOperationId = COMPARE_OPERATION_MODES[mode]!;
      }
      // The first operand is the reference; the second is the prediction.
      const A = compareSide(a);
      const B = compareSide(b);
      const built = imageDisplayProps(opts);
      if (opts.splitPosition != null) built.splitPosition = num(opts.splitPosition);
      if (comparisonOperationId != null) built.operation = comparisonOperationId;
      if (align !== "top-left") built.align = align;
      if (fit !== "crop") built.fit = fit;
      // Host seam: `toolbar:false` only when explicitly disabled (mirrors Python
      // `cp.Compare(toolbar=...)`); omitted at the default `true`.
      if (opts.toolbar === false) built.toolbar = false;
      if (opts.props && typeof opts.props === "object") Object.assign(built, opts.props);
      const settings = takeImageSettings(built);
      const node: PlotNode = {
        kind: "compare",
        type: "image",
        presentation,
        operands: [A.data, B.data],
        strategy: "reference",
        referenceIndex: 0,
      };
      if (Object.keys(built).length) (node as { props?: Opts }).props = built;
      if (Object.keys(settings).length) node.settings = jsonRecord(settings, "compare.settings");
      return handle(node, [...A.runtime, ...B.runtime]);
    },

    grid(children, opts = {}) {
      const flatHandles: PlotHandle[] = [];
      let derivedCols: number;
      const is2d = Array.isArray(children) && children.length > 0 && children.every((r) => Array.isArray(r));
      if (is2d) {
        const rows = children as unknown[][];
        const ncols = rows[0]!.length;
        for (const row of rows) {
          if (row.length !== ncols) throw new Error("cairnPlot: grid(...) 2-D rows must all have the same length");
          for (const c of row) flatHandles.push(asHandle(c));
        }
        derivedCols = ncols;
      } else {
        for (const c of children as unknown[]) flatHandles.push(asHandle(c));
        derivedCols = flatHandles.length;
      }
      if (flatHandles.length === 0) throw new Error("cairnPlot: grid(...) requires at least one child");
      const node: PlotNode = {
        kind: "grid",
        children: flatHandles.map((h) => h.node),
      };
      const cols = opts.cols != null ? Number(opts.cols) : derivedCols;
      (node as { cols?: number }).cols = cols;
      if (opts.colWidths != null) (node as { colWidths?: unknown }).colWidths = opts.colWidths;
      if (opts.rowHeights != null) (node as { rowHeights?: unknown }).rowHeights = opts.rowHeights;
      if (opts.gap != null) (node as { gap?: unknown }).gap = opts.gap;
      if (opts.shared != null) (node as { shared?: unknown }).shared = opts.shared;
      if (opts.initialLayout != null) {
        if (opts.initialLayout !== "grid" && opts.initialLayout !== "stack") {
          throw new Error("cairnPlot: grid initialLayout must be 'grid' or 'stack'");
        }
        (node as { initialLayout?: "grid" | "stack" }).initialLayout = opts.initialLayout;
      }
      if (opts.switchable === false) (node as { switchable?: boolean }).switchable = false;
      const runtime: Runtime = flatHandles.flatMap((h) => h.runtime);
      return handle(node, runtime);
    },

    mesh: () => threeGate("mesh"),
    pointcloud: () => threeGate("pointcloud"),
    volume: () => threeGate("volume"),
    boxes: () => threeGate("boxes"),

    registerRuntime(entries) {
      // Lazy import keeps the mount implementation out of descriptor-only use.
      void import("../../resources/data/runtime-store.ts").then((m) => m.registerRuntimeEntries(entries));
    },
  };
}

/** A grid child may be a `PlotHandle` or a raw builder result already a handle. */
function asHandle(x: unknown): PlotHandle {
  if (isHandle(x)) return x;
  throw new Error("cairnPlot: grid(...) children must be cairnPlot.* handles (e.g. cairnPlot.line(...))");
}
