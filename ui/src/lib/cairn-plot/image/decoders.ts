/**
 * `image/decoders.ts` — the multi-format image DECODER layer.
 *
 * Decoders sit UPSTREAM of the render backends and are ORTHOGONAL to display:
 * a small registry normalizes any source (a `url` or raw `bytes` plus an
 * optional `mime`/`ext` hint) into ONE canonical pixel payload — a
 * {@link DecodedImage} — that the CPU/GPU image backends already consume:
 *   - `kind: "u8"`  feeds the SDR path (8-bit, the `imageUrl`/`ImageData` world).
 *   - `kind: "f32"` feeds the HDR path (float samples, `HdrData`-compatible).
 *
 * The registry is keyed by a normalized {@link ImageFormat}:
 *   - png/jpeg/webp/avif/gif → browser-native decode (`createImageBitmap` →
 *     `ImageData`). AVIF is native in modern Chrome/Firefox/Safari, so no WASM
 *     dependency is bundled for it.
 *   - npy/npz → the pure raw-buffer parsers (`parseNpy`/`parseNpz`). Float
 *     dtypes yield `f32`; `uint8`/`int8`/`bool` yield `u8`.
 *   - exr → the worker-backed full decoder (`decoders/exr-decode.ts`): the
 *     vendored three.js EXR loader (`decoders/vendor/`) covering NONE/RLE/
 *     ZIP(S)/PIZ/PXR24/B44(A)/DWAA/DWAB (+ tiled/multi-part/deep), run OFF the
 *     main thread in a persistent inline Web Worker. Yields `f32` (RGB→3,
 *     RGBA→4, Y/single→1). Falls back to the pure-TS `decoders/exr.ts` reader
 *     (NONE/ZIP/ZIPS) when no Worker is available; genuinely unsupported inputs
 *     surface a clear error.
 *   - unknown → best-effort browser-native decode, else a clear error.
 *
 * Format is sniffed by {@link sniffFormat}: explicit `mime` wins, then `ext`,
 * then magic bytes (PNG/JPEG/GIF/WEBP/AVIF/EXR/NPY/NPZ). The sniffer and the
 * raw-buffer decoders are pure and unit-tested; the browser-native path needs a
 * DOM and is exercised only through the registry-dispatch tests.
 */

// `parse-npy` is a self-contained leaf module — a static import keeps this
// module loadable under Node's type-stripping test runner (see `decoders.test.ts`).
// `parse-npz` pulls the browser `DecompressionStream` inflate path and is loaded
// LAZILY (only when an `.npz` is actually decoded), so the eager module graph —
// and the node-test import — stays DOM-free. `.ts` extensions are required for
// Node's resolver and accepted by tsc (`allowImportingTsExtensions`) + the vite
// bundler.
import { parseNpy, type NpyArray } from "../transforms/parse-npy.ts";
// The EXR slot is the worker-backed dispatcher (`decoders/exr-decode.ts`): it
// runs the FULL vendored decoder (PIZ/PXR24/B44/DWA/… — see
// `decoders/vendor/PROVENANCE.md`) OFF the main thread in a persistent inline
// Web Worker, falling back to the same decoder on the main thread (and, last,
// to the pure-TS `decoders/exr.ts` reader for NONE/ZIP/ZIPS) when a Worker is
// unavailable. The dispatcher's eager module graph is DOM-free (the worker is
// loaded lazily via `?worker&inline`), so the node-test import stays clean.
import { decodeExr } from "./decoders/exr-decode.ts";

// ---------------------------------------------------------------------------
// Canonical payload + source contracts.
// ---------------------------------------------------------------------------

/**
 * The ONE canonical decoded-image payload both image backends consume.
 *  - `u8`  — 8-bit samples for the SDR path. `data` is an `ImageData` (RGBA,
 *    from the browser-native decoders) or a raw `Uint8ClampedArray` (from a
 *    uint8 `.npy`/`.npz`, laid out row-major, `width*height*channels`).
 *  - `f32` — the float/HDR path (`HdrData`-compatible). `channels` is `1` for
 *    `[H,W]`, else the trailing dim of `[H,W,C]`. The `precision` tag says how
 *    to read `data` (F16 pipeline — see `./half.ts`):
 *      - `"f32"`      → `data` is a `Float32Array` of IEEE-754 f32 VALUES.
 *      - `"f16-bits"` → `data` is a `Uint16Array` of raw IEEE-754 binary16 BIT
 *        PATTERNS (2 bytes/sample), kept half-precision through to an
 *        `rgba16float` GPU upload and lazily widened to f32 by CPU consumers.
 *    The `kind` stays `"f32"` for BOTH so every existing `decoded.kind ===
 *    "f32"` branch (the HDR routing seams) keeps working unchanged; consumers
 *    that touch `data` VALUES dispatch on `precision`.
 */
