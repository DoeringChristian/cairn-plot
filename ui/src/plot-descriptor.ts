/**
 * The plot descriptor — the ONE input that drives the standalone plot bundle
 * (`plot-main.tsx`). It is renderer-props-shaped (design spec §4/§6): it names
 * a renderer, carries that renderer's non-data config `props`, and a `data`
 * spec the bootstrap resolves — through a pluggable `DataSource` — into the
 * renderer's data-contract props (§1).
 *
 * Source order (see `plot-main.tsx`):
 *  - LOCAL default: an inlined `<script type="application/cairn-plot+json">`
 *    blob on the page (self-contained, no URL param);
 *  - ENDPOINT: a `?src=`/`?sid=` URL param pointing at a descriptor the
 *    bootstrap fetches from the repo endpoint.
 *
 * LOCAL vs ENDPOINT is ONE branch in the resolve step: same descriptor shape,
 * same `RENDERER_MAP`, same renderers — only the `DataSource` differs.
 *
 * Phase C's Python emitter builds this exact shape; keep it and the Python
 * `PlotSpec` (Phase C) in lockstep.
 */
import {
  resolveImageViewportItems,
  fetchPointCloudArrays,
  fetchMeshArrays,
  fetchVolumeArray,
  fetchBoxesArrays,
  parseOverlay,
  parseNpy,
  decodeImage,
  decodedU8ToDataUrl,
  isRawBufferFormat,
  type DataSource,
} from "./lib/cairn-plot";

/**
 * How the renderer's DATA props are produced.
 *
 *  - `inline`: the data-contract props are plain JSON, carried directly in the
 *    descriptor (2D contracts — Series[]/points[]/matrix/counts+edges/table/
 *    figure). The bootstrap merges `props` straight onto the renderer. No
 *    `DataSource` needed.
 *  - `image`: a content-addressed image artifact (+ optional baseline +
 *    overlay metadata). Resolved via `resolveImageViewportItems` against the
 *    active `DataSource` (LOCAL `data:` URL or ENDPOINT `/api/artifacts/…`),
 *    yielding `{ imageUrl, baselineUrl, overlay }` for `ImagePane`.
 *  - `npz`: a content-addressed 3D binary artifact (`.npy`/`.npz`) for the
 *    three.js renderers (G3). `objectType` selects which 3D type the bytes
 *    belong to (`pointcloud` is the only one wired in G3a; the others land in
 *    G3b). `hash` keys the LOCAL store / ENDPOINT artifact; `meta` is the
 *    Python-baked artifact metadata (channels/bounds/n_points/…) carried inline
 *    so the renderer needs a SINGLE bytes fetch, no second metadata round trip.
 */
