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
export type ParamName = "exposure" | "offset" | "peak" | "gamma" | "min" | "max" | "norm";

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
 *  peak curves anyway. Callers that read `peak` always pass a real value. */
export const DEFAULT_ENCODE_PARAMS: EncodeParams = { exposure: 0, offset: 0, peak: 4, gamma: 2.2 };

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
