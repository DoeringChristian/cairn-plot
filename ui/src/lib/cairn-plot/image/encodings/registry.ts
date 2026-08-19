/**
 * DISPLAY-ENCODING REGISTRY (Phase 1 — curves) — the single source of truth for
 * "how do the selected channels become RGB". An `encoding` is a rival,
 * mutually-exclusive answer to that question: a light-curve tone-map operator
 * (aces / reinhard / srgb / …), a data LUT (colormaps — Phase 2), or a remap
 * (normal map). See `docs/plans/2026-08-18-display-encoding-registry.md`.
 *
 * ## The house pattern (mirrors `engine/kernels`)
 * This is the encoding twin of `engine/kernels/kernel-registry.ts`: a
 * CORE-SAFE registry that holds, per encoding, the metadata + a WGSL curve
 * snippet (a string) + a CPU twin (pure math). It pulls NO GPU code — exactly
 * like `kernel-registry.ts` holds WGSL `source` strings + `listDiffMenuModes`
 * without importing the device. The GPU-side consumers (`engine/shaders/
 * image.wgsl.ts`, `engine/kernels/prelude.wgsl.ts`, `engine/image-engine.ts`)
 * ASSEMBLE their operator dispatch from this registry's WGSL (`./wgsl.ts`),
 * mirroring how `diff-engine.ts` composes a kernel's `source` into a pipeline.
 *
 * ## Phase 1 scope (behavior-identical)
 * Only the ~10 existing tone-map operators are migrated (curves + the `normal`
 * remap). The registry's `wgsl`/`cpu` capture the OPERATOR CURVE only — the
 * ℝ³→display-RGB compression/remap stage that today lives in `applyOperator`
 * (GPU) / `applyTonemapOperatorTriple` (CPU). The shared front stage
 * (exposure/offset), the scalar-LUT stage, and the output-encode/transfer stage
 * stay exactly where they are; folding those per-encoding is scheduled for later
 * phases (LUT family, norms/bounds, tonemap.ts absorption). `params` are still
 * DECLARED per-encoding here (the manifest that drives which sliders render in
 * Phase 3) even though Phase 1 consumes exposure/offset/gamma in the shared
 * stages — per the design's "the declaration is per-encoding; the pipeline
 * doesn't care".
 */
import { clamp01 } from "../../util/clamp.ts";

/** A named display parameter an encoding may DECLARE it reads (its slider
 *  manifest — UI gating only in Phase 1; the pipeline reads uniforms directly). */
export type ParamName = "exposure" | "offset" | "peak" | "gamma" | "min" | "max" | "norm" | "reduce";

/**
 * Multi-channel REDUCTION for a DATA (lut) encoding — how ℝᵏ (k>1) collapses to
 * the single scalar the LUT indexes (the follow-up: multi-channel colormaps).
 * NEVER applicable to curves (a light operator maps each channel independently);
 * the reduce lives INSIDE the data encoding, BEFORE {@link computeDataIndex}.
 *   - `luminance` — Rec.709 weighted sum of the first 3 color channels
 *                   (`0.2126 R + 0.7152 G + 0.0722 B`), ignoring alpha; a missing
 *                   color channel (k=2 → B) counts as 0.
 *   - `mean`      — arithmetic mean of the color channels (alpha, the 4th, is
 *                   ignored — so k=4 averages the first 3).
 * k=1 needs no reduction (the scalar IS the channel). Default per k:
 * {@link defaultReduceMode} — luminance for k≥3, mean for k=2.
 */
export type ReduceMode = "luminance" | "mean";

/** Numeric ids the reduce modes pack into the GPU uniform (`u_bind10.x`) and the
 *  WGSL `cairnReduceScalar` dispatch keys on. 0 = identity (k≤1, no reduce).
 *  Stable — do not renumber. */
export const REDUCE_ID: Record<ReduceMode, number> = { luminance: 1, mean: 2 };

/** Rec.709 luminance weights (the `luminance` reduce), applied to color channels
 *  0/1/2. Shared by the CPU twin ({@link reduceToScalar}) and the WGSL twin
 *  (`cairnReduceScalar` in `./wgsl.ts`) so GPU/CPU stay byte-parallel. */
