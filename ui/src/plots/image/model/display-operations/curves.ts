/**
 * The CURVE + REMAP display encodings (Phase 1) — the ~10 tone-map operators
 * migrated from `image/tonemap.ts` (CPU) and `engine/shaders/image.wgsl.ts` /
 * `engine/kernels/prelude.wgsl.ts` (GPU) into registry entries.
 *
 * PARITY BY CONSTRUCTION: each entry carries BOTH its WGSL curve expression and
 * its `cpu` twin, sharing the scalar helpers below. The math is RELOCATED
 * VERBATIM from the pre-registry sources (`reinhardScalar`/`acesScalar`/… are
 * the exact bodies of `tonemap.ts`'s private `reinhardCurve`/`acesCurve` and the
 * exported `extended*Curve`s), so this migration is behavior-identical — pinned
 * by `image/tonemap.test.ts` (CPU) and the GPU↔TS parity harnesses.
 */
import { registerDisplayOperation, clamp01, type DisplayOperation } from "./registry.ts";

// Scalar curve math shared with numerical callers. Registry entries below still
// declare their own scalar CPU/WGSL implementations explicitly.

/** Per-channel Reinhard tone curve: x/(1+x). Maps [0,∞)→[0,1), 1→0.5. */
export function reinhardScalar(x: number): number {
  const v = x < 0 ? 0 : x;
  return v / (1 + v);
}

/** Narkowicz 2015 ACES filmic approximation, per channel, clamped to [0,1]. */
export function acesScalar(x: number): number {
  const v = x < 0 ? 0 : x;
  const num = v * (2.51 * v + 0.03);
  const den = v * (2.43 * v + 0.59) + 0.14;
  return clamp01(num / den);
}

/** The WGSL curve expression the shader's default `applyOperator` fall-through
 *  returns (`linear`/`srgb`/`gamma` — the RANGE-MAP clamp; the transfer lives in
 *  the output-encode stage). Entries equal to this are covered by the default and
 *  emit no explicit dispatch branch — reproducing the pre-registry shaders exactly. */
export const DEFAULT_CLAMP_WGSL = "clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0))";

// Curves apply per-channel to the first up-to-4 channels — but the operator
// stage always sees an rgb triple (the pipeline packs the selected channels
// into rgb upstream), so the arities are declared metadata (Phase-3 gating).
const CURVE_ARITIES = [1, 2, 3, 4];

/** Build the CPU triple by applying a per-channel scalar curve to v[0..2]. */
function perChannelOperation(
  definition: Omit<DisplayOperation, "cpu" | "wgsl" | "channel"> & {
    channel: NonNullable<DisplayOperation["channel"]>;
  },
): DisplayOperation {
  const { channel, ...metadata } = definition;
  return {
    ...metadata,
    channel,
    wgsl: `vec3<f32>(${["rgb.x", "rgb.y", "rgb.z"].map((x) => channel.wgsl.split("$value").join(x)).join(", ")})`,
    cpu: (values, _channels, params) => [
      channel.cpu(values[0] ?? 0, params),
      channel.cpu(values[1] ?? 0, params),
      channel.cpu(values[2] ?? 0, params),
    ],
  };
}

// ---------------------------------------------------------------------------
// Entries. operatorId values are STABLE (baked into image.wgsl.ts's uniform doc
// + assembled dispatch + OPERATOR_ID); do not renumber. Registration order is
// chosen so `image/tonemap.ts`'s `TONEMAP_OPERATORS` (built from the non-peak
// entries) comes out in its historical key order.
// ---------------------------------------------------------------------------

const linear = perChannelOperation({
  id: "linear",
  label: "Linear",
  kind: "curve",
  arities: CURVE_ARITIES,
  params: ["exposure", "offset", "peak"],
  operatorId: 0,
  channel: {
    wgsl: "min(max($value, 0.0), max(peak, 1e-6))",
    cpu: (value, params) => Math.min(Math.max(value, 0), Math.max(params.peak, 1e-6)),
  },
});

const srgb = perChannelOperation({
  id: "srgb",
  label: "sRGB",
  kind: "curve",
  arities: CURVE_ARITIES,
  params: ["exposure", "offset", "peak"],
  operatorId: 1,
  // Identity tone-map: the HDR→[0,1] step is a clamp; the sRGB OETF is applied by
  // the output-encode stage (`tonemap === "srgb"`).
  channel: {
    wgsl: "min(max($value, 0.0), max(peak, 1e-6))",
    cpu: (value, params) => Math.min(Math.max(value, 0), Math.max(params.peak, 1e-6)),
  },
});

const gamma = perChannelOperation({
  id: "gamma",
  label: "Gamma",
  kind: "curve",
  arities: CURVE_ARITIES,
  // Reads γ — the power curve `pow(x,1/γ)` is applied at the output-encode stage
  // (resolveEncodeGamma), the RANGE-MAP here is the same clamp as linear/srgb.
  params: ["exposure", "offset", "gamma", "peak"],
  operatorId: 8,
  channel: {
    wgsl: "min(max($value, 0.0), max(peak, 1e-6))",
    cpu: (value, params) => Math.min(Math.max(value, 0), Math.max(params.peak, 1e-6)),
  },
});

const reinhard = perChannelOperation({
  id: "reinhard",
  label: "Reinhard",
  kind: "curve",
  arities: CURVE_ARITIES,
  params: ["exposure", "offset", "peak"],
  operatorId: 2,
  channel: {
    wgsl: "max($value, 0.0) / (1.0 + max($value, 0.0) / max(peak, 1e-6))",
    cpu: (value, params) => {
      const v = Math.max(value, 0);
      return v / (1 + v / Math.max(params.peak, 1e-6));
    },
  },
});

const aces = perChannelOperation({
  id: "aces",
  label: "ACES",
  kind: "curve",
  arities: CURVE_ARITIES,
  params: ["exposure", "offset", "peak"],
  operatorId: 3,
  channel: {
    wgsl: "max(peak, 1e-6) * clamp((max($value, 0.0) / max(peak, 1e-6)) * (2.51 * (max($value, 0.0) / max(peak, 1e-6)) + 0.03) / ((max($value, 0.0) / max(peak, 1e-6)) * (2.43 * (max($value, 0.0) / max(peak, 1e-6)) + 0.59) + 0.14), 0.0, 1.0)",
    cpu: (value, params) => {
      const peak = Math.max(params.peak, 1e-6);
      const v = Math.max(value, 0) / peak;
      return peak * clamp01((v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14));
    },
  },
});

const normal = perChannelOperation({
  id: "normal",
  label: "Normal map",
  // The remap `(x+1)/2` IS the whole mapping — declares NOTHING, arity 3 only.
  kind: "remap",
  arities: [3],
  params: [],
  operatorId: 9,
  channel: {
    wgsl: "clamp(($value + 1.0) * 0.5, 0.0, 1.0)",
    cpu: (value) => clamp01((value + 1) / 2),
  },
});

/** Registration order → chosen so the non-peak subset yields `TONEMAP_OPERATORS`'
 *  historical key order (linear, srgb, gamma, reinhard, aces, normal, extended). */
export const CURVE_ENCODINGS: DisplayOperation[] = [
  linear,
  srgb,
  gamma,
  reinhard,
  aces,
  normal,
];

let registered = false;
export function registerCurveEncodings(): void {
  if (registered) return;
  registered = true;
  for (const e of CURVE_ENCODINGS) registerDisplayOperation(e);
}
