/**
 * The data-source seam for `ViewportModule.useData` implementations.
 *
 * `ViewportModule.useData` turns an already-resolved artifact hash into
 * render-ready `TData` (see `types.ts`'s doc comments). Today the ONLY
 * concrete implementations are app-side (`components/viewport-registry.tsx`'s
 * `useImageData`, `components/PointCloudVisualCard.tsx`'s `usePointCloudData`)
 * and both resolve a hash via the app's `api.artifactUrl` — a dependency
 * cairn-plot itself must NOT import (it would pull the app's API client into
 * a library that's meant to also ship as a standalone Python-emitted bundle,
 * see the cairn-plot design spec's "data-sources" section).
 *
 * This file extracts the PURE hash -> TData mapping cores, parameterized by
 * a small `DataSource` interface, so the app and a future plot bundle share
 * the exact same logic:
 *  - the app passes an ENDPOINT `DataSource` wrapping its own
 *    `api.artifactUrl` (`createEndpointDataSource`, this file's only
 *    implementation today);
 *  - a future plot bundle (Phase B) passes either the SAME kind of ENDPOINT
 *    source (pointed at an absolute server URL) or a LOCAL source that reads
 *    content-addressed blobs baked into the page (a page-level
 *    `window.__cairnPlotStore`, see the design spec's §5) — `DataSource` is
 *    the seam either implementation plugs into; no local provider is wired
 *    up yet (that's Phase B — this file only adds the interface + today's
 *    endpoint impl).
 *
 * BEHAVIOR-PRESERVING: `resolveImageViewportItems`/`fetchPointCloudArrays`
 * are the same logic that lived inline in `viewport-registry.tsx` /
 * `PointCloudVisualCard.tsx`, just parameterized over `source` instead of
 * calling `api.artifactUrl` directly.
 */

import type { ImageOverlayData } from "../types";
import type { ImageViewportItem } from "../host/image-viewport";
import type { ViewportDataArgs, ViewportDataResult } from "../host/types";
import type { RuntimeStoreEntry } from "./runtime-store";
// Explicit `.ts` module path (not the `../transforms` barrel) so this module —
// and its float-decode helpers — load under Node's type-stripping test runner
// (a directory/barrel import is unsupported there); mirrors `image/decoders.ts`.
// `parse-npy` is a self-contained DOM-free leaf, safe as a static import;
// `parse-npz` (the `DecompressionStream` inflate path) is loaded LAZILY at its
// call sites below — again matching `image/decoders.ts` — so the eager module
// graph (and this file's own float-decode unit test) stays clean.
import { parseNpy } from "../transforms/parse-npy.ts";
import type { parseNpz as ParseNpzFn } from "../transforms/parse-npz.ts";

/** Lazily load the `.npz` parser (see the import note above). */
async function loadParseNpz(): Promise<typeof ParseNpzFn> {
  return (await import("../transforms/parse-npz.ts")).parseNpz;
}
import type { PropertyMap } from "../../../engines/three/properties.ts";
import { extractProperties } from "../../../engines/three/properties.ts";
import {
  decodeImage,
  decodedU8ToDataUrl,
  isRawBufferFormat,
  sniffFormat,
  type DecodedImage,
} from "../image/decoders.ts";
import type { CompareFloatSource } from "../media-compare/compositor";
import { floatPixelsFrom } from "../image/pixel-buffer.ts";

/**
 * Resolves a content-addressed artifact hash to fetchable data. Two shapes
 * are needed across today's viewport types:
 *  - `artifactUrl`: hash -> URL (image just needs a URL — no fetch by the
 *    renderer itself, an `<img src>` does the fetching; also usable as a
 *    generic fetch() target);
 *  - `bytes`: hash -> raw bytes (binary parsers — npy/npz — need the actual
 *    payload). Async uniformly: the ENDPOINT implementation fetches over the
 *    network; a future LOCAL implementation resolves synchronously in
 *    practice but still returns a `Promise` so call sites don't branch on
 *    the source kind.
 */