export type DecodedImage =
  | { kind: "u8"; data: Uint8ClampedArray | ImageData; width: number; height: number }
  | {
      kind: "f32";
      data: Float32Array | Uint16Array;
      width: number;
      height: number;
      channels: number;
      precision: import("./half.ts").Precision;
      /**
       * Present ONLY for a DEEP EXR decoded with live-flatten enabled (the
       * single-image depth slider — see `decodeImage(src, { deepLiveFlatten })`).
       * `data` above is the FULL composite (Z ≤ zMax); {@link DeepFlattenController}
       * re-flattens live at a chosen Z cutoff and must be `dispose()`d when the
       * consuming pane unmounts (frees the retained wasm-side handle).
       */
      deep?: DeepFlattenController;
    };

/**
 * Live depth-flatten handle for a DEEP EXR. Retained wasm-side samples are
 * re-composited (front-to-back OVER) at a chosen Z cutoff with no re-decode
 * (sparse files) or a debounce-covered re-decode (dense files) — see
 * `wasm/openexr/src/binding.cpp`. The buffer {@link flatten} returns has the
 * SAME width/height/channels/precision as the initial decode.
 */
export interface DeepFlattenController {
  /** Nearest sample Z (front of the volume). */
  readonly zMin: number;
  /** Farthest sample Z (full composite). */
  readonly zMax: number;
  /** Re-flatten including only samples with Z ≤ `zClip` (CPU/wasm path — the
   *  coalesced fallback for non-WebGPU / CPU-backed panes). */
  flatten(zClip: number): Promise<Float32Array | Uint16Array>;
  /** Export the Z-sorted samples for GPU upload (the real-time GPU depth-
   *  composite path). One round-trip; the GPU then owns the data. */
  getGpuCsr(): Promise<DeepGpuCsrData>;
  /** Release the retained wasm-side handle (idempotent). Call on pane unmount. */
  dispose(): void;
}

/** Z-sorted deep samples for GPU upload (see `wasm/openexr` `DeepGpuCsr`). */
export interface DeepGpuCsrData {
  readonly width: number;
  readonly height: number;
  readonly total: number;
  /** pixels+1 prefix sums. */
  readonly offsets: Uint32Array;
  /** 4·total premultiplied RGBA (one vec4 per sample). */
  readonly colors: Float32Array;
  /** total per-sample Z, ascending within each pixel. */
  readonly zs: Float32Array;
}

/** A decodable image source: a `url`, raw `bytes`, or both, plus format hints. */
export interface ImageSource {
  /** Fetchable URL (browser-native formats decode straight from this). */
  url?: string;
  /** Raw encoded/serialized bytes (required for the npy/npz/exr paths). */
  bytes?: ArrayBuffer;
  /** Explicit MIME type — highest-priority format hint. */
  mime?: string;
  /** File extension or format token (with or without a leading dot). */
  ext?: string;
}

/** The normalized format keys the registry dispatches on. */
export type ImageFormat =
  | "png"
  | "jpeg"
  | "webp"
  | "avif"
  | "gif"
  | "npy"
  | "npz"
  | "exr"
  | "unknown";

/** A decoder: source → canonical {@link DecodedImage}. */
export type ImageDecoder = (src: ImageSource) => Promise<DecodedImage>;

/** Formats decoded from a raw buffer (need `bytes`, not just a `url`). */
const RAW_BUFFER_FORMATS: ReadonlySet<ImageFormat> = new Set<ImageFormat>([
  "npy",
  "npz",
  "exr",
]);

