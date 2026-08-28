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
 *    single shared diff colormap default.
 *  - SPLIT — arity-2 `direct` COMPOSITOR op (Phase 3). Its `wgsl` composites the
 *    two sampled slots by the fragment SCREEN uv against the compositor param
 *    (`u_bind13.x`): split cuts at the divider. Output is LIGHT (`outputArity 3`,
 *    `defaultEncoding srgb`) — displayed as a plain image. Its `cpu` twin reads
 *    the per-frame uv/param context.
 *  - FLIP / HDR-FLIP / SSIM — arity-2 `cached` ops delegating to the matching
 *    multi-pass kernel; all diff ops use the same display default.
 */
import { registerImageOperation, type ImageOperation, type InlineImageOperation } from "./registry.ts";
import { flipProgram, flipLdrForcedProgram } from "../../engine/kernels/flip.wgsl.ts";
import { hdrFlipProgram } from "../../engine/kernels/hdr-flip.ts";
import { ssimProgram } from "../../engine/kernels/ssim.wgsl.ts";
import type { MultipassImageOperationProgram } from "../../engine/operation-pass.ts";

/**
 * IDENTITY — the single-source passthrough. This is "where the source sample
 * enters the display pipeline": its WGSL is the sampled source slot `a` verbatim,
 * and its `cpu` returns the sampled slot's channel vector unchanged. So a pane
 * routing its content through identity renders byte-for-byte as before the
 * registry existed.
 */
const identity: InlineImageOperation = {
  id: "identity",
  label: "Identity",
  inputCount: 1,
  cachePolicy: "never",
  outputArity: "source",
  outputRange: "light",
  params: [],
  // The sampled source enters the display pipeline HERE — passthrough.
  implementation: {
    kind: "inline",
    wgsl: "a",
    cpu: (sources) => sources[0] as number[],
  },
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
  publicName: string,
  range: "R" | "R+",
  wgsl: string,
  f: (a: number, b: number) => number,
): InlineImageOperation {
  return {
    id,
    label,
    publicName,
    inputCount: 2,
    cachePolicy: "never",
    // Scalar-error DISPLAY gating: k=1 → colormaps offered, defaultEncoding
    // applied (the per-channel error vec4 is REDUCED to the scalar the LUT indexes).
    outputArity: 1,
    outputRange: range,
    params: [],
    implementation: {
      kind: "inline",
      wgsl,
      cpu: (sources) => {
        const [a0, a1, a2] = rgb3(sources[0]);
        const [b0, b1, b2] = rgb3(sources[1]);
        return [f(a0, b0), f(a1, b1), f(a2, b2)];
      },
    },
  };
}

const signed = pointwise(
  "signed",
  "Signed Error",
  "signed",
  "R",
  "vec4<f32>(a.rgb - b.rgb, 1.0)",
  (a, b) => a - b,
);

const absolute = pointwise(
  "absolute",
  "Absolute Error",
  "abs",
  "R+",
  "vec4<f32>(abs(a.rgb - b.rgb), 1.0)",
  (a, b) => Math.abs(a - b),
);

const squared = pointwise(
  "squared",
  "Squared Error",
  "square",
  "R+",
  "vec4<f32>((a.rgb - b.rgb) * (a.rgb - b.rgb), 1.0)",
  (a, b) => (a - b) * (a - b),
);

const relativeSigned = pointwise(
  "relative_signed",
  "Relative Signed",
  "rel_signed",
  "R",
  "vec4<f32>((a.rgb - b.rgb) / max(a.rgb, vec3<f32>(1.0 / 255.0)), 1.0)",
  (a, b) => (a - b) / Math.max(a, REL_EPS),
);

const relativeAbsolute = pointwise(
  "relative_absolute",
  "Relative Absolute",
  "rel_abs",
  "R+",
  "vec4<f32>(abs(a.rgb - b.rgb) / max(a.rgb, vec3<f32>(1.0 / 255.0)), 1.0)",
  (a, b) => Math.abs(a - b) / Math.max(a, REL_EPS),
);

const relativeSquared = pointwise(
  "relative_squared",
  "Relative Squared",
  "rel_square",
  "R+",
  "vec4<f32>(((a.rgb - b.rgb) * (a.rgb - b.rgb)) / (max(a.rgb, vec3<f32>(1.0 / 255.0)) * max(a.rgb, vec3<f32>(1.0 / 255.0))), 1.0)",
  (a, b) => {
    const d = a - b;
    const denom = Math.max(a, REL_EPS);
    return (d * d) / (denom * denom);
  },
);

