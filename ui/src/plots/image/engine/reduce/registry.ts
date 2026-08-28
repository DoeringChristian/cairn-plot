/**
 * GPU REDUCTION FAMILY — the single source of truth for reducing a per-pixel
 * quantity over a texture region down to a handful of scalars on the GPU,
 * mirroring the house registry/family pattern (`engine/kernels`,
 * `image/operations`): ONE shared harness, DECLARED entries, no per-use
 * pipelines. CORE-SAFE — it holds only WGSL strings + pure CPU twins + metadata
 * and imports NO GPU code (exactly like the content-op / encoding registries),
 * so it loads under Node's `--experimental-strip-types` test runner
 * (`registry.test.ts`) and the WebGPU backend (`engine/webgpu/device.ts`)
 * ASSEMBLES its compute pipelines from this module's snippets.
 *
 * ## Why a family (the directive)
 * Every metric SCALAR the compare chip shows used to read a FULL result texture
 * back to CPU and loop in JS: SSIM's mean averaged a ~64MB rgba32float readback
 * (a 4M-iteration JS loop) to produce ONE float, and MSE/MAE ran a fused
 * bespoke compute pass (`shaders/reduce.wgsl.ts`, now folded in here). This
 * family replaces those with a GPU tree-reduce whose readback is a tiny
 * per-workgroup partial buffer (KB, not MB) the host finishes.
 *
 * ## Two declared axes
 *  - {@link ReduceOp} — the COMBINE (the axis the directive calls out as
 *    "declared ops, shared harness"): `sum` / `mean` now; `min` / `max` are a
 *    trivial future entry (declare a combine + identity + finalize — nothing
 *    else changes). NOT speculatively added: nothing consumes them yet.
 *  - {@link ReduceProgram} — the PER-PIXEL VALUE (how many source textures, how
 *    many accumulator lanes, the WGSL snippet + its pure CPU twin): `channel`
 *    (1 texture, 1 lane — the SSIM error mean) and `diffSqAbs` (2 textures, 2
 *    lanes — the fused squared+absolute per-channel diff sums that drive
 *    MSE/MAE/PSNR).
 *
 * ## NaN policy (documented — matches the loops it replaces)
 * `sum`/`mean` COMBINE with `+`, so a single NaN input PROPAGATES to the result
 * (IEEE `NaN + x = NaN`). This is EXACTLY what the loops being replaced did —
 * `meanSsimFromErrorMap`'s `sumErr += s` and `computeMetrics`' `sumSq += d*d`
 * both propagate a NaN sample to the scalar (they only guard `undefined`
 * out-of-range reads with `?? 0`, never NaN). The GPU tree-reduce and the CPU
 * twin here both propagate identically, so parity holds on NaN inputs. (A future
 * `min`/`max` op would have to CHOOSE a NaN policy — WGSL `min`/`max` and JS
 * `Math.min`/`Math.max` differ on NaN — hence NaN handling is per-op, not
 * global; `sum`/`mean` inherit propagation.)
 */

/** Workgroup size of the reduction harness — one tree-reduce per 256 threads. */
export const REDUCE_WORKGROUP_SIZE = 256;

/**
 * A COMBINE op — the reduction's associative operator, its identity element, and
 * the host-side FINALIZE that turns the raw GPU accumulator (a sum/min/max over
 * the region) + the element count into the reported scalar. Declared once; the
 * shared harness (WGSL assembler + the host partial-combine in
 * `engine/webgpu/device.ts`) reads it. `min`/`max` slot in as new entries with
 * no harness change.
 */
export interface ReduceOp {
  /** Stable id — the pipeline-cache key half (`"sum"` | `"mean"`). */
  id: string;
  /** WGSL identity literal for a lane accumulator (`sum`/`mean` → `"0.0"`). */
  wgslIdentity: string;
  /** WGSL combine of two lane exprs `a`,`b` (`sum`/`mean` → `a + b`). */
  wgslCombine(a: string, b: string): string;
  /** Pure CPU identity — used BOTH by the CPU twin reducer and by the host-side
   *  combine of the GPU's per-workgroup partials (they must agree). */
  cpuIdentity: number;
  /** Pure CPU combine — the twin of {@link wgslCombine}. */
  cpuCombine(a: number, b: number): number;
  /** Host FINALIZE: the combined accumulator + region element count → scalar
   *  (`sum` → identity; `mean` → `acc/count`, or `NaN` for an empty region). */
  finalize(acc: number, count: number): number;
}

/**
 * A PER-PIXEL VALUE program — how many source textures it samples, how many
 * accumulator lanes it emits, the WGSL body that writes `vals[0..lanes)` from
 * the sampled texel(s), and the pure CPU twin. The harness reduces each lane
 * INDEPENDENTLY with the chosen {@link ReduceOp}.
 */