export type DataSpec =
  | { kind: "inline"; props: Record<string, unknown> }
  | {
      kind: "image";
      hash: string | null;
      referenceHash?: string | null;
      metadata?: string | null;
      /**
       * OPTIONAL format hint for the image blob (a MIME type or extension token,
       * e.g. `"png"`, `"avif"`, `"npy"`). Drives the multi-format DECODER seam
       * (`resolveDataProps`): when it names a RAW-buffer format (`npy`/`npz`),
       * the bytes are fetched and normalized through `decodeImage` — float
       * buffers → the `hdr` prop shape, uint8 buffers → an `imageUrl` data URL.
       * Absent (or a browser-native format like png/jpeg/webp/avif/gif) keeps
       * the byte-identical URL fast path — the browser decodes it via `<img>`.
       */
      format?: string;
      /**
       * OPTIONAL direct URL to the image blob (additive to `hash`). When present,
       * `resolveDataProps` FETCHES the bytes from this URL and normalizes them
       * through `decodeImage` (sniffed by MIME/URL-ext/magic) — the same shaping
       * as the `format?` path: float buffers → the `hdr` prop shape, uint8/native
       * buffers → an `imageUrl` PNG data URL. This is the CLIENT-DECODE path that
       * lets a URL serve formats the browser can't `<img>`-decode (`exr`/`npy`/…),
       * with the image referenced by URL instead of embedded in the HTML. (For a
       * plain browser-native URL a bare-`str` `kind:"url"` passthrough is lighter;
       * this field opts into the fetch+decode path.) NOTE: a cross-origin fetch
       * is CORS-gated — the serving endpoint must allow the page's origin.
       */
      url?: string;
    }
  | {
      kind: "npz";
      hash: string | null;
      objectType: "pointcloud" | "mesh" | "volume" | "boxes3d";
      meta: Record<string, unknown>;
    }
  | {
      // A true float-HDR image artifact (HDR-A). The bytes are a float `.npy`
      // (float32/float64) with shape `[H,W]` (grayscale), `[H,W,1|3|4]`; parsed
      // by `parseNpy` and tone-mapped client-side by the `"imagehdr"` renderer
      // (`HdrImagePane`) — NOT min-max-normalized to 8-bit at ingest like the
      // `image` path. `hash` keys the LOCAL store / ENDPOINT artifact
      // (required-but-nullable, matching `image`/`npz`). `meta` is informational
      // provenance (`{shape,dtype,channels,vmin,vmax}`) baked by Python — the
      // renderer reads shape from the npy header itself, so `meta` is for
      // tooling parity with `npz`, not required for rendering.
      kind: "imghdr";
      hash: string | null;
      meta: Record<string, unknown>;
    }
  | {
      // `url`: a raw URL passed through verbatim (the 3rd data-provenance mode
      // beside inline/image). Source-agnostic like `image`, but the URL is used
      // as-is — no `DataSource` hash lookup. `src` is the foreground image URL,
      // `referenceSrc` an optional baseline, `metadata` optional overlay JSON.
      kind: "url";
      src: string;
      referenceSrc?: string | null;
      metadata?: string | null;
    };

// ---------------------------------------------------------------------------
// G1: the descriptor is a recursive TREE. A `PlotNode` is a leaf (`plot`), a
// `grid` (children laid out in CSS grid), or a `compare` (two frames composited
// into one pane). `mode`/`endpoint` are hoisted to the root `PlotDescriptor`
// wrapper — they bind the whole tree to ONE `DataSource`.
// ---------------------------------------------------------------------------

export type PlotNode = PlotLeafNode | GridNode | CompareNode;

/** A single renderer + its data — the former flat descriptor body. */
export interface PlotLeafNode {
  kind: "plot";
  /** Key into the renderer registry (e.g. "scalar", "image", "table", "figure"). */
  renderer: string;
  /** The renderer's non-data config props. */
  props?: Record<string, unknown>;
  /** How to produce the renderer's DATA props. */
  data: DataSpec;
}

/** Children laid out in a CSS grid. `colWidths`/`rowHeights` entries:
 *  number → `Nfr`, string → verbatim CSS ("25%", "120px"). */
export interface GridNode {
  kind: "grid";
  children: PlotNode[];
  cols?: number;
  colWidths?: Array<number | string>;
  rowHeights?: Array<number | string>;
  gap?: number | string;
  shared?: SharedProps;
}

/** Two DataSpec frames composited into one pane (side/split/blend/diff).
 *  `side` renders the two frames as a plain 2-pane side-by-side (the former
 *  component-level 2-cell Grid, now owned by the compare stack so it is
 *  client-switchable via the view-mode menu); `split`/`blend`/`diff` composite
 *  them through the shared compositor / GPU compare pane. */
export interface CompareNode {
  kind: "compare";
  mode: "side" | "split" | "blend" | "diff";
  a: DataSpec;
  b: DataSpec;
  /** Which frame is the reference/baseline (0 = `a`, 1 = `b`). Default 0. */
  baselineIndex?: 0 | 1;
  diffSubmode?: string;
  /** Alignment anchor for mismatched-size operands in diff modes: where the
   *  smaller extent sits within the larger before the overlap crop. Ignored
   *  under `fit:"fill"`. Default "top-left". */
  align?: "top-left" | "center" | "top-right" | "bottom-left" | "bottom-right";
  /** Mismatched-size handling in diff modes: "crop" (min-crop overlap, default)
   *  or "fill" (rescale both operands to a common grid = the primary/foreground
   *  resolution). */
  fit?: "crop" | "fill";
  props?: Record<string, unknown>;
}

/** Properties shared across a grid's cells (colormap/range/colorbar/reference,
 *  plus opt-in viewport/camera sync). */