// ---------------------------------------------------------------------------
// COMPOSITOR op (Phase 3) — split. Arity-2 `direct` op that composites the two
// sampled slots into ONE LIGHT value by the fragment SCREEN uv against a
// per-frame compositor param (`u_bind13.x` — the divider position). Unlike a
// diff (a scalar error → colormap), the output is ordinary scene light:
// `outputArity 3`, `outputRange "light"`, `defaultEncoding "srgb"` — the DISPLAY
// stage then applies curves EXACTLY as a plain image (luts gate OFF at k=3 via
// the arity-gating). SLOT CONVENTION matches the diff/routing binding: slot `a`
// = `source` = REFERENCE (texA), slot `b` = `compareSource.b` = FOREGROUND
// (texB) — so split shows the reference LEFT of the divider (`uv.x < param`) and
// the foreground right (`select(b, a, uv.x < param.x)`), byte-identical to
// `GpuComparePane`'s `select(colorB, colorA, uv.x < split)` for a hard split
// (select-then-display == display-then-select). The `cpu` twin mirrors the
// composite (over the SAME uv/param) so the GPU render === the composed twin
// (content-ops harness), for both SDR + HDR surfaces.

/** Build a compositor `direct` op: id, label, the `split` param name, the WGSL
 *  composite EXPRESSION (over `a`,`b`,`uv`,`param`), and the per-texel CPU twin
 *  `(a, b) → composited channel-vector` given the fragment uv + param. */
function compositor(
  id: "split",
  label: string,
  wgsl: string,
  compose: (a: number, b: number, uvx: number, param: number) => number,
): InlineImageOperation {
  return {
    id,
    label,
    inputCount: 2,
    cachePolicy: "never",
    // Light RGB composite: gates as k=3 (curves offered, luts OFF), displayed as
    // a plain image via defaultEncoding srgb.
    outputArity: 3,
    outputRange: "light",
    params: [id],
    implementation: {
      kind: "inline",
      wgsl,
      cpu: (sources, _k, ctx) => {
        const uvx = ctx?.uv[0] ?? 0;
        const param = ctx?.param ?? 0;
        const [a0, a1, a2] = rgb3(sources[0]);
        const [b0, b1, b2] = rgb3(sources[1]);
        return [
          compose(a0, b0, uvx, param),
          compose(a1, b1, uvx, param),
          compose(a2, b2, uvx, param),
        ];
      },
    },
  };
}

const split = compositor(
  "split",
  "Split",
  // Reference (a) LEFT of the divider (uv.x < param), foreground (b) right —
  // matching GpuComparePane's `select(colorB, colorA, uv.x < split)`.
  "select(b, a, uv.x < param.x)",
  (a, b, uvx, param) => (uvx < param ? a : b),
);

/** Build a `cached` metric op delegating to a multi-pass `engine/kernels` kernel. */
function cached(id: string, label: string, program: MultipassImageOperationProgram, publicName?: string): ImageOperation {
  return {
    id,
    label,
    publicName,
    inputCount: 2,
    cachePolicy: "global-lru",
    outputArity: 1, // scalar perceptual error → colormaps offered
    outputRange: "R+",
    params: [],
    implementation: { kind: "multipass", ...program },
  };
}

const flip = cached("flip", "FLIP (perceptual)", flipProgram, "flip");
const hdrFlip = cached("hdr-flip", "HDR-FLIP", hdrFlipProgram);
const flipLdrForced = cached("flip-ldr-forced", "FLIP (LDR forced)", flipLdrForcedProgram, "flip_ldr");
const ssim = cached("ssim", "SSIM", ssimProgram, "ssim");

/** Registration order == menu order: identity, the six pointwise diffs, the
 *  compositor op (split), then the three cached metrics (mirrors
 *  `engine/kernels`' bootstrap order). The DIRECT ops (identity + pointwise +
 *  split) get contiguous dispatch ids (identity → 0) in THIS order. */
export const IMAGE_OPERATIONS: ImageOperation[] = [
  identity,
  absolute,
  signed,
  squared,
  relativeAbsolute,
  relativeSigned,
  relativeSquared,
  split,
  flip,
  hdrFlip,
  flipLdrForced,
  ssim,
];

let registered = false;
export function registerImageOperations(): void {
  if (registered) return;
  registered = true;
  for (const op of IMAGE_OPERATIONS) registerImageOperation(op);
}