export interface DataSource {
  artifactUrl(hash: string): string;
  bytes(hash: string): Promise<ArrayBuffer>;
  /**
   * OPTIONAL: the in-memory RUNTIME entry for `hash`, when the source keeps a
   * JS-side runtime registry (the LOCAL source does; the ENDPOINT source does
   * not). Present ONLY for JS-authored plots (`window.cairnPlot`), where it lets
   * a resolver hand a `Float32Array`/`ImageData`-derived value straight to a
   * renderer BY REFERENCE — skipping the base64/`.npy` encode the Python-baked
   * path takes. `undefined` (or the method absent) means "not a runtime hash;
   * resolve via `artifactUrl`/`bytes`", so every existing call site is
   * unaffected.
   */
  runtime?(hash: string): RuntimeStoreEntry | undefined;
}

/**
 * The ENDPOINT `DataSource` — wraps an `artifactUrl` formatter (the app's
 * `api.artifactUrl`, or an absolute `${server}/api/artifacts/${hash}`
 * builder for the future plot-bundle ENDPOINT mode) and derives `bytes`
 * from it via a plain `fetch()`. This is the app's default (and, today,
 * only) `DataSource` — behavior-identical to the pre-extraction inline
 * `api.artifactUrl(...)` / `fetch(api.artifactUrl(...))` call sites.
 */
export function createEndpointDataSource(
  artifactUrl: (hash: string) => string,
  options: { fetch?: typeof fetch; requestInit?: RequestInit } = {},
): DataSource {
  const fetchArtifact = options.fetch ?? fetch;
  return {
    artifactUrl,
    async bytes(hash: string): Promise<ArrayBuffer> {
      const res = await fetchArtifact(artifactUrl(hash), options.requestInit);
      if (!res.ok) {
        throw new Error(`failed to fetch artifact ${hash} (${res.status})`);
      }
      return res.arrayBuffer();
    },
  };
}

// ---------------------------------------------------------------------------
// image — pure, synchronous hash -> ImageViewportItem mapping (no network:
// `DataSource.artifactUrl` is a plain string formatter). Mirrors
// `viewport-registry.tsx`'s pre-extraction `useImageData` body exactly;
// `parseOverlay` is passed in rather than imported here since it's app-owned
// (`viewport-registry.tsx`, reused by `VisualContentCard.tsx`) and has no
// dependency of its own on `api.artifactUrl` that needs extracting.
// ---------------------------------------------------------------------------
export function resolveImageViewportItems(
  args: Pick<ViewportDataArgs, "hashes" | "referenceHashes" | "metadata">,
  source: DataSource,
  parseOverlay: (raw: string | null | undefined) => ImageOverlayData | null,
): ViewportDataResult<ImageViewportItem> {
  const { hashes, referenceHashes, metadata } = args;
  return {
    items: hashes.map((h, i) =>
      h ? { url: source.artifactUrl(h), overlay: parseOverlay(metadata?.[i]) } : null,
    ),
    referenceItems: referenceHashes.map((h) => (h ? { url: source.artifactUrl(h) } : null)),
    isLoading: false,
  };
}

// ---------------------------------------------------------------------------
// HDR/float decode seam — the ONE decode-to-CompareFloatSource core shared by
// the compare DESCRIPTOR resolver (`plot-node.tsx`'s `resolveFrame`) and the
// viewport ADAPTER's float-resolving resolver (`resolveImageViewportItemsAsync`
// below). Both need the SAME "fetch a URL, decode it, and route float samples
// to a `CompareFloatSource` (the GPU/HDR path) vs 8-bit bytes to a browser-
// decodable `imageUrl`" mapping, so it lives here once rather than copy-pasted.
// Pure `image/decoders` + `image/half` types underneath — no `api/*`, no
// react-query — so it stays inside the cairn-plot boundary.
// ---------------------------------------------------------------------------

