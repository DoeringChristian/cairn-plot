/**
 * `channel-slice.ts` — FORMAT-AGNOSTIC channel selection: after decode, every
 * image is just an N-channel array, so isolating/recombining channels is a
 * PURE SLICE of the decoded payload — the file type must not matter. EXR is
 * the one exception mechanically (its >4-channel parts cannot survive into the
 * ≤4-channel canonical payload, so its selection happens at decode time), but
 * the INTERFACE is identical: a tree of named channels + a {layer} selection.
 *
 * This module provides the non-EXR half:
 *  - `syntheticChannelTree(source)` — an R/G/B/A-named tree for any decoded
 *    multi-channel source (float payloads by shape; uint8 URLs assumed RGBA),
 *    shaped exactly like the EXR describe tree so the ONE channel menu serves
 *    both.
 *  - `applyChannelSlice(dataProps, layer)` — rewrite `dataProps.source` to the
 *    selected channels: float payloads are sliced in-memory (f32 AND f16-bit
 *    payloads alike); uint8 URLs are re-encoded through a canvas. Runs inside
 *    the leaf's cached resolve, so every selection caches like any decode.
 */
import type { ChannelGroup } from "./channel-groups";
import { floatValues, halfBits, type FloatPixels } from "./pixel-buffer.ts";

const RGBA = ["R", "G", "B", "A"] as const;

interface FloatSourceLike {
  dtype: "float";
  /** The self-describing buffer (every resolved source since the FloatPixels
   *  migration). Sliced REPRESENTATION-PRESERVING: half bits slice as bits. */
  pixels?: FloatPixels;
  /** Legacy wire shape (hand-built descriptors) — kept as the fallback. */
  data?: Float32Array | Uint16Array;
  shape: number[];
  [k: string]: unknown;
}
interface U8SourceLike {
  dtype: "uint8";
  url: string | null;
  [k: string]: unknown;
}
type SourceLike = FloatSourceLike | U8SourceLike;

/** Channel count of a decoded source (uint8 URLs assumed 4 — RGBA canvas). */
function channelCountOf(source: SourceLike): number {
  if (source.dtype === "float") {
    return source.shape.length >= 3 ? source.shape[2]! : 1;
  }
  return source.url ? 4 : 0;
}

/** A synthesized single-part tree with R/G/B/A channel names, shaped like the
 *  EXR describe tree — `null` when there is nothing to select (≤1 channel). */
export function syntheticChannelTree(
  source: SourceLike | null | undefined,
): { parts: Array<{ name: string; index: number; deep: boolean; groups: ChannelGroup[] }> } | null {
  if (!source) return null;
  const n = channelCountOf(source);
  if (n < 2) return null;
  const channels = RGBA.slice(0, Math.min(n, 4)) as unknown as string[];
  return {
    parts: [
      { name: "", index: 0, deep: false, groups: [{ name: "", kind: "color", channels }] },
    ],
  };
}

/** Map a selection's layer (group "", full names, or a combo) to slice indices
 *  against the synthetic RGBA names. `null` = no slice (show everything). */
function sliceIndices(layer: string | string[] | undefined, count: number): number[] | null {
  if (layer == null || layer === "") return null;
  const names = RGBA.slice(0, Math.min(count, 4)) as unknown as string[];
  const list = Array.isArray(layer) ? layer : [layer];
  if (list.length > 3) throw new Error("cairn-plot: a channel combo selects 1..3 channels");
  return list.map((n) => {
    const idx = names.indexOf(n);
    if (idx < 0) throw new Error(`cairn-plot: no channel named "${n}" (channels: ${names.join(", ")})`);
    return idx;
  });
}

function sliceFloat(source: FloatSourceLike, indices: number[]): FloatSourceLike {
  const [h, w] = [source.shape[0]!, source.shape[1]!];
  const c = channelCountOf(source);
  const k = indices.length;
  // The interleaved payload to slice + how to re-wrap the sliced copy. The
  // self-describing `pixels` buffer is the canonical shape (representation
  // preserved: half BITS slice as bits, values as values — same constructor);
  // the legacy `data` field is the hand-built-descriptor fallback.
  const px0 = source.pixels;
  const data: ArrayLike<number> | undefined =
    px0?.kind === "f16-bits" ? px0.bits : px0?.kind === "values" ? px0.values : source.data;
  if (!data) throw new Error("cairn-plot: channel slice found no float payload on the source");
  const out =
    px0?.kind === "f16-bits" || (!px0 && source.data instanceof Uint16Array)
      ? new Uint16Array(w * h * k)
      : px0?.kind === "values" && px0.values instanceof Float64Array
        ? new Float64Array(w * h * k)
        : new Float32Array(w * h * k);
  for (let px = 0; px < w * h; px++) {
    for (let j = 0; j < k; j++) out[px * k + j] = data[px * c + indices[j]!]!;
  }
  const repack = px0
    ? {
        pixels: out instanceof Uint16Array ? halfBits(out) : floatValues(out),
      }
    : { data: out as Float32Array | Uint16Array };
  const next = { ...source, ...repack, shape: [h, w, k] };
  // A sliced frame is a STATIC copy: drop the live deep-flatten controller so
  // the Z-window slider (which would recomposite the full RGBA and silently
  // discard the slice) hides while a channel isolation is active. HOME clears
  // the isolation and restores the live deep view.
  delete (next as Record<string, unknown>).deep;
  return next;
}

/** Slice a uint8 URL through a canvas → a data-URL of the selected channels
 *  (1 channel → grayscale, 2 → padded, 3 → RGB). */
async function sliceU8Url(url: string, indices: number[]): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("cairn-plot: channel slice failed to load image"));
    el.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = im.data;
  for (let px = 0; px < d.length; px += 4) {
    const v = indices.map((i) => d[px + i]!);
    d[px] = v[0]!;
    d[px + 1] = v.length > 1 ? v[1]! : v[0]!;
    d[px + 2] = v.length > 2 ? v[2]! : v.length > 1 ? v[1]! : v[0]!;
    d[px + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Apply a channel selection to a NON-EXR resolved leaf (EXR panes carry
 * `exrTree` and select at decode — callers skip them). Returns `dataProps`
 * unchanged when there is nothing to do.
 */
export async function applyChannelSlice(
  dataProps: Record<string, unknown>,
  layer: string | string[] | undefined,
): Promise<Record<string, unknown>> {
  const source = dataProps.source as SourceLike | undefined;
  if (!source || layer == null) return dataProps;
  const count = channelCountOf(source);
  const indices = sliceIndices(layer, count);
  if (!indices) return dataProps;
  if (source.dtype === "float") {
    return { ...dataProps, source: sliceFloat(source, indices) };
  }
  if (source.url) {
    const url = await sliceU8Url(source.url, indices);
    return { ...dataProps, source: { ...source, url } };
  }
  return dataProps;
}