/** Formats the browser can decode natively via `<img>`/`createImageBitmap`. */
const BROWSER_NATIVE_FORMATS: ReadonlySet<ImageFormat> = new Set<ImageFormat>([
  "png",
  "jpeg",
  "webp",
  "avif",
  "gif",
]);

/** True when `fmt` needs raw `bytes` (npy/npz/exr) rather than a plain URL. */
export function isRawBufferFormat(fmt: string): boolean {
  return RAW_BUFFER_FORMATS.has(normalizeFormatToken(fmt));
}

/** True when the browser decodes `fmt` natively (png/jpeg/webp/avif/gif). */
export function isBrowserNativeFormat(fmt: string): boolean {
  return BROWSER_NATIVE_FORMATS.has(normalizeFormatToken(fmt));
}

// ---------------------------------------------------------------------------
// Content-type sniffing: explicit mime → extension → magic bytes → unknown.
// ---------------------------------------------------------------------------

const MIME_TO_FORMAT: Record<string, ImageFormat> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/x-exr": "exr",
  "image/aces": "exr",
  "application/x-npy": "npy",
  "application/npy": "npy",
  "application/x-npz": "npz",
  "application/npz": "npz",
};

const EXT_TO_FORMAT: Record<string, ImageFormat> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  jpe: "jpeg",
  webp: "webp",
  avif: "avif",
  gif: "gif",
  npy: "npy",
  npz: "npz",
  exr: "exr",
};

/** Normalize a raw ext/format token: strip a leading dot + query, lowercase. */
function normalizeFormatToken(token: string): ImageFormat {
  const cleaned = token.trim().toLowerCase().replace(/^\./, "").replace(/[?#].*$/, "");
  return (EXT_TO_FORMAT[cleaned] ?? "unknown") as ImageFormat;
}

/** Pull the extension out of a URL/path (ignoring query + fragment). */
function extFromUrl(url: string): string | null {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  const dot = path.lastIndexOf(".");
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (dot <= slash) return null;
  return path.slice(dot + 1);
}

function matches(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

const NPY_MAGIC = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]; // \x93NUMPY
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38]; // GIF8
const EXR_MAGIC = [0x76, 0x2f, 0x31, 0x01];
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 (npz is a zip)
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // RIFF
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50]; // WEBP (bytes 8..11)
const AVIF_FTYP = [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69]; // "ftypavi" at byte 4

/** Sniff the format from magic bytes alone; `"unknown"` if none match. */
export function sniffMagic(buffer: ArrayBuffer): ImageFormat {
  const n = Math.min(buffer.byteLength, 64);
  const bytes = new Uint8Array(buffer, 0, n);
  if (matches(bytes, 0, NPY_MAGIC)) return "npy";
  if (matches(bytes, 0, PNG_MAGIC)) return "png";
  if (matches(bytes, 0, JPEG_MAGIC)) return "jpeg";
  if (matches(bytes, 0, GIF_MAGIC)) return "gif";
  if (matches(bytes, 0, EXR_MAGIC)) return "exr";
  if (matches(bytes, 0, RIFF_MAGIC) && matches(bytes, 8, WEBP_TAG)) return "webp";
  // AVIF: an ISO-BMFF `ftyp` box with an `avif`/`avis` brand at byte 4.
  if (matches(bytes, 4, AVIF_FTYP)) return "avif";
  if (matches(bytes, 0, ZIP_MAGIC)) return "npz";
  return "unknown";
}

/**
 * Determine a source's {@link ImageFormat}. Priority: explicit `mime`, then
 * `ext` (or the URL's extension), then magic bytes, else `"unknown"`.
 */