export const REC709_LUMA: readonly [number, number, number] = [0.2126, 0.7152, 0.0722];

/**
 * The COLOR-channel count for a k-channel source (alpha, the 4th channel, is not
 * a color channel and is ignored by every reduction). k∈[1,4] ⇒ `min(k,3)`: a
 * 3-channel RGB has 3 color channels, an RGBA (k=4) has 3 (alpha dropped), a
 * 2-channel has 2, a scalar has 1.
 */
export function colorChannelCount(k: number): number {
  return k < 3 ? k : 3;
}

/**
 * The default reduce mode for a k-channel colormap source: `luminance` for k≥3
 * (RGB/RGBA — perceptual weighting is the sensible default), `mean` for k=2 (no
 * meaningful luma without a blue channel). k≤1 is moot (no reduction). This is
 * the UI seed; the user may override to the other mode.
 */
export function defaultReduceMode(k: number): ReduceMode {
  return k >= 3 ? "luminance" : "mean";
}

/**
 * Collapse a multi-channel sample to the single scalar the LUT indexes — the CPU
 * SOURCE OF TRUTH (WGSL twin: `cairnReduceScalar` in `./wgsl.ts`, kept
 * byte-parallel), applied BEFORE {@link computeDataIndex}. For k≤1 the first
 * channel passes through unchanged (so the pre-follow-up scalar path is
 * bit-identical). For k>1 it reduces the {@link colorChannelCount} color channels
 * per `mode` (alpha ignored): `luminance` = Rec.709 weighted sum (a missing color
 * channel, k=2 → B, counts as 0); `mean` = their arithmetic average.
 */
export function reduceToScalar(v: readonly number[], k: number, mode: ReduceMode): number {
  if (k <= 1) return v[0] ?? 0;
  const cc = colorChannelCount(k);
  if (mode === "luminance") {
    // Rec.709 over channels 0..2; a channel not present (k=2 → index 2) is 0.
    const r = v[0] ?? 0;
    const g = v[1] ?? 0;
    const b = cc >= 3 ? (v[2] ?? 0) : 0;
    return REC709_LUMA[0] * r + REC709_LUMA[1] * g + REC709_LUMA[2] * b;
  }
  // mean over the cc color channels.
  let sum = 0;
  for (let i = 0; i < cc; i++) sum += v[i] ?? 0;
  return sum / cc;
}

/**
 * Nonlinear domain mapping INSIDE a DATA (lut) encoding — the norm (Phase 4).
 * NEVER applicable to curves (a tone-map operator is defined over scene-linear
 * input; log/power before it is illegitimate — see the design doc): the norm
 * lives INSIDE the data encoding, reshaping the normalized LUT index.
 *   - `linear` — identity (the pre-Phase-4 behavior).
 *   - `log`    — a logarithmic squeeze of the [0,1] index; non-positive inputs
 *                clamp to {@link LOG_NORM_EPS} (documented floor convention).
 *   - `power`  — `t^exponent`; the exponent REUSES the `gamma` param slot (free
 *                on the lut path — the scalar short-circuits output-encode), so
 *                Phase 4 adds no new uniform for it (documented reuse).
 */
export type NormMode = "linear" | "log" | "power";

/** Small floor the `log` norm clamps its (normalized) index to, so a
 *  non-positive value maps to the bottom of the ramp rather than -∞. Shared by
 *  the CPU twin ({@link computeDataIndex}) and the WGSL twin (`cairnDataIndex`
 *  in `./wgsl.ts`), so GPU/CPU stay byte-parallel. ln(1e-4) ≈ -9.21. */
export const LOG_NORM_EPS = 1e-4;

/** Numeric ids the norm modes pack into the GPU uniform (`u_bind9.x`) and the
 *  WGSL `cairnDataIndex` dispatch keys on. Stable — do not renumber. */
export const NORM_ID: Record<NormMode, number> = { linear: 0, log: 1, power: 2 };

/** Menu section / structural family of an encoding.
 *  - `curve`: a light tone-map operator over scene-linear input (per-channel).
 *  - `lut`:   a data colormap (Phase 2) — binds a 256×1 texture.
 *  - `remap`: a pure structural remap (the normal map `(x+1)/2`) — declares
 *             nothing, arity 3 only. */