/** The result of decoding one image source: EITHER a browser-decodable `url`
 *  (the 8-bit `<img>` path) OR a decoded `float` source (EXR / float `.npy`,
 *  the GPU/HDR path). Exactly one is populated. */
export interface ResolvedImageSource {
  /** A browser-decodable URL for the SDR `<img>` path — `null` when the source
   *  decoded to float (`float` is set instead). */
  url: string | null;
  /** Decoded float samples for the GPU/HDR compare path — absent for 8-bit. */
  float?: CompareFloatSource;
}

/**
 * Map an already-DECODED float image → the `CompareFloatSource` the GPU/HDR
 * compare panes upload. Pure and DOM-free (the piece that unit-tests without a
 * browser); `contentKey` is the STABLE diff-cache key (the source URL / store
 * hash, NOT the float bytes). Carries the `precision` tag through so an F16
 * (`f16-bits`) buffer stays half-precision to the `rgba16float` upload.
 */
export function decodedFloatToCompareSource(
  decoded: Extract<DecodedImage, { kind: "f32" }>,
  contentKey: string,
): CompareFloatSource {
  return {
    pixels: floatPixelsFrom(decoded.data, decoded.precision),
    width: decoded.width,
    height: decoded.height,
    channels: decoded.channels,
    contentKey,
  };
}

/**
 * Fetch + decode an image source into a {@link ResolvedImageSource}. Mirrors
 * (and is now consumed by) `plot-node.tsx`'s `resolveFrame` client-decode seam:
 * fetch the bytes (following redirects — the FINAL url is the content key),
 * normalize through `decodeImage` (sniffed by Content-Type → URL ext → magic
 * bytes), and route `f32` → a `CompareFloatSource` (uploaded as
 * `rgba16float`/`rgba32float`, diffing in TRUE float values) vs `u8` → a PNG
 * `data:` URL (the existing texture path). Pass `bytes` to decode an
 * already-fetched buffer (skips the network — the unit-test path). CORS applies
 * to the fetch.
 */
export async function decodeImageSource(input: {
  url?: string;
  bytes?: ArrayBuffer;
  mime?: string;
}): Promise<ResolvedImageSource> {
  let bytes = input.bytes;
  let mime = input.mime;
  let contentKey = input.url ?? "";
  if (!bytes) {
    if (!input.url) {
      throw new Error("cairn-plot: decodeImageSource needs a url or bytes");
    }
    const res = await fetch(input.url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`cairn-plot: failed to fetch image ${input.url} (${res.status})`);
    }
    bytes = await res.arrayBuffer();
    mime = mime ?? res.headers.get("content-type") ?? undefined;
    // The FINAL post-redirect url is the stable diff-cache content key (a live
    // query url that redirects to a content-addressed digest keys on the digest).
    contentKey = res.url || input.url;
  }
  const decoded = await decodeImage({ bytes, url: input.url, mime });
  if (decoded.kind === "f32") {
    return { url: null, float: decodedFloatToCompareSource(decoded, contentKey) };
  }
  return { url: decodedU8ToDataUrl(decoded) };
}

/** True when a `{url, mime}` hint names a RAW-BUFFER image format the browser
 *  can't `<img>`-decode (`.exr` / `.npy` / `.npz`) — i.e. one that must go
 *  through {@link decodeImageSource} (and MAY yield a float source). A
 *  browser-native format (png/jpeg/webp/avif/gif) or an un-sniffable
 *  extension-less URL returns false, so the ordinary `<img>` URL path is left
 *  untouched (no needless re-fetch/re-encode). */
export function isFloatCandidateArtifact(hint: { url?: string; mime?: string }): boolean {
  return isRawBufferFormat(sniffFormat({ url: hint.url, mime: hint.mime }));
}

