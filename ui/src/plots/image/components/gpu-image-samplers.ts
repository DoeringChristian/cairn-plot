/**
 * `renderers/gpu-image-samplers.ts` — the TEV per-pixel value samplers for
 * `GpuImagePane`.
 *
 * The pane retains the CPU-side source buffers the on-hover pixel-value overlay
 * reads (the GPU textures are not read back per hover). This hook owns the three
 * read-only samplers over those retained buffers — one per overlay the pane can
 * show:
 *
 *   - `samplePixel`      — the primary source (a plain image, or the reference
 *                          side of a split composite).
 *   - `sampleDiffPixel`  — the diff readout: a DIRECT op re-runs its `cpu` twin
 *                          over the two raw operands (normalized to the GPU's
 *                          `textureLoad`: uint8 -> /255, float -> raw); a CACHED
 *                          metric reads back its result texture at the result
 *                          stride.
 *   - `sampleForeground` — the foreground operand `b` of a split composite,
 *                          read at ITS OWN grid so per-side pixel numbers land on
 *                          their own texels when the two resolutions differ.
 *
 * Pure over the passed buffers (stable refs) + a few primitives; no engine or
 * pool access, so it is trivially reusable and testable in isolation.
 */
import { useCallback } from "react";
import { floatPixelReader } from "../runtime/pixel-buffer.ts";
import { getImageOperation } from "../definition/image-operations.ts";
import { getCpuImageOperation } from "../cpu/image-operations.ts";
import {
  buildChannelSample,
  type PixelSample,
  type PixelValueNotation,
} from "../../../primitives/components/PixelValueOverlay";
import { shapeDims, type HdrData } from "../runtime/contracts";
import type { ImageSource } from "../definition/content.ts";

/** A retained decoded uint8 RGBA buffer (a source or the reference operand). */
interface U8Buffer {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/** One read-only cell (immutable `current`) — the pane passes its `useRef`s in. */
interface Cell<T> {
  readonly current: T;
}

export interface PixelSamplerInputs {
  hdrMode: boolean;
  naturalDims: { w: number; h: number } | null;
  /** Active LUT id, or null when a curve display operation is active. */
  sdrColormap: string | null;
  /** The concrete diff kernel id (float sources auto-dispatch flip -> hdr-flip). */
  resolvedOperationId: string;
  /** Retained primary buffers (mutually exclusive by `hdrMode`). */
  hdrDataRef: Cell<HdrData | null>;
  sdrImageDataRef: Cell<ImageData | null>;
  /** Retained reference/foreground operand `b` (float vs decoded uint8). */
  refFloatRef: Cell<ImageSource | null>;
  refU8Ref: Cell<U8Buffer | null>;
  /** Cached-metric result readback + its dims (multi-pass diffs only). */
  diffSamplesRef: Cell<Float32Array | null>;
  diffResultDimsRef: Cell<{ w: number; h: number } | null>;
}

export interface PixelSamplers {
  samplePixel: (px: number, py: number, notation: PixelValueNotation) => PixelSample | null;
  sampleDiffPixel: (px: number, py: number, notation: PixelValueNotation) => PixelSample | null;
  sampleForeground: (px: number, py: number, notation: PixelValueNotation) => PixelSample | null;
}

// Per-sample reads go through the SELF-DESCRIBING buffer's hoisted reader
// (`floatPixelReader`) — the representation travels with the bytes, so these
// samplers can never misread bit patterns (image/pixel-buffer.ts).

export function usePixelSamplers(inp: PixelSamplerInputs): PixelSamplers {
  const {
    hdrMode,
    naturalDims,
    sdrColormap,
    resolvedOperationId,
    hdrDataRef,
    sdrImageDataRef,
    refFloatRef,
    refU8Ref,
    diffSamplesRef,
    diffResultDimsRef,
  } = inp;

  const samplePixel = useCallback(
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      if (hdrMode) {
        const hdr = hdrDataRef.current;
        const dims = naturalDims;
        if (!hdr || !dims || px < 0 || py < 0 || px >= dims.w || py >= dims.h) return null;
        const c = hdr.shape.length === 2 ? 1 : (hdr.shape[2] ?? 1);
        const base = (py * dims.w + px) * c;
        const readV = floatPixelReader(hdr.pixels);
        const values = c === 1 ? [readV(base)] : [readV(base), readV(base + 1), readV(base + 2)];
        return buildChannelSample(values, "unit", notation);
      }
      const vd = sdrImageDataRef.current;
      if (!vd || px < 0 || py < 0 || px >= vd.width || py >= vd.height) return null;
      const i = (py * vd.width + px) * 4;
      const r = vd.data[i]!;
      const g = vd.data[i + 1]!;
      const b = vd.data[i + 2]!;
      // A false-colored (colormap) pixel prints one untinted scalar line; an RGB
      // pixel ALWAYS prints three channel lines, even when the channels are equal
      // (a gray pixel is still RGB — never collapse on value equality).
      const single = sdrColormap != null;
      return buildChannelSample(single ? [r] : [r, g, b], "uint8", notation);
    },
    [hdrMode, naturalDims, sdrColormap, hdrDataRef, sdrImageDataRef],
  );