export interface ReduceProgram {
  /** Stable id — the other pipeline-cache key half (`"channel"` | `"diffSqAbs"`). */
  id: string;
  /** Number of source textures bound (`t0`, and `t1` when 2). */
  textureArity: 1 | 2;
  /** Number of scalar accumulators reduced in parallel. */
  lanes: number;
  /**
   * WGSL body executed per in-region texel. In scope: `x`,`y` (`i32` texel
   * coords), `dims` (the {@link ReduceDimsParams} uniform — `.channel` for the
   * channel program), the bound textures `t0`(/`t1`), and a mutable
   * `var vals: array<f32, lanes>` pre-seeded to the op identity. Must write
   * `vals[0..lanes)`.
   */
  perPixelWGSL: string;
  /**
   * Pure CPU twin of {@link perPixelWGSL}: given a loader returning the RGBA
   * (4-component) texel of source `i` at `(x,y)` and the params, return the
   * `lanes` per-pixel values. The single source of truth the parity harness
   * asserts the GPU reduction against.
   */
  cpu(load: (i: number, x: number, y: number) => readonly number[], x: number, y: number, params: ReduceParams): number[];
}

/** Runtime params the harness threads to a program (mirrors the GPU `dims` uniform tail). */
export interface ReduceParams {
  /** Channel index the `channel` program reads (0=R). Ignored by `diffSqAbs`. */
  channel?: number;
}

/** The `dims` uniform layout the assembled WGSL declares (std140 16-byte block). */
export interface ReduceDimsParams {
  width: number;
  height: number;
  count: number;
  channel: number;
}

const OPS = new Map<string, ReduceOp>();
const PROGRAMS = new Map<string, ReduceProgram>();

export function registerReduceOp(op: ReduceOp): void {
  if (OPS.has(op.id)) throw new Error(`registerReduceOp: duplicate op id "${op.id}"`);
  OPS.set(op.id, op);
}
export function registerReduceProgram(program: ReduceProgram): void {
  if (PROGRAMS.has(program.id)) throw new Error(`registerReduceProgram: duplicate program id "${program.id}"`);
  PROGRAMS.set(program.id, program);
}
export function getReduceOp(id: string): ReduceOp | undefined {
  return OPS.get(id);
}
export function getReduceProgram(id: string): ReduceProgram | undefined {
  return PROGRAMS.get(id);
}
export function listReduceOps(): ReduceOp[] {
  return Array.from(OPS.values());
}
export function listReducePrograms(): ReduceProgram[] {
  return Array.from(PROGRAMS.values());
}

// ── Declared ops ───────────────────────────────────────────────────────────

// `sum` and `mean` share the GPU/CPU COMBINE (additive) and identity (0); they
// differ ONLY in the host finalize (mean divides by the element count). So the
// GPU never needs a separate "mean" pipeline — mean IS sum + a host divide.
registerReduceOp({
  id: "sum",
  wgslIdentity: "0.0",
  wgslCombine: (a, b) => `${a} + ${b}`,
  cpuIdentity: 0,
  cpuCombine: (a, b) => a + b,
  finalize: (acc) => acc,
});
registerReduceOp({
  id: "mean",
  wgslIdentity: "0.0",
  wgslCombine: (a, b) => `${a} + ${b}`,
  cpuIdentity: 0,
  cpuCombine: (a, b) => a + b,
  finalize: (acc, count) => (count > 0 ? acc / count : NaN),
});

// ── Declared programs ──────────────────────────────────────────────────────

// Single-channel read (drives the SSIM error-map mean: reduce channel 0 of the
// `ssim` RESULT texture, then the caller does `1 - mean`). Dynamic vector index
// `texel[dims.channel]` is valid WGSL (runtime component select).
registerReduceProgram({
  id: "channel",
  textureArity: 1,
  lanes: 1,
  perPixelWGSL: `
    let texel = textureLoad(t0, vec2<i32>(x, y), 0);
    vals[0] = texel[dims.channel];
  `,
  cpu: (load, x, y, params) => [load(0, x, y)[params.channel ?? 0] ?? 0],
});

// Fused per-channel squared + absolute diff of two sources (drives MSE/MAE/PSNR
// via `image-engine.ts`'s `metricsFromSums`). This is the exact per-pixel
// expression the pre-existing bespoke `shaders/reduce.wgsl.ts` computed — folded
// into the family so MSE/MAE are byte-for-byte unchanged while sharing the
// harness. Lane 0 = Σ_c d_c² (RGB); lane 1 = Σ_c |d_c|.
registerReduceProgram({
  id: "diffSqAbs",
  textureArity: 2,
  lanes: 2,
  perPixelWGSL: `
    let a = textureLoad(t0, vec2<i32>(x, y), 0);
    let b = textureLoad(t1, vec2<i32>(x, y), 0);
    let d = a.rgb - b.rgb;
    vals[0] = dot(d, d);
    vals[1] = abs(d.x) + abs(d.y) + abs(d.z);
  `,
  cpu: (load, x, y) => {
    const a = load(0, x, y);
    const b = load(1, x, y);
    const dr = (a[0] ?? 0) - (b[0] ?? 0);
    const dg = (a[1] ?? 0) - (b[1] ?? 0);
    const db = (a[2] ?? 0) - (b[2] ?? 0);
    return [dr * dr + dg * dg + db * db, Math.abs(dr) + Math.abs(dg) + Math.abs(db)];
  },
});