/**
 * The ASYNC, float-aware counterpart of {@link resolveImageViewportItems}: the
 * SAME hash → `{url, overlay}` mapping, plus — for any pane whose URL/MIME
 * sniffs to a raw-buffer format (`.exr` / float `.npy`) — a fetch (via
 * `source.bytes`, so the endpoint AND local sources both work) + decode through
 * {@link decodeImageSource}, attaching a decoded `float: CompareFloatSource` to
 * the item (and clearing its `url`, since a float buffer has no
 * browser-decodable URL). Browser-native panes (png/jpeg/…) and un-sniffable
 * extension-less URLs pass through UNCHANGED — the exact `{url, overlay}` the
 * sync resolver produces (no extra fetch/decode) — so this is a strict superset
 * a host can adopt to get true-HDR panes/compare with no other change.
 *
 * Detection uses the per-pane `args.mimes`/`args.referenceMimes` (the host's
 * `artifact_mime`) when supplied, else the artifact URL's extension + magic
 * bytes. `isLoading` is false because every decode is awaited before returning.
 */
export async function resolveImageViewportItemsAsync(
  args: Pick<
    ViewportDataArgs,
    "hashes" | "referenceHashes" | "metadata" | "mimes" | "referenceMimes"
  >,
  source: DataSource,
  parseOverlay: (raw: string | null | undefined) => ImageOverlayData | null,
): Promise<ViewportDataResult<ImageViewportItem>> {
  const { hashes, referenceHashes, metadata, mimes, referenceMimes } = args;
  const [items, referenceItems] = await Promise.all([
    Promise.all(
      hashes.map((h, i) =>
        resolveOneImageItem(h, source, mimes?.[i], parseOverlay(metadata?.[i])),
      ),
    ),
    Promise.all(
      referenceHashes.map((h, i) => resolveOneImageItem(h, source, referenceMimes?.[i], null)),
    ),
  ]);
  return { items, referenceItems, isLoading: false };
}

/** Resolve ONE artifact hash to an {@link ImageViewportItem}, decoding a
 *  raw-buffer float artifact (`.exr` / float `.npy`) to a `CompareFloatSource`.
 *  A browser-native / un-sniffable artifact stays the plain `{url, overlay}`
 *  (no fetch). Shared by the foreground + reference passes of
 *  {@link resolveImageViewportItemsAsync}. */
async function resolveOneImageItem(
  hash: string | null,
  source: DataSource,
  mime: string | null | undefined,
  overlay: ImageOverlayData | null,
): Promise<ImageViewportItem | null> {
  if (!hash) return null;
  const url = source.artifactUrl(hash);
  if (!isFloatCandidateArtifact({ url, mime: mime ?? undefined })) return { url, overlay };
  const bytes = await source.bytes(hash);
  const resolved = await decodeImageSource({ url, bytes, mime: mime ?? undefined });
  return resolved.float
    ? { url: null, overlay, float: resolved.float }
    : { url: resolved.url, overlay };
}

// ---------------------------------------------------------------------------
// pointcloud — fetch + parse a single point-cloud artifact. Mirrors
// `PointCloudVisualCard.tsx`'s pre-extraction `fetchPointCloudArrays`
// exactly, just resolving bytes via `source.bytes` instead of
// `fetch(api.artifactUrl(hash))` directly. React-query wiring (caching,
// `isLoading`) stays card-owned (`usePointCloudBlobs`/`usePointCloudData`) —
// this is only the pure fetch+parse core.
// ---------------------------------------------------------------------------
export interface PointCloudArrays {
  data: Float32Array;
  properties: PropertyMap;
}

function looksLikeNpz(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 2) return false;
  const view = new Uint8Array(buf, 0, 2);
  return view[0] === 0x50 && view[1] === 0x4b; // "PK\x03\x04"
}

export async function fetchPointCloudArrays(
  hash: string,
  source: DataSource,
): Promise<PointCloudArrays> {
  const buf = await source.bytes(hash);
  if (looksLikeNpz(buf)) {
    const parseNpz = await loadParseNpz();
    const npz = await parseNpz(buf);
    if (!npz.points) throw new Error("point cloud npz missing 'points'");
    return { data: Float32Array.from(npz.points.data), properties: extractProperties(npz) };
  }
  const parsed = parseNpy(buf);
  // The shared parser returns Float64Array for uniform downstream math;
  // three.js BufferAttributes require Float32Array, so narrow once here.
  return { data: Float32Array.from(parsed.data), properties: {} };
}