export function sniffFormat(src: ImageSource): ImageFormat {
  if (src.mime) {
    const m = src.mime.split(";", 1)[0]!.trim().toLowerCase();
    const fromMime = MIME_TO_FORMAT[m];
    if (fromMime) return fromMime;
  }
  if (src.ext) {
    const fromExt = normalizeFormatToken(src.ext);
    if (fromExt !== "unknown") return fromExt;
  }
  if (src.url) {
    const ext = extFromUrl(src.url);
    if (ext) {
      const fromUrl = normalizeFormatToken(ext);
      if (fromUrl !== "unknown") return fromUrl;
    }
  }
  if (src.bytes) {
    const fromMagic = sniffMagic(src.bytes);
    if (fromMagic !== "unknown") return fromMagic;
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Raw-buffer decode: `.npy` / `.npz` → DecodedImage (pure, unit-tested).
// ---------------------------------------------------------------------------

/** True when a numpy descr string names a uint8/int8/bool (single-byte) dtype. */
function isU8Dtype(dtype: string): boolean {
  const kind = dtype[1]; // '<' | '>' | '|' prefix, then kind char
  const itemsize = dtype.slice(2) || "1";
  return (kind === "u" || kind === "i" || kind === "b") && itemsize === "1";
}

/**
 * Map a parsed numpy array (`[H,W]` grayscale or `[H,W,C]`) to the canonical
 * {@link DecodedImage}. `uint8`/`int8`/`bool` → `u8`; everything else (floats,
 * and wider integers, which `parseNpy` already coerced to `Float64`) → `f32`.
 */
export function npyArrayToDecoded(npy: NpyArray): DecodedImage {
  const { shape, dtype, data } = npy;
  if (shape.length !== 2 && shape.length !== 3) {
    throw new Error(
      `cairn-plot decodeImage: expected a 2D [H,W] or 3D [H,W,C] array, got shape [${shape.join(
        ", ",
      )}]`,
    );
  }
  const height = shape[0]!;
  const width = shape[1]!;
  const channels = shape.length === 3 ? shape[2]! : 1;

  if (isU8Dtype(dtype)) {
    return { kind: "u8", data: Uint8ClampedArray.from(data), width, height };
  }
  // Floats (and any other numeric dtype `parseNpy` coerced to Float64) feed the
  // HDR/float path. `parseNpy` always widens to Float64, so numpy `.npy` arrays
  // are always `precision:"f32"` here; emitting `float16` arrays as `"f16-bits"`
  // is a deferred follow-up (needs a raw-half path in `parseNpy` — see P1 note).
  return { kind: "f32", data: Float32Array.from(data), width, height, channels, precision: "f32" };
}

async function decodeNpy(src: ImageSource): Promise<DecodedImage> {
  const bytes = requireBytes(src, "npy");
  return npyArrayToDecoded(parseNpy(bytes));
}

async function decodeNpz(src: ImageSource): Promise<DecodedImage> {
  const bytes = requireBytes(src, "npz");
  const { parseNpz } = await import("../transforms/parse-npz.ts");
  const members = await parseNpz(bytes);
  const keys = Object.keys(members);
  if (keys.length === 0) throw new Error("cairn-plot decodeImage: empty .npz archive");
  // Prefer a conventionally-named image array, else the first member.
  const key =
    ["image", "img", "data", "arr_0"].find((k) => k in members) ?? keys[0]!;
  return npyArrayToDecoded(members[key]!);
}

function requireBytes(src: ImageSource, fmt: ImageFormat): ArrayBuffer {
  if (!src.bytes) {
    throw new Error(
      `cairn-plot decodeImage: the ${fmt} decoder needs raw bytes (src.bytes), got only a url`,
    );
  }
  return src.bytes;
}

// ---------------------------------------------------------------------------
// Browser-native decode: png/jpeg/webp/avif/gif → ImageData (DOM-only).
// ---------------------------------------------------------------------------

async function decodeBrowserNative(src: ImageSource): Promise<DecodedImage> {
  if (typeof createImageBitmap !== "function") {
    throw new Error(
      "cairn-plot decodeImage: browser-native decode needs a DOM (createImageBitmap unavailable)",
    );
  }
  let blob: Blob;
  if (src.bytes) {
    blob = new Blob([src.bytes], src.mime ? { type: src.mime } : undefined);
  } else if (src.url) {
    const res = await fetch(src.url);
    if (!res.ok) {
      throw new Error(
        `cairn-plot decodeImage: failed to fetch ${src.url} (${res.status})`,
      );
    }
    blob = await res.blob();
  } else {
    throw new Error("cairn-plot decodeImage: source has neither bytes nor url");
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const ctx = get2dContext(width, height);
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    return { kind: "u8", data: imageData, width, height };
  } finally {
    bitmap.close?.();
  }
}

function get2dContext(width: number, height: number): CanvasRenderingContext2D {
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (ctx) return ctx;
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) return ctx;
  }
  throw new Error("cairn-plot decodeImage: no 2D canvas context available");
}

