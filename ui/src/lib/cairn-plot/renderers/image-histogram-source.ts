/**
 * `renderers/image-histogram-source.ts` — build the `HistogramSource` the
 * in-pane histogram overlay bins, from whatever DECODED buffer a pane already
 * holds. ONE place the "channels + raw sample accessor" mapping lives for both
 * backends' both dtypes, so `CpuImagePane` / `GpuImagePane` don't each re-derive
 * channel names or the f16-widening read path.
 *
 * Pure w.r.t. its inputs (it only closes over the passed buffer) — the panes
 * memoize the result on their pixel-data version.
 */
import type { HistogramSource } from "../primitives/ImageInfoPanel";
import type { HistogramChannel } from "./image-histogram.ts";
import { defaultChannelColor } from "./image-histogram.ts";
import type { HdrData } from "./image-backend";
import { shapeDims } from "./image-backend";
import { floatPixelReader } from "../image/pixel-buffer.ts";
import type { DeepGpuCsrData } from "../image/decoders.ts";

/** Channel names for a `C`-channel float source (1→Y, 3→RGB, 4→RGBA, else Ch0…). */
function floatChannelNames(c: number): string[] {
  if (c === 1) return ["Y"];
  if (c === 3) return ["R", "G", "B"];
  if (c === 4) return ["R", "G", "B", "A"];
  return Array.from({ length: c }, (_, i) => `C${i}`);
}

function channelMeta(names: string[]): HistogramChannel[] {
  return names.map((name, i) => ({ name, color: defaultChannelColor(i) }));
}

/**
 * Build a histogram source for a UINT8 (SDR) pane from the RAW-source RGBA
 * `ImageData` the pane already retains for its pixel-value overlay. Channels are
 * R/G/B/A (the extra alpha channel the source carries); samples are 0..255.
 */
export function u8HistogramSource(
  imageData: ImageData | null,
  version: number,
): HistogramSource {
  const width = imageData?.width ?? 0;
  const height = imageData?.height ?? 0;
  return {
    channels: channelMeta(["R", "G", "B", "A"]),
    width,
    height,
    scale: "uint8",
    version,
    readChannel: (pixelIndex, channel) => {
      if (!imageData) return 0;
      return imageData.data[pixelIndex * 4 + channel] ?? 0;
    },
  };
}

/**
 * Build a histogram source for a FLOAT (HDR) pane from its raw `HdrData` buffer
 * (row-major `[H,W,C]`, read per `precision` — f16 bit patterns are widened
 * lazily per sample). Samples are scene values (`unit` scale, 1.0 = SDR white).
 * `getDeepCsr` (DEEP EXR only) enables the per-pixel depth read-out.
 */
export function floatHistogramSource(
  hdr: HdrData,
  version: number,
  getDeepCsr?: () => Promise<DeepGpuCsrData | null>,
): HistogramSource {
  const { h, w, c } = shapeDims(hdr.shape);
  // The self-describing buffer's hoisted reader widens half on the fly.
  const read = floatPixelReader(hdr.pixels);
  return {
    channels: channelMeta(floatChannelNames(c)),
    width: w,
    height: h,
    scale: "unit",
    version,
    readChannel: (pixelIndex, channel) => read(pixelIndex * c + channel),
    getDeepCsr,
  };
}