export type EncodingKind = "curve" | "lut" | "remap";

/**
 * The named params an encoding's curve reads at render time. Phase-1 curves read
 * only `peak` (the extended roll-off / managed-clamp ceiling); `exposure`/
 * `offset`/`gamma` are applied by the shared pipeline stages, not the curve. The
 * struct is FIXED (stable layout, unused slots ignored) so a slider drag only
 * updates a uniform — the pipeline is cached and never recompiles (see `./wgsl.ts`).
 */
export interface EncodeParams {
  exposure: number;
  offset: number;
  peak: number;
  gamma: number;
  /**
   * DATA (lut) bounds — the ALTERNATIVE domain parameterization to exposure/
   * offset (bounds-first, data-speak). Active iff BOTH are set: the lut index
   * then becomes the affine `(scalar - min)/(max - min)` INSTEAD of the
   * exposure/offset sensitivity (the two are skins over the same affine — never
   * composed; see the design doc + `computeDataIndex`). Unset (the common case)
   * → the exposure/offset skin, i.e. the pre-Phase-4 behavior. Ignored by
   * curves/remaps.
   */
  min?: number;
  max?: number;
  /** DATA (lut) norm — the nonlinear reshape of the normalized index. Unset =
   *  `"linear"` (identity). `power` reuses `gamma` as its exponent. */
  norm?: NormMode;
  /**
   * DATA (lut) multi-channel REDUCTION — how a k>1 sample collapses to the scalar
   * the LUT indexes (applied BEFORE the norm/bounds). Unset → the k-based default
   * ({@link defaultReduceMode}: luminance for k≥3, mean for k=2). Ignored for
   * k≤1 (the scalar IS the channel) and by curves/remaps.
   */
  reduce?: ReduceMode;
}

/** A single display encoding — the CPU twin (`cpu`) and its WGSL twin (`wgsl`)
 *  live on ONE object so the parity harness is mechanical (iterate + compare). */
