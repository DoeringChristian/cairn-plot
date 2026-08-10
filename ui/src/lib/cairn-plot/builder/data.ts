/**
 * Image/float DATA shaping for the JS builder — turns JS image inputs into a
 * `DataSpec` (+ the runtime-store entries the descriptor references by hash),
 * with NO base64. Mirrors the routing of Python's `cp.Image`
 * (`src/cairn_plot/components.py`), JS-idiomatically:
 *
 *  - a numeric buffer (`Float32Array` / `Float64Array` / `Uint16Array` f16 bits
 *    / nested number arrays) → the true float-HDR path: a `RuntimeFloatEntry`
 *    rides BY REFERENCE into the `imagehdr` renderer's `hdr` prop (the same pane
 *    Python's `.npy` baking reaches), zero encode/decode;
 *  - already-encoded container bytes (`ArrayBuffer` / `Uint8Array` + MIME) → a
 *    `RuntimeBytesEntry` served as a `blob:` URL (no base64), 8-bit `image`;
 *  - `ImageData` / `HTMLCanvasElement` / `OffscreenCanvas` → a data URL via the
 *    canvas (the one convenience encode), 8-bit `image`;
 *  - `{ url }` (or a URL string) → a `url` DataSpec verbatim (browser-native) or
 *    the fetch+decode `image.url` seam (`.exr`/`.npy` HDR), by reference.
 */
import { mintRuntimeHash, type RuntimeStoreEntry } from "../viewport/runtime-store.ts";
import { isRawBufferFormat, sniffFormat } from "../image/decoders.ts";
import type { DataSpec } from "../../../plot-descriptor.ts";

export interface ShapedImage {
  data: DataSpec;
  /**
   * True when the AUTHORED INPUT is genuinely float (a `Float32Array`/
   * `Float64Array`/`Uint16Array`-f16 buffer or a nested numeric array) — the
   * only case the builder can be SURE is float without decoding. Drives the
   * authoring-time choice of HDR-style vs display-style config props (§3's
   * "the pane applies what's meaningful"). NOT an extension check: a URL is
   * always `false` here because content decides float-vs-uint8 at decode time
   * (§1), never the caller.
   */
  float: boolean;
  /** Runtime-store entries the descriptor's hash(es) reference. */
  runtime: Array<[string, RuntimeStoreEntry]>;
}

function isTypedFloat(x: unknown): x is Float32Array | Float64Array {
  return x instanceof Float32Array || x instanceof Float64Array;
}

/** Infer `[H,W]`/`[H,W,C]` from a nested JS number array and flatten row-major. */
function flattenNested(arr: unknown[]): { data: Float32Array; shape: number[] } {
  const h = arr.length;
  const row0 = arr[0];
  if (!Array.isArray(row0)) {
    // 1-D is not a valid image; caller should have passed a shape.
    throw new Error("cairnPlot: image(...) numeric array must be 2-D (H×W) or 3-D (H×W×C)");
  }
  const w = row0.length;
  const cell0 = (row0 as unknown[])[0];
  const c = Array.isArray(cell0) ? (cell0 as unknown[]).length : 0;
  const shape = c > 0 ? [h, w, c] : [h, w];
  const size = c > 0 ? h * w * c : h * w;
  const out = new Float32Array(size);
  let k = 0;
  for (let y = 0; y < h; y++) {
    const row = arr[y] as unknown[];
    for (let x = 0; x < w; x++) {
      if (c > 0) {
        const cell = row[x] as unknown[];
        for (let ch = 0; ch < c; ch++) out[k++] = Number(cell[ch]);
      } else {
        out[k++] = Number(row[x]);
      }
    }
  }
  return { data: out, shape };
}

function floatMeta(shape: number[], data: Float32Array | Uint16Array): Record<string, unknown> {
  const channels = shape.length === 2 ? 1 : shape[2] ?? 1;
  let vmin = Infinity;
  let vmax = -Infinity;
  if (data instanceof Float32Array) {
    for (const v of data) {
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
  }
  return {
    shape,
    dtype: data instanceof Uint16Array ? "float16" : "float32",
    channels,
    ...(Number.isFinite(vmin) ? { vmin, vmax } : {}),
  };
}

function hdrEntry(
  data: Float32Array | Uint16Array,
  shape: number[],
): ShapedImage {
  const channels = shape.length === 2 ? 1 : shape[2] ?? 1;
  if (shape.length === 2 || (shape.length === 3 && [1, 3, 4].includes(channels))) {
    // ok
  } else {
    throw new Error(
      `cairnPlot: image(float): shape must be [H,W] or [H,W,C] with C∈{1,3,4}; got [${shape}]`,
    );
  }
  const precision = data instanceof Uint16Array ? "f16-bits" : "f32";
  const dtype = precision === "f16-bits" ? "<f2" : "<f4";
  const hash = mintRuntimeHash();
  return {
    float: true,
    data: { kind: "imghdr", hash, meta: floatMeta(shape, data) },
    runtime: [[hash, { kind: "float", data, shape, dtype, precision }]],
  };
}

function bytesToArrayBuffer(x: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (x instanceof ArrayBuffer) return x;
  // Copy the view's bytes into a fresh ArrayBuffer (handles a `SharedArrayBuffer`
  // backing and any byte offset uniformly).
  const view = new Uint8Array(x.buffer as ArrayBufferLike, x.byteOffset, x.byteLength);
  const out = new Uint8Array(view.byteLength);
  out.set(view);
  return out.buffer;
}

/** Sniff an image container MIME from magic bytes (mirrors Python
 *  `_encode_image_raw`'s sniff). */
function sniffMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return "image/webp";
  return "image/png";
}