// ── Shared harness ─────────────────────────────────────────────────────────

/**
 * Assemble the complete WGSL compute module for a `(program, op)` pair — the ONE
 * harness every reduction pipeline is built from. Binding layout: textures at
 * `0..arity-1`, the per-workgroup partial storage at `arity`, the `dims` uniform
 * at `arity+1` (so the backend derives the bind-group layout from `arity`
 * alone). Each of the program's `lanes` gets its own workgroup-shared array and
 * an independent barrier-synchronized tree reduce down to `partial[wgid*lanes +
 * lane]`; the host then combines the `numWorkgroups` partials per lane and
 * applies `op.finalize`.
 */
export function assembleReduceWGSL(program: ReduceProgram, op: ReduceOp): string {
  const arity = program.textureArity;
  const lanes = program.lanes;
  const storageBinding = arity;
  const uniformBinding = arity + 1;

  const textureDecls: string[] = [`@group(0) @binding(0) var t0: texture_2d<f32>;`];
  if (arity === 2) textureDecls.push(`@group(0) @binding(1) var t1: texture_2d<f32>;`);

  const sharedDecls: string[] = [];
  const seedShared: string[] = [];
  const combineShared: string[] = [];
  const writePartials: string[] = [];
  const seedVals: string[] = [];
  for (let l = 0; l < lanes; l++) {
    sharedDecls.push(`var<workgroup> shared${l}: array<f32, ${REDUCE_WORKGROUP_SIZE}>;`);
    seedVals.push(`  vals[${l}] = ${op.wgslIdentity};`);
    seedShared.push(`  shared${l}[lid.x] = vals[${l}];`);
    combineShared.push(`      shared${l}[lid.x] = ${op.wgslCombine(`shared${l}[lid.x]`, `shared${l}[lid.x + stride]`)};`);
    writePartials.push(`    partial[wgid.x * ${lanes}u + ${l}u] = shared${l}[0];`);
  }

  return `
const WORKGROUP_SIZE: u32 = ${REDUCE_WORKGROUP_SIZE}u;

${textureDecls.join("\n")}
@group(0) @binding(${storageBinding}) var<storage, read_write> partial: array<f32>;

struct Dims {
  width: u32,
  height: u32,
  count: u32,
  channel: u32,
};
@group(0) @binding(${uniformBinding}) var<uniform> dims: Dims;

${sharedDecls.join("\n")}

@compute @workgroup_size(${REDUCE_WORKGROUP_SIZE})
fn cs_main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(workgroup_id) wgid: vec3<u32>,
) {
  let idx = gid.x;
  var vals: array<f32, ${lanes}>;
${seedVals.join("\n")}
  if (idx < dims.count) {
    let x = i32(idx % dims.width);
    let y = i32(idx / dims.width);
${program.perPixelWGSL}
  }
${seedShared.join("\n")}
  workgroupBarrier();

  var stride = WORKGROUP_SIZE / 2u;
  loop {
    if (stride == 0u) {
      break;
    }
    if (lid.x < stride) {
${combineShared.join("\n")}
    }
    workgroupBarrier();
    stride = stride / 2u;
  }

  if (lid.x == 0u) {
${writePartials.join("\n")}
  }
}
`;
}

/**
 * Pure CPU twin of the whole reduction — the PARITY REFERENCE the harness
 * asserts the GPU against (and the shape the host uses to combine the GPU's
 * per-workgroup partials). Reduces `program`'s per-pixel lanes over the
 * `width*height` region with `op`, then finalizes. `load(i,x,y)` returns source
 * `i`'s RGBA texel.
 */
export function cpuReduce(
  program: ReduceProgram,
  op: ReduceOp,
  load: (i: number, x: number, y: number) => readonly number[],
  width: number,
  height: number,
  params: ReduceParams = {},
): number[] {
  const count = width * height;
  const acc = new Array<number>(program.lanes).fill(op.cpuIdentity);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const vals = program.cpu(load, x, y, params);
      for (let l = 0; l < program.lanes; l++) acc[l] = op.cpuCombine(acc[l]!, vals[l] ?? op.cpuIdentity);
    }
  }
  return acc.map((a) => op.finalize(a, count));
}

/**
 * Fold the GPU's per-workgroup partial buffer (`numWorkgroups * lanes` floats,
 * lane-interleaved) down to the finalized per-lane scalars — the host tail of
 * every reduction, using the SAME `op` combine/finalize as {@link cpuReduce} so
 * GPU and CPU agree. `count` = the region's element count (for `mean`).
 */
export function foldReducePartials(
  partial: Float32Array | number[],
  numWorkgroups: number,
  lanes: number,
  op: ReduceOp,
  count: number,
): number[] {
  const acc = new Array<number>(lanes).fill(op.cpuIdentity);
  for (let wg = 0; wg < numWorkgroups; wg++) {
    for (let l = 0; l < lanes; l++) acc[l] = op.cpuCombine(acc[l]!, partial[wg * lanes + l] ?? op.cpuIdentity);
  }
  return acc.map((a) => op.finalize(a, count));
}