export interface DisplayEncoding {
  /** Stable id (== the descriptor `tonemap=`/encoding token). */
  id: string;
  /** Menu label. */
  label: string;
  /** Structural family / menu section. */
  kind: EncodingKind;
  /** Channel arities this encoding supports (runtime state; arity gating is
   *  Phase 3). `normal`: [3]; curves: [1,2,3,4]; luts: [1]. */
  arities: number[];
  /** Requires the pane's real HDR (extended) surface — the `extended*` curves. */
  needsHdrSurface?: boolean;
  /** Param MANIFEST — which named params this encoding reads (slider gating). */
  params: ParamName[];
  /** LUT family binds a 256×1 texture (Phase 2). */
  needsLut?: boolean;
  /**
   * ANALYTIC data encoding (the tev-style signed red-green follow-up) — a
   * `kind:"lut"` DATA encoding whose color is COMPUTED per value (no texture
   * bind: `needsLut` is false, `lutName` absent), so it lives in the COLORMAPS
   * menu section and gates as a data encoding (arity/reduce), but the GPU
   * dispatches {@link signedAnalyticColor}'s WGSL twin instead of sampling a LUT.
   *
   * ## Output treatment (the convention chosen — documented)
   * Unlike a LUT entry (whose `cpu`/family return BAKED display-sRGB written to
   * the surface UNCHANGED), an analytic entry's `cpu`/WGSL return SCENE-LINEAR
   * color that flows through the SHARED output-encode stage — exactly like a
   * curve. So the surface's own encoder decides the range: the SDR path
   * (`outputEncode`) clamps to `[0,1]`, the extended/HDR path
   * (`extendedOutputEncode`) lets values past 1 SURVIVE (unclamped, per W3C
   * ColorWeb-CG). Because the two encoders AGREE on `[0,1]`, an amplitude `|v|≤1`
   * renders identically on both surfaces; only `|v|>1` diverges (HDR keeps the
   * over-range error, SDR clamps). The `cpu` twin therefore returns the LINEAR
   * color (pre-encode), and the parity harness threads it through the SAME
   * `outputEncode`/`extendedOutputEncode` the curves use.
   *
   * ## Norm/bounds/exposure (documented)
   * The analytic map is intrinsically linear in `|v|`, so it declares NEITHER
   * `norm` NOR `min`/`max` (a log/power reshape or a normalize-to-[0,1] bounds
   * affine has no meaning on an unbounded signed diverging map). It DOES declare
   * `exposure`/`offset` (the sensitivity skin — exposure SCALES the amplitude,
   * matching tev applying exposure BEFORE the POS_NEG operator) and `reduce`
   * (collapse a k>1 sample to the signed scalar; tev averages the per-channel
   * difference — `mean` is the tev-faithful reduce, `luminance` the k≥3 default).
   */
  analytic?: boolean;
  /**
   * For `kind:"lut"` encodings: the colormap TABLE id (== a `ColormapName` in
   * `colormaps/lut.ts`) whose 256×4 float LUT the shared LUT shader family binds.
   * The entry references the table by id — it does NOT carry texel data — so
   * every colormap is ONE family parameterized by texture, never a per-colormap
   * pipeline (per the design). Absent on curve/remap entries.
   */
  lutName?: string;
  /**
   * GPU operator id — the uniform value (`u_bind2.y`) the assembled
   * `applyOperator` dispatch and `engine/image-engine.ts`'s `OPERATOR_ID` map
   * both key on. Stable across the codebase (documented in `image.wgsl.ts`).
   */
  operatorId: number;
  /**
   * WGSL curve — an EXPRESSION over `rgb: vec3<f32>` and `peak: f32` evaluating
   * to `vec3<f32>` (the operator applied to the exposure/offset-adjusted,
   * post-scalar-LUT rgb). Assembled into the shared `applyOperator` dispatch by
   * `./wgsl.ts`; may reference the curve helper fns in `CURVE_HELPERS_WGSL`.
   *
   * (Deviation from the design's literal `fn encode(v: vec4f, p: Params) ->
   * vec3f`: an EXPRESSION over `rgb`/`peak` composes cleanly into the ONE curve
   * FAMILY dispatch — curves share a single cached pipeline, unlike per-kernel
   * pipelines — without fn-name collisions, and stays the WGSL twin of `cpu`.)
   */
  wgsl: string;
  /**
   * CPU twin of `wgsl` — the operator curve applied to `v` (the exposure/offset-
   * adjusted rgb), for the first `k` channels. Returns the display triple.
   */
  cpu(v: readonly number[], k: number, p: EncodeParams): [number, number, number];
}

/** Default params for a curve when a caller only cares about the operator (e.g.
 *  the non-peak `TONEMAP_OPERATORS` delegates) — peak defaults are guarded by the
 *  peak curves anyway. Callers that read `peak` always pass a real value. `norm`
 *  defaults to `"linear"` and `min`/`max` are unset, so the pre-Phase-4 lut path
 *  (exposure/offset sensitivity, linear ramp) is reproduced bit-for-bit. */
export const DEFAULT_ENCODE_PARAMS: EncodeParams = {
  exposure: 0,
  offset: 0,
  peak: 4,
  gamma: 2.2,
  norm: "linear",
};

/**
 * Whether an {@link EncodeParams} carries an active DATA-bounds affine — the
 * `min`/`max` skin is engaged iff BOTH are finite numbers. The exposure/offset
 * skin (the default) is used otherwise. Single predicate so the CPU twin, the
 * uniform packer (`image-engine.ts`), and the panes agree on ONE rule (pins the
 * single-application invariant: bounds XOR exposure/offset, never both).
 */
export function boundsActive(p: EncodeParams): boolean {
  return typeof p.min === "number" && Number.isFinite(p.min) && typeof p.max === "number" && Number.isFinite(p.max);
}