// ---------------------------------------------------------------------------
// mesh — fetch + parse a single mesh artifact (G3b). Mirrors
// `MeshVisualCard.tsx`'s pre-extraction `fetchMeshArrays` exactly, just
// resolving bytes via `source.bytes` instead of
// `fetch(api.artifactUrl(hash))` directly. Meshes are always `.npz`
// (positions + faces + optional colors/normals/values), so no `.npy`
// content-sniff branch is needed. React-query wiring stays card-owned; this
// is only the pure fetch+parse core, also driven by the LOCAL plot bundle.
// ---------------------------------------------------------------------------
export interface MeshArrays {
  positions: Float32Array;
  faces: Uint32Array;
  properties: PropertyMap;
  colors: Float32Array | null;
  /** Flat per-FACE RGB(A) (0-1), `(nFaces * 3)` or `(nFaces * 4)`; drives the
   *  viewer's "face-colors" mode. `null` when the blob has no `face_colors`. */
  faceColors: Float32Array | null;
  normals: Float32Array | null;
}

export async function fetchMeshArrays(hash: string, source: DataSource): Promise<MeshArrays> {
  const parseNpz = await loadParseNpz();
  const npz = await parseNpz(await source.bytes(hash));
  if (!npz.positions || !npz.faces) {
    throw new Error("mesh blob missing positions/faces");
  }
  return {
    positions: Float32Array.from(npz.positions.data),
    faces: Uint32Array.from(npz.faces.data),
    properties: extractProperties(npz),
    colors: npz.colors ? Float32Array.from(npz.colors.data) : null,
    faceColors: npz.face_colors ? Float32Array.from(npz.face_colors.data) : null,
    normals: npz.normals ? Float32Array.from(npz.normals.data) : null,
  };
}

// ---------------------------------------------------------------------------
// volume — fetch + parse a single volume artifact (G3b). Mirrors
// `VolumeVisualCard.tsx`'s pre-extraction `fetchVolumeArray` exactly. Returns
// the raw scalar grid as a Float32Array (three.js Data3DTexture needs f32);
// shape/vmin/vmax/spacing/origin/bounds live in the inline `meta`.
// ---------------------------------------------------------------------------
export async function fetchVolumeArray(hash: string, source: DataSource): Promise<Float32Array> {
  const parseNpz = await loadParseNpz();
  const npz = await parseNpz(await source.bytes(hash));
  if (!npz.data) throw new Error("volume artifact is missing its 'data' array");
  // The shared parser returns Float64Array for uniform downstream math;
  // three.js Data3DTexture needs Float32Array, so narrow once here.
  return Float32Array.from(npz.data.data);
}

// ---------------------------------------------------------------------------
// boxes3d — fetch + parse a single boxes artifact (G3b). Mirrors
// `BoxesVisualCard.tsx`'s pre-extraction `fetchBoxesArrays` exactly.
// ---------------------------------------------------------------------------
export interface BoxesArrays {
  mins: Float32Array;
  maxs: Float32Array;
  depth: Float32Array;
  properties: PropertyMap;
}

export async function fetchBoxesArrays(hash: string, source: DataSource): Promise<BoxesArrays> {
  const parseNpz = await loadParseNpz();
  const npz = await parseNpz(await source.bytes(hash));
  if (!npz.mins || !npz.maxs || !npz.depth) {
    throw new Error("boxes blob missing mins/maxs/depth");
  }
  return {
    mins: Float32Array.from(npz.mins.data),
    maxs: Float32Array.from(npz.maxs.data),
    depth: Float32Array.from(npz.depth.data),
    properties: extractProperties(npz),
  };
}