// ---------------------------------------------------------------------------
// The registry + top-level dispatch.
// ---------------------------------------------------------------------------

const REGISTRY: Record<Exclude<ImageFormat, "unknown">, ImageDecoder> = {
  png: decodeBrowserNative,
  jpeg: decodeBrowserNative,
  webp: decodeBrowserNative,
  avif: decodeBrowserNative,
  gif: decodeBrowserNative,
  npy: decodeNpy,
  npz: decodeNpz,
  exr: decodeExr,
};

/** Look up the decoder registered for a sniffed format (`null` for unknown). */
export function getDecoder(fmt: ImageFormat): ImageDecoder | null {
  return fmt === "unknown" ? null : REGISTRY[fmt];
}

/** Options for {@link decodeImage}. */
export interface DecodeImageOptions {
  /**
   * For a DEEP `.exr` source, retain the samples behind a wasm handle and attach
   * a {@link DeepFlattenController} to the result (`decoded.deep`) so a single-
   * image pane can re-flatten live at a Z cutoff (the depth slider). The caller
   * OWNS the handle and MUST `decoded.deep.dispose()` on unmount. Omit (the
   * default) for a one-shot full composite with no retained handle — the right
   * choice for generic/compare callers that never move the slider.
   */
  deepLiveFlatten?: boolean;
}

/**
 * Decode any supported image source into the canonical {@link DecodedImage}.
 * Dispatches through the registry keyed by {@link sniffFormat}. An `"unknown"`
 * format falls back to a best-effort browser-native decode (a URL/bytes the
 * browser can still render), else throws a clear error.
 */
export async function decodeImage(
  src: ImageSource,
  opts?: DecodeImageOptions,
): Promise<DecodedImage> {
  const fmt = sniffFormat(src);
  // The EXR decoder alone honours `deepLiveFlatten` (deep = an EXR feature).
  if (fmt === "exr") return decodeExr(src, opts);
  const decoder = getDecoder(fmt);
  if (decoder) return decoder(src);
  // Unknown: if we have something the browser might render, try it; else fail.
  if (src.url || src.bytes) return decodeBrowserNative(src);
  throw new Error("cairn-plot decodeImage: source has neither bytes nor url");
}

// ---------------------------------------------------------------------------
// DOM helper: turn a decoded u8 payload into a data URL for the SDR
// `imageUrl` prop (used by the DataSpec-resolution seam; DOM-only).
// ---------------------------------------------------------------------------

/**
 * Encode a `u8` {@link DecodedImage} to a PNG `data:` URL for the SDR
 * `imageUrl` prop. Accepts an `ImageData` (RGBA, from the browser-native
 * decoders — pass through its own encode) or a raw `Uint8ClampedArray`
 * (grayscale/packed, from a uint8 `.npy`). DOM-only.
 */
export function decodedU8ToDataUrl(img: Extract<DecodedImage, { kind: "u8" }>): string {
  const imageData =
    img.data instanceof Uint8ClampedArray
      ? packU8ToImageData(img.data, img.width, img.height)
      : img.data;
  if (typeof document === "undefined") {
    throw new Error("cairn-plot decodeImage: data-URL encode needs a DOM (document)");
  }
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("cairn-plot decodeImage: no 2D canvas context for data-URL encode");
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Expand a raw grayscale/packed uint8 buffer into an RGBA `ImageData`. */
function packU8ToImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  const px = width * height;
  const channels = px > 0 ? Math.max(1, Math.floor(data.length / px)) : 1;
  const rgba = new Uint8ClampedArray(px * 4);
  for (let i = 0; i < px; i++) {
    const s = i * channels;
    if (channels === 1) {
      const v = data[s]!;
      rgba[i * 4] = v;
      rgba[i * 4 + 1] = v;
      rgba[i * 4 + 2] = v;
      rgba[i * 4 + 3] = 255;
    } else {
      rgba[i * 4] = data[s]!;
      rgba[i * 4 + 1] = data[s + 1] ?? data[s]!;
      rgba[i * 4 + 2] = data[s + 2] ?? data[s]!;
      rgba[i * 4 + 3] = channels >= 4 ? data[s + 3]! : 255;
    }
  }
  return new ImageData(rgba, width, height);
}