  const sampleDiffPixel = useCallback(
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      const operation = getImageOperation(resolvedOperationId);
      // CACHED metric — the result readback (min-cropped resolution).
      if (operation?.cache === "global-lru") {
        const arr = diffSamplesRef.current;
        const rdims = diffResultDimsRef.current;
        if (!arr || !rdims || px < 0 || py < 0 || px >= rdims.w || py >= rdims.h) return null;
        const base = (py * rdims.w + px) * 4;
        const values =
          operation.output.arity === 1
            ? [arr[base] ?? 0]
            : [arr[base] ?? 0, arr[base + 1] ?? 0, arr[base + 2] ?? 0];
        return buildChannelSample(values, "unit", notation);
      }
      // DIRECT op — the cpu twin over the two source pixels.
      const op = getCpuImageOperation(resolvedOperationId);
      if (!op) return null;
      // Slot A = the primary `source` (normalized to the GPU's textureLoad).
      const readA = (): number[] | null => {
        if (hdrMode) {
          const hdr = hdrDataRef.current;
          const dims = naturalDims;
          if (!hdr || !dims || px < 0 || py < 0 || px >= dims.w || py >= dims.h) return null;
          const c = hdr.shape.length === 2 ? 1 : (hdr.shape[2] ?? 1);
          const b0 = (py * dims.w + px) * c;
          const rd = floatPixelReader(hdr.pixels);
          return c === 1 ? [rd(b0), rd(b0), rd(b0)] : [rd(b0), rd(b0 + 1), rd(b0 + 2)];
        }
        const vd = sdrImageDataRef.current;
        if (!vd || px < 0 || py < 0 || px >= vd.width || py >= vd.height) return null;
        const i = (py * vd.width + px) * 4;
        return [vd.data[i]! / 255, vd.data[i + 1]! / 255, vd.data[i + 2]! / 255];
      };
      // Slot B = the reference `compareSource.b`.
      const readB = (): number[] | null => {
        const fl = refFloatRef.current;
        if (fl && fl.dtype === "float") {
          const { h, w, c } = shapeDims(fl.shape);
          if (px < 0 || py < 0 || px >= w || py >= h) return null;
          const b0 = (py * w + px) * c;
          const rd = floatPixelReader(fl.pixels);
          return c === 1 ? [rd(b0), rd(b0), rd(b0)] : [rd(b0), rd(b0 + 1), rd(b0 + 2)];
        }
        const u8 = refU8Ref.current;
        if (!u8 || px < 0 || py < 0 || px >= u8.width || py >= u8.height) return null;
        const i = (py * u8.width + px) * 4;
        return [u8.data[i]! / 255, u8.data[i + 1]! / 255, u8.data[i + 2]! / 255];
      };
      const a = readA();
      const b = readB();
      if (!a || !b) return null;
      return buildChannelSample(op.evaluate([a, b], 3), "unit", notation);
    },
    [resolvedOperationId, hdrMode, naturalDims, hdrDataRef, sdrImageDataRef, refFloatRef, refU8Ref, diffSamplesRef, diffResultDimsRef],
  );

  const sampleForeground = useCallback(
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      const fl = refFloatRef.current;
      if (fl && fl.dtype === "float") {
        const { h, w, c } = shapeDims(fl.shape);
        if (px < 0 || py < 0 || px >= w || py >= h) return null;
        const b0 = (py * w + px) * c;
        const rd = floatPixelReader(fl.pixels);
        const values = c === 1 ? [rd(b0)] : [rd(b0), rd(b0 + 1), rd(b0 + 2)];
        return buildChannelSample(values, "unit", notation);
      }
      const u8 = refU8Ref.current;
      if (!u8 || px < 0 || py < 0 || px >= u8.width || py >= u8.height) return null;
      const i = (py * u8.width + px) * 4;
      return buildChannelSample([u8.data[i]!, u8.data[i + 1]!, u8.data[i + 2]!], "uint8", notation);
    },
    [refFloatRef, refU8Ref],
  );

  return { samplePixel, sampleDiffPixel, sampleForeground };
}