export interface SharedProps {
  colormap?: string;
  colorRange?: [number, number];
  colorbar?: boolean;
  reference?: DataSpec;
  sync?: { viewport?: boolean; camera?: boolean };
}

export interface PlotDescriptor {
  /** The root node of the plot tree (leaf, grid, or compare). */
  root: PlotNode;
  /** Which `DataSource` the bootstrap builds for `data` resolution across the
   *  whole tree. Optional — omitted (or "local") means the self-contained LOCAL
   *  store; kept optional so it stays in lockstep with the Python
   *  `PlotDescriptorSpec` default (`mode="local"`). */
  mode?: "local" | "endpoint";
  /** ENDPOINT only: absolute base URL of the repo server (no trailing slash),
   *  used to build `${endpoint}/api/artifacts/${hash}`. */
  endpoint?: string;
}

/**
 * Resolve a descriptor's `DataSpec` → the renderer's DATA props, using the
 * active `DataSource`. The single seam where LOCAL and ENDPOINT converge:
 * every branch below is source-agnostic (it only calls `source.artifactUrl` /
 * `source.bytes`), so the same code path serves both modes.
 */
export async function resolveDataProps(
  data: DataSpec,
  source: DataSource,
): Promise<Record<string, unknown>> {
  switch (data.kind) {
    case "inline":
      return { ...data.props };
    case "image": {
      // Direct-URL CLIENT-DECODE seam. When `url` is set, fetch the bytes from
      // that URL and normalize through `decodeImage` (sniffed by the response
      // Content-Type, the URL extension, then magic bytes) — the SAME shaping as
      // the `format?` path below: float buffers → the `hdr` prop shape, uint8/
      // browser-native buffers → an `imageUrl` PNG data URL. This lets a URL
      // serve formats the browser can't `<img>`-decode (`exr`/`npy`/…) while the
      // image stays referenced by URL, not embedded. CORS applies to the fetch.
      if (data.url) {
        const res = await fetch(data.url);
        if (!res.ok) {
          throw new Error(`cairn-plot: failed to fetch image ${data.url} (${res.status})`);
        }
        const bytes = await res.arrayBuffer();
        // Single-image leaf → deep-live-flatten enabled so a deep EXR gets the
        // depth slider (`decoded.deep`, threaded into the `hdr` prop below).
        const decoded = await decodeImage(
          { bytes, url: data.url, mime: res.headers.get("content-type") ?? undefined },
          { deepLiveFlatten: true },
        );
        const overlay = parseOverlay(data.metadata) ?? undefined;
        if (decoded.kind === "f32") {
          const shape =
            decoded.channels === 1
              ? [decoded.height, decoded.width]
              : [decoded.height, decoded.width, decoded.channels];
          return {
            hdr: {
              data: decoded.data,
              shape,
              dtype: decoded.precision === "f16-bits" ? "<f2" : "<f4",
              precision: decoded.precision,
              deep: decoded.deep,
            },
            baselineUrl: null,
            overlay,
          };
        }
        return { imageUrl: decodedU8ToDataUrl(decoded), baselineUrl: null, overlay };
      }
      // Multi-format DECODER seam. When `format` names a RAW-buffer image
      // (`.npy`/`.npz`), the browser can't decode it via `<img>`, so fetch the
      // bytes and normalize through `decodeImage`: float buffers become the
      // `hdr` prop shape (pair the leaf with an HDR-capable image renderer),
      // uint8 buffers become an `imageUrl` PNG data URL for the SDR path. The
      // baseline follows the same rule. Browser-native formats (or no `format`)
      // fall through to the byte-identical URL fast path below.
      if (data.format && isRawBufferFormat(data.format) && data.hash) {
        // Single-image leaf → deep-live-flatten enabled (depth slider).
        const decoded = await decodeImage(
          { bytes: await source.bytes(data.hash), ext: data.format },
          { deepLiveFlatten: true },
        );
        const baselineUrl = await resolveRawBufferBaseline(data, source);
        const overlay = parseOverlay(data.metadata) ?? undefined;
        if (decoded.kind === "f32") {
          const shape =
            decoded.channels === 1
              ? [decoded.height, decoded.width]
              : [decoded.height, decoded.width, decoded.channels];
          return {
            hdr: {
              data: decoded.data,
              shape,
              dtype: decoded.precision === "f16-bits" ? "<f2" : "<f4",
              precision: decoded.precision,
              deep: decoded.deep,
            },
            baselineUrl,
            overlay,
          };
        }
        return { imageUrl: decodedU8ToDataUrl(decoded), baselineUrl, overlay };
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
      const ref = res.referenceItems[0] ?? null;
      return {
        imageUrl: item?.url ?? null,
        baselineUrl: ref?.url ?? null,
        overlay: item?.overlay ?? undefined,
      };
    }
    case "url": {
      // Raw URL passthrough: the `src`/`referenceSrc` are used verbatim (no
      // DataSource hash lookup). Source-agnostic like `image`; the overlay
      // `metadata` is parsed the same way `resolveImageViewportItems` does.
      return {
        imageUrl: data.src,
        baselineUrl: data.referenceSrc ?? null,
        overlay: parseOverlay(data.metadata) ?? undefined,
      };
    }
    case "npz": {
      // 3D binary artifact (G3). Dispatch on `objectType` — G3a wired
      // `pointcloud`, G3b adds `mesh`/`volume`/`boxes3d`. Each fetch core
      // (source-agnostic: LOCAL store bytes or ENDPOINT fetch) parses the
      // `.npy`/`.npz` into its typed arrays; bundle them with the inline
      // `meta` into the `{arrays, meta}` `item` the matching 3D standalone
      // consumes. NOTE: this path pulls NO three.js into core — the parsers
      // are pure; three lives only in the standalone renderers (the three
      // addon bundle).
      if (!data.hash) {
        throw new Error("npz DataSpec has no hash to resolve.");
      }
      switch (data.objectType) {
        case "pointcloud": {
          const arrays = await fetchPointCloudArrays(data.hash, source);
          return { item: { arrays, meta: data.meta } };
        }
        case "mesh": {
          const arrays = await fetchMeshArrays(data.hash, source);
          return { item: { arrays, meta: data.meta } };
        }
        case "volume": {
          // The volume renderer's `arrays` is `{ data: Float32Array }`.
          const data32 = await fetchVolumeArray(data.hash, source);
          return { item: { arrays: { data: data32 }, meta: data.meta } };
        }
        case "boxes3d": {
          const arrays = await fetchBoxesArrays(data.hash, source);
          return { item: { arrays, meta: data.meta } };
        }
        default: {
          const _exhaustive: never = data.objectType;
          throw new Error(`npz objectType "${_exhaustive}" is not supported.`);
        }
      }
    }
    case "imghdr": {
      // Float-HDR image (HDR-A). Fetch the float `.npy` bytes (source-agnostic:
      // LOCAL store or ENDPOINT), parse into `{dtype, shape, data:Float64Array}`,
      // and hand the HDR renderer (`HdrImagePane`) the `hdr` prop it consumes —
      // exposure/tone-mapping happen client-side, no 8-bit normalization. Mirror
      // of the `npz` branch (single bytes fetch; `meta` carried inline).
      if (!data.hash) {
        throw new Error("imghdr DataSpec has no hash to resolve.");
      }
      const buf = await source.bytes(data.hash);
      const npy = parseNpy(buf);
      return {
        hdr: { data: npy.data, shape: npy.shape, dtype: npy.dtype },
        meta: data.meta,
      };
    }
  }
}

/**
 * Resolve the OPTIONAL baseline of a raw-buffer (`format`) `image` DataSpec to
 * an SDR `imageUrl`. Decodes the reference blob through the same registry;
 * uint8 baselines become a PNG data URL. A float baseline has no place in the
 * SDR `baselineUrl` string channel, so it resolves to `null`. Returns `null`
 * when there is no `referenceHash`.
 */
async function resolveRawBufferBaseline(
  data: Extract<DataSpec, { kind: "image" }>,
  source: DataSource,
): Promise<string | null> {
  if (!data.referenceHash || !data.format) return null;
  const decoded = await decodeImage({
    bytes: await source.bytes(data.referenceHash),
    ext: data.format,
  });
  return decoded.kind === "u8" ? decodedU8ToDataUrl(decoded) : null;
}