function canvasToUrlSpec(canvas: HTMLCanvasElement | OffscreenCanvas): ShapedImage {
  // The one convenience encode (ImageData/canvas → a self-contained data URL).
  const url =
    "toDataURL" in canvas
      ? canvas.toDataURL("image/png")
      : (() => {
          throw new Error(
            "cairnPlot: image(OffscreenCanvas) needs a 2D HTMLCanvasElement; draw it onto a <canvas> first",
          );
        })();
  return { float: false, data: { kind: "url", src: url }, runtime: [] };
}

/** Options accepted by `image()` that affect DATA shaping (renderer config is
 *  handled by the builder). */
export interface ImageDataOpts {
  shape?: number[];
}

/**
 * Shape an `image()` DATA argument into a `DataSpec` + runtime entries. `opts`
 * carries `shape` (required for a flat TypedArray). The float-vs-uint8 codec of
 * a URL/bytes source is the DECODER's decision (content-first, §1), never a
 * caller-visible flag — there is no `hdr` option.
 */
export function shapeImageData(input: unknown, opts: ImageDataOpts = {}): ShapedImage {
  // ── URL / {url} ────────────────────────────────────────────────────────
  const urlStr =
    typeof input === "string"
      ? input
      : input && typeof input === "object" && typeof (input as { url?: unknown }).url === "string"
        ? (input as { url: string }).url
        : null;
  if (urlStr != null) {
    // Route by the ONE format registry (the single source of truth), NOT a local
    // extension set. A raw-buffer format (exr/npy/npz/pfm — plus the fail-loud
    // hdr) can't be `<img>`-decoded, so it takes the client fetch+decode seam
    // (`kind:"image"` + url); the decoder alone decides float-vs-uint8 from the
    // content (§1). Anything else — a browser-native ext OR an unknown/ext-less
    // URL — stays a verbatim `<img>` passthrough (lighter, no fetch, byte-exact).
    if (isRawBufferFormat(sniffFormat({ url: urlStr }))) {
      return { float: false, data: { kind: "image", hash: null, url: urlStr }, runtime: [] };
    }
    return { float: false, data: { kind: "url", src: urlStr }, runtime: [] };
  }

  // ── ImageData ──────────────────────────────────────────────────────────
  if (typeof ImageData !== "undefined" && input instanceof ImageData) {
    const canvas = document.createElement("canvas");
    canvas.width = input.width;
    canvas.height = input.height;
    canvas.getContext("2d")!.putImageData(input, 0, 0);
    return canvasToUrlSpec(canvas);
  }

  // ── canvas ─────────────────────────────────────────────────────────────
  if (typeof HTMLCanvasElement !== "undefined" && input instanceof HTMLCanvasElement) {
    return canvasToUrlSpec(input);
  }

  // ── float buffers (the HDR path) ───────────────────────────────────────
  if (isTypedFloat(input) || input instanceof Uint16Array) {
    if (!opts.shape) {
      throw new Error("cairnPlot: image(TypedArray) requires a { shape: [H, W(, C)] } option");
    }
    const data = input instanceof Float64Array ? Float32Array.from(input) : input;
    return hdrEntry(data as Float32Array | Uint16Array, opts.shape);
  }

  // ── nested numeric array (the HDR path, shape inferred) ────────────────
  if (Array.isArray(input)) {
    const { data, shape } = flattenNested(input);
    return hdrEntry(data, opts.shape ?? shape);
  }

  // ── encoded container bytes ────────────────────────────────────────────
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    const buf = bytesToArrayBuffer(input as ArrayBuffer | ArrayBufferView);
    const mime = sniffMime(new Uint8Array(buf));
    const hash = mintRuntimeHash();
    return {
      float: false,
      data: { kind: "image", hash },
      runtime: [[hash, { kind: "bytes", bytes: buf, mime }]],
    };
  }

  throw new Error(
    "cairnPlot: image(...) accepts a Float32Array/nested numbers (+ shape), ImageData, a canvas, encoded bytes, or { url }",
  );
}
