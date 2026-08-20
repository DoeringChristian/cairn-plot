/**
 * The built-in content ops. Mirrors `image/encodings/curves.ts`: each `direct` op
 * carries BOTH its WGSL snippet and its `cpu` twin on one object, so the GPU
 * shader assembly and the CPU pane are the SAME declaration; each `cached` op
 * carries the `engine/kernels` kernel id it delegates to.
 *
 * ## Inventory
 *  - IDENTITY — arity-1 `direct` passthrough (Phase 1).
 *  - SIGNED / ABSOLUTE / SQUARED / RELATIVE-SIGNED / RELATIVE-ABSOLUTE /
 *    RELATIVE-SQUARED — arity-2 `direct` pointwise diffs. Their `wgsl` is the raw
 *    per-channel diff expression over the two sampled slots `a`,`b` (an EXPRESSION,
 *    not the kernel's `fn kernel(...)`), and their `cpu` twin is the per-channel
 *    raw error (the diff pixel-value readout's single source of truth). Ids MATCH
 *    the `engine/kernels` pointwise kernel ids. `defaultEncoding` generalizes the
 *    kernels' per-kernel `defaultColormap` (signed → red-green, magnitude → turbo).
 *  - FLIP / HDR-FLIP / SSIM — arity-2 `cached` ops delegating to the matching
 *    multi-pass kernel; `defaultEncoding` magma (the reference FLIP convention).
 */
import { registerContentOp, type ContentOp, type DirectContentOp, type CachedContentOp } from "./registry.ts";

/**
 * IDENTITY — the single-source passthrough. This is "where the source sample
 * enters the display pipeline": its WGSL is the sampled source slot `a` verbatim,
 * and its `cpu` returns the sampled slot's channel vector unchanged. So a pane
 * routing its content through identity renders byte-for-byte as before the
 * registry existed.
 */
const identity: DirectContentOp = {
  id: "identity",
  label: "Identity",
  sourceArity: 1,
  renderClass: "direct",
  outputArity: "source",
  outputRange: "light",
  defaultEncoding: "srgb",
  params: [],
  // The sampled source enters the display pipeline HERE — passthrough.
  wgsl: "a",
  cpu: (sources) => sources[0] as number[],
};

/** DENOM epsilon for the relative diffs — matches the pointwise kernels'
 *  `max(a, 1/255)` guard (avoids divide-by-zero at black reference). */
const REL_EPS = 1.0 / 255.0;

/** Read the 3 color channels of a sampled slot (missing → 0), matching the WGSL
 *  `.rgb` swizzle the diff expressions operate on. */
function rgb3(v: readonly number[] | undefined): [number, number, number] {
  return [v?.[0] ?? 0, v?.[1] ?? 0, v?.[2] ?? 0];
}

/** Build a pointwise diff `direct` op: id (== kernel id), label, signed vs
 *  magnitude range/default-encoding, the WGSL diff expression, and a per-channel
 *  CPU twin `f(ai, bi)` over the 3 color channels. */
function pointwise(
  id: string,
  label: string,
  range: "R" | "R+",
  wgsl: string,
  f: (a: number, b: number) => number,
): DirectContentOp {
  return {
    id,
    label,
    sourceArity: 2,
    renderClass: "direct",
    // Scalar-error DISPLAY gating: k=1 → colormaps offered, defaultEncoding
    // applied (the per-channel error vec4 is REDUCED to the scalar the LUT indexes).
    outputArity: 1,
    outputRange: range,
    defaultEncoding: range === "R" ? "red-green" : "turbo",
    params: [],
    wgsl,
    cpu: (sources) => {
      const [a0, a1, a2] = rgb3(sources[0]);
      const [b0, b1, b2] = rgb3(sources[1]);
      return [f(a0, b0), f(a1, b1), f(a2, b2)];
    },
  };
}

const signed = pointwise(
  "signed",
  "Signed Error",
  "R",
  "vec4<f32>(a.rgb - b.rgb, 1.0)",
  (a, b) => a - b,
);

const absolute = pointwise(
  "absolute",
  "Absolute Error",
  "R+",
  "vec4<f32>(abs(a.rgb - b.rgb), 1.0)",
  (a, b) => Math.abs(a - b),
);

const squared = pointwise(
  "squared",
  "Squared Error",
  "R+",
  "vec4<f32>((a.rgb - b.rgb) * (a.rgb - b.rgb), 1.0)",
  (a, b) => (a - b) * (a - b),
);

const relativeSigned = pointwise(
  "relative_signed",
  "Relative Signed",
  "R",
  "vec4<f32>((a.rgb - b.rgb) / max(a.rgb, vec3<f32>(1.0 / 255.0)), 1.0)",
  (a, b) => (a - b) / Math.max(a, REL_EPS),
);

const relativeAbsolute = pointwise(
  "relative_absolute",
  "Relative Absolute",
  "R+",
  "vec4<f32>(abs(a.rgb - b.rgb) / max(a.rgb, vec3<f32>(1.0 / 255.0)), 1.0)",
  (a, b) => Math.abs(a - b) / Math.max(a, REL_EPS),
);

const relativeSquared = pointwise(
  "relative_squared",
  "Relative Squared",
  "R+",
  "vec4<f32>(((a.rgb - b.rgb) * (a.rgb - b.rgb)) / (max(a.rgb, vec3<f32>(1.0 / 255.0)) * max(a.rgb, vec3<f32>(1.0 / 255.0))), 1.0)",
  (a, b) => {
    const d = a - b;
    const denom = Math.max(a, REL_EPS);
    return (d * d) / (denom * denom);
  },
);

/** Build a `cached` metric op delegating to a multi-pass `engine/kernels` kernel. */
function cached(id: string, label: string, kernelId: string): CachedContentOp {
  return {
    id,
    label,
    sourceArity: 2,
    renderClass: "cached",
    outputArity: 1, // scalar perceptual error → colormaps offered (magma default)
    outputRange: "R+",
    defaultEncoding: "magma",
    params: [],
    kernelId,
  };
}

const flip = cached("flip", "FLIP (perceptual)", "flip");
const hdrFlip = cached("hdr-flip", "HDR-FLIP", "hdr-flip");
const ssim = cached("ssim", "SSIM", "ssim");

/** Registration order == menu order: identity, the six pointwise diffs, the three
 *  cached metrics (mirrors `engine/kernels`' bootstrap order). */
export const CONTENT_OPS: ContentOp[] = [
  identity,
  absolute,
  signed,
  squared,
  relativeAbsolute,
  relativeSigned,
  relativeSquared,
  flip,
  hdrFlip,
  ssim,
];

let registered = false;
export function registerContentOps(): void {
  if (registered) return;
  registered = true;
  for (const op of CONTENT_OPS) registerContentOp(op);
}