/**
 * The DATA (lut) encoding's LUT INDEX from a scalar — the CPU SOURCE OF TRUTH
 * (WGSL twin: `cairnDataIndex` in `./wgsl.ts`, kept byte-parallel). Two stages:
 *
 *  1. AFFINE → normalized index `t`. When {@link boundsActive} (min/max set):
 *     `t = (scalar - min)/(max - min)` (bounds-first skin). Otherwise `t =
 *     scalar` — the caller has ALREADY folded the exposure/offset sensitivity
 *     into `scalar` (the two are skins over the SAME affine; using BOTH would
 *     double-apply, which the UI + `boundsActive` guard prevent).
 *  2. NORM → reshape `t` on the ramp:
 *     - `linear`: `t` unchanged.
 *     - `log`: a log squeeze of `t` clamped to `[LOG_NORM_EPS, 1]` (so any
 *       non-positive value lands at the ramp floor — the documented convention).
 *     - `power`: `clamp01(t)^gamma` — the exponent reuses the `gamma` slot
 *       (free on the lut path); `gamma <= 0` falls back to 1.
 *
 * The result is fed to the LUT sampler, which clamps to `[0,1]` — so `linear`
 * needs no pre-clamp here (matching the pre-Phase-4 `clamp01` at sample time).
 */
export function computeDataIndex(scalar: number, p: EncodeParams): number {
  let t = scalar;
  if (boundsActive(p)) {
    const denom = (p.max as number) - (p.min as number);
    t = denom !== 0 ? (scalar - (p.min as number)) / denom : 0;
  }
  const norm = p.norm ?? "linear";
  if (norm === "log") {
    const tc = t < LOG_NORM_EPS ? LOG_NORM_EPS : t > 1 ? 1 : t;
    return (Math.log(tc) - Math.log(LOG_NORM_EPS)) / (0 - Math.log(LOG_NORM_EPS));
  }
  if (norm === "power") {
    const g = p.gamma > 0 ? p.gamma : 1;
    return Math.pow(clamp01(t), g);
  }
  return t;
}

/**
 * Amplitude gain of the ANALYTIC signed error color (tev's POS_NEG uses `2.0`):
 * the displayed magnitude is `AMPLITUDE * |v|` per lit channel. Shared by the CPU
 * twin ({@link signedAnalyticColor}) and the WGSL twin (`cairnSignedAnalyticColor`
 * in `./wgsl.ts`), so GPU/CPU stay byte-parallel. */
export const SIGNED_ANALYTIC_AMPLITUDE = 2;

/**
 * The tev-style ANALYTIC signed error color — the CPU SOURCE OF TRUTH (WGSL twin:
 * `cairnSignedAnalyticColor` in `./wgsl.ts`, kept byte-parallel). Ports tev's
 * `POS_NEG` tonemap
 * (`vec3(-average(min(col,0))*2, average(max(col,0))*2, 0)`; see
 * github.com/Tom94/tev `src/UberShader.cpp`): a NEGATIVE value (image < reference)
 * → RED, a POSITIVE value (image > reference) → GREEN, blue always 0, amplitude
 * `SIGNED_ANALYTIC_AMPLITUDE * |v|`. Returns SCENE-LINEAR color, UNCLAMPED (values
 * past 1 are legitimate over-range error) — the caller runs it through the shared
 * output-encode stage (see {@link DisplayEncoding.analytic}). The input is the
 * already-reduced, exposure/offset-adjusted signed scalar (the k>1 collapse ran in
 * the `cpu` twin / `cairnReduceScalar` before this).
 */
export function signedAnalyticColor(scalar: number): [number, number, number] {
  const neg = scalar < 0 ? -scalar : 0;
  const pos = scalar > 0 ? scalar : 0;
  return [SIGNED_ANALYTIC_AMPLITUDE * neg, SIGNED_ANALYTIC_AMPLITUDE * pos, 0];
}

const REGISTRY = new Map<string, DisplayEncoding>();

export function registerEncoding(encoding: DisplayEncoding): void {
  if (REGISTRY.has(encoding.id)) {
    throw new Error(`registerEncoding: duplicate encoding id "${encoding.id}"`);
  }
  REGISTRY.set(encoding.id, encoding);
}

export function getEncoding(id: string | undefined | null): DisplayEncoding | undefined {
  return id ? REGISTRY.get(id) : undefined;
}

/** All registered encodings, in registration order. */
export function listEncodings(): DisplayEncoding[] {
  return Array.from(REGISTRY.values());
}

/** Encodings of a given kind (menu section), in registration order. */
export function listEncodingsByKind(kind: EncodingKind): DisplayEncoding[] {
  return listEncodings().filter((e) => e.kind === kind);
}

// Re-export the shared clamp so entry modules import it from one place.
export { clamp01 };
