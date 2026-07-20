/**
 * FLIP (LDR-FLIP) multi-pass diff kernel (spec §FLIP), per Andersson et al.
 * 2020. Numerically mirrors the CPU reference (`flip-reference.ts`) — the two
 * are cross-verified in `engine/__tests__/flip.browser.ts` (GPU vs CPU) and the
 * CPU reference itself against the official `flip-evaluator` package
 * (`flip-reference.test.ts`).
 *
 * ## Pass graph (all intermediates rgba16float, source resolution)
 *   ycxczA / ycxczB : srcA/srcB (sRGB) → YCxCz.
 *   labA   / labB   : ycxcz → per-channel CSF spatial filter → Hunt-CIELAB.
 *   combine         : HyAB color diff (redistributed) ⊕ edge/point feature diff
 *                     on the (unfiltered) achromatic channel → flip ∈ [0,1].
 *
 * The CSF (radius from ppd) and feature (radius from `gw*ppd`) convolutions
 * recompute their Gaussian weights per tap in-shader; only whole-window
 * normalization factors + `cmax` are precomputed on the CPU and passed as
 * uniforms (see `prelude.wgsl.ts`'s SEPARABLE_CONV_NOTE). `displayRange:"unit"`
 * — the output is already in [0,1].
 *
 * ## LDR-FLIP + forced-LDR
 * `flipKernel` assumes sRGB/display-encoded LDR inputs (u8 sources). For FLOAT
 * (HDR) sources the public `flip` mode auto-dispatches to HDR-FLIP
 * (`hdr-flip.ts`) instead; `flipLdrForcedKernel` (public `flip_ldr`) forces the
 * LDR comparison on float sources by clamping the linear values to the display
 * range first (see `YCXCZ_LINEAR_CLAMP_SHADER`). This file also exports the
 * shared LDR pass pieces (`LAB_SHADER`, `COMBINE_SHADER`, filter constants,
 * `buildLdrFlipPasses`) that HDR-FLIP reuses per exposure.
 */
import { VERTEX_WGSL, FLIP_COLOR_WGSL } from "./prelude.wgsl";
import { FLIP_CMAX } from "./flip-reference";
import type { MultipassKernel, KernelPass, KernelBuildCtx } from "./kernel-registry";
import type { BindGroupEntry } from "../types";

const GW = 0.082;

// ---- CPU-side filter constants (match flip-reference.ts) -------------------
export function csfConstants(ppd: number): { r: number; deltaX: number; sums: [number, number, number] } {
  const a1 = [1.0, 1.0, 34.1];
  const b1 = [0.0047, 0.0053, 0.04];
  const a2 = [0.0, 0.0, 13.5];
  const b2 = [1e-5, 1e-5, 0.025];
  const maxScale = Math.max(...b1, ...b2);
  const r = Math.ceil(3 * Math.sqrt(maxScale / (2 * Math.PI ** 2)) * ppd);
  const deltaX = 1 / ppd;
  const pi2 = Math.PI ** 2;
  const sums: [number, number, number] = [0, 0, 0];
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const z = (x * deltaX) ** 2 + (y * deltaX) ** 2;
      for (let c = 0; c < 3; c++) {
        sums[c] +=
          a1[c]! * Math.sqrt(Math.PI / b1[c]!) * Math.exp((-pi2 * z) / b1[c]!) +
          a2[c]! * Math.sqrt(Math.PI / b2[c]!) * Math.exp((-pi2 * z) / b2[c]!);
      }
    }
  }
  return { r, deltaX, sums };
}

export function featureConstants(ppd: number): { r: number; sd: number; edgeNorm: number; pointPos: number; pointNeg: number } {
  const sd = 0.5 * GW * ppd;
  const r = Math.ceil(3 * sd);
  let edgePos = 0;
  let pointPos = 0;
  let pointNeg = 0;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const g = Math.exp(-(x * x + y * y) / (2 * sd * sd));
      const e = -x * g;
      const p = ((x * x) / (sd * sd) - 1) * g;
      if (e > 0) edgePos += e;
      if (p > 0) pointPos += p;
      else pointNeg -= p;
    }
  }
  return { r, sd, edgeNorm: edgePos, pointPos, pointNeg };
}

// ---- WGSL pass shaders -----------------------------------------------------
const YCXCZ_SHADER = `
${VERTEX_WGSL}
${FLIP_COLOR_WGSL}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_rgb2ycxcz(s.rgb), 1.0);
}
`;

// Forced-LDR-on-float front-end: the source is LINEAR float (not sRGB), so we
// tone-map with the default srgb operator = clamp to [0,1] then (implicitly)
// sRGB-encode-for-display. LDR-FLIP would sRGB-DECODE its input, so encode∘decode
// cancels and the net linear value entering YCxCz is exactly `clamp(linear,0,1)`
// — i.e. compare what the two HDR images look like once clipped to the display.
export const YCXCZ_LINEAR_CLAMP_SHADER = `
${VERTEX_WGSL}
${FLIP_COLOR_WGSL}
@group(0) @binding(0) var src: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0);
  return vec4<f32>(flip_linrgb2ycxcz(clamp(s.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
}
`;

export const LAB_SHADER = `
${VERTEX_WGSL}
${FLIP_COLOR_WGSL}
@group(0) @binding(0) var ycxcz: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_csf0: vec4<f32>; // deltaX, r, sumA, sumRG
@group(0) @binding(8) var<uniform> u_csf1: vec4<f32>; // sumBY, 0, 0, 0

const A1 = vec3<f32>(1.0, 1.0, 34.1);
const B1 = vec3<f32>(0.0047, 0.0053, 0.04);
const A2 = vec3<f32>(0.0, 0.0, 13.5);
const B2 = vec3<f32>(1e-5, 1e-5, 0.025);
const PI = 3.14159265358979;

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(ycxcz));
  let px = vec2<i32>(in.position.xy);
  let deltaX = u_csf0.x;
  let r = i32(u_csf0.y);
  let sums = vec3<f32>(u_csf0.z, u_csf0.w, u_csf1.x);
  let pi2 = PI * PI;
  var acc = vec3<f32>(0.0);
  for (var dy = -r; dy <= r; dy = dy + 1) {
    for (var dx = -r; dx <= r; dx = dx + 1) {
      let sx = clamp(px.x + dx, 0, dims.x - 1);
      let sy = clamp(px.y + dy, 0, dims.y - 1);
      let v = textureLoad(ycxcz, vec2<i32>(sx, sy), 0).rgb;
      let z = f32(dx * dx) * deltaX * deltaX + f32(dy * dy) * deltaX * deltaX;
      let w = A1 * sqrt(PI / B1) * exp(-pi2 * z / B1) + A2 * sqrt(PI / B2) * exp(-pi2 * z / B2);
      acc = acc + (w / sums) * v;
    }
  }
  let lin = clamp(flip_ycxcz2linrgb(acc), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(flip_linrgb2huntlab(lin), 1.0);
}
`;

export const COMBINE_SHADER = `
${VERTEX_WGSL}
@group(0) @binding(0) var labA: texture_2d<f32>;
@group(0) @binding(3) var labB: texture_2d<f32>;
@group(0) @binding(6) var ycxczA: texture_2d<f32>;
@group(0) @binding(9) var ycxczB: texture_2d<f32>;
@group(0) @binding(14) var<uniform> u0: vec4<f32>; // cmax, sd, rF, edgeNorm
@group(0) @binding(17) var<uniform> u1: vec4<f32>; // pointPos, pointNeg, 0, 0

const QC = 0.7;
const PC = 0.4;
const PT = 0.95;
const QF = 0.5;

fn hyab(l1: vec3<f32>, l2: vec3<f32>) -> f32 {
  let d = l1 - l2;
  return abs(d.x) + sqrt(d.y * d.y + d.z * d.z);
}

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(labA));
  let px = vec2<i32>(in.position.xy);

  // --- color difference (HyAB, redistributed) ---
  let la = textureLoad(labA, px, 0).rgb;
  let lb = textureLoad(labB, px, 0).rgb;
  let cmax = u0.x;
  let pccmax = PC * cmax;
  let power = pow(hyab(la, lb), QC);
  var deltaEc: f32;
  if (power < pccmax) {
    deltaEc = (PT / pccmax) * power;
  } else {
    deltaEc = PT + ((power - pccmax) / (cmax - pccmax)) * (1.0 - PT);
  }

  // --- feature difference (edge/point on unfiltered achromatic channel) ---
  let sd = u0.y;
  let rF = i32(u0.z);
  let edgeNorm = u0.w;
  let pointPos = u1.x;
  let pointNeg = u1.y;
  var exR = 0.0; var eyR = 0.0; var pxR = 0.0; var pyR = 0.0;
  var exT = 0.0; var eyT = 0.0; var pxT = 0.0; var pyT = 0.0;
  for (var dy = -rF; dy <= rF; dy = dy + 1) {
    for (var dx = -rF; dx <= rF; dx = dx + 1) {
      let sx = clamp(px.x + dx, 0, dims.x - 1);
      let sy = clamp(px.y + dy, 0, dims.y - 1);
      let yr = (textureLoad(ycxczA, vec2<i32>(sx, sy), 0).x + 16.0) / 116.0;
      let yt = (textureLoad(ycxczB, vec2<i32>(sx, sy), 0).x + 16.0) / 116.0;
      let fx = f32(dx); let fy = f32(dy);
      let g = exp(-(fx * fx + fy * fy) / (2.0 * sd * sd));
      // edge (1st deriv), pos/neg symmetric -> single norm
      let ex = (-fx * g) / edgeNorm;
      let ey = (-fy * g) / edgeNorm;
      // point (2nd deriv), pos/neg separate norm
      let pRawX = (fx * fx / (sd * sd) - 1.0) * g;
      let pRawY = (fy * fy / (sd * sd) - 1.0) * g;
      let pxw = select(pRawX / pointNeg, pRawX / pointPos, pRawX > 0.0);
      let pyw = select(pRawY / pointNeg, pRawY / pointPos, pRawY > 0.0);
      exR = exR + ex * yr; eyR = eyR + ey * yr; pxR = pxR + pxw * yr; pyR = pyR + pyw * yr;
      exT = exT + ex * yt; eyT = eyT + ey * yt; pxT = pxT + pxw * yt; pyT = pyT + pyw * yt;
    }
  }
  let edgesR = sqrt(exR * exR + eyR * eyR);
  let edgesT = sqrt(exT * exT + eyT * eyT);
  let pointsR = sqrt(pxR * pxR + pyR * pyR);
  let pointsT = sqrt(pxT * pxT + pyT * pyT);
  let df = max(abs(edgesR - edgesT), abs(pointsR - pointsT));
  let deltaEf = pow((1.0 / sqrt(2.0)) * df, QF);

  let flip = pow(deltaEc, 1.0 - deltaEf);
  return vec4<f32>(flip, flip, flip, 1.0);
}
`;

export function u(binding: number, arr: number[]): BindGroupEntry {
  return { binding, resource: { uniform: new Float32Array(arr) } };
}

/** Per-pass uniform builders for LAB (CSF-filter) and COMBINE passes, shared by
 *  LDR-FLIP (this file) and HDR-FLIP (`hdr-flip.ts`, per-exposure). */
export function labUniforms(csf: ReturnType<typeof csfConstants>): (BindGroupEntry)[] {
  return [u(1, [csf.deltaX, csf.r, csf.sums[0], csf.sums[1]]), u(2, [csf.sums[2], 0, 0, 0])];
}
export function combineUniforms(feat: ReturnType<typeof featureConstants>): BindGroupEntry[] {
  return [u(4, [FLIP_CMAX, feat.sd, feat.r, feat.edgeNorm]), u(5, [feat.pointPos, feat.pointNeg, 0, 0])];
}

/**
 * Build the LDR-FLIP pass graph for one already-source-space pair, given the
 * front-end YCxCz shader (`ycxczShader`) that maps each source to YCxCz. Suffix
 * lets HDR-FLIP instantiate one sub-graph per exposure with unique texture refs;
 * for LDR the suffix is empty. Returns the passes + the ref of the flip output.
 */
export function buildLdrFlipPasses(
  ppd: number,
  ycxczShader: string,
  srcA: string,
  srcB: string,
  suffix = "",
): { passes: KernelPass[]; flipRef: string } {
  const csf = csfConstants(ppd);
  const feat = featureConstants(ppd);
  const yA = `ycxczA${suffix}`;
  const yB = `ycxczB${suffix}`;
  const lA = `labA${suffix}`;
  const lB = `labB${suffix}`;
  const flip = `flip${suffix}`;
  const passes: KernelPass[] = [
    { name: yA, shader: ycxczShader, inputs: [srcA], output: yA },
    { name: yB, shader: ycxczShader, inputs: [srcB], output: yB },
    { name: lA, shader: LAB_SHADER, inputs: [yA], output: lA, uniforms: () => labUniforms(csf) },
    { name: lB, shader: LAB_SHADER, inputs: [yB], output: lB, uniforms: () => labUniforms(csf) },
    {
      name: flip,
      shader: COMBINE_SHADER,
      inputs: [lA, lB, yA, yB],
      output: flip,
      uniforms: () => combineUniforms(feat),
    },
  ];
  return { passes, flipRef: flip };
}

export const flipKernel: MultipassKernel = {
  kind: "multipass",
  id: "flip",
  label: "FLIP (perceptual)",
  publicName: "flip",
  displayRange: "unit",
  params: { ppd: 67 },
  buildPasses(ctx: KernelBuildCtx): { passes: KernelPass[]; final: string } {
    const ppd = ctx.params.ppd ?? 67;
    const { passes, flipRef } = buildLdrFlipPasses(ppd, YCXCZ_SHADER, "srcA", "srcB");
    return { passes, final: flipRef };
  },
};

/**
 * Forced-LDR FLIP for FLOAT sources (`flip_ldr` on HDR sources; spec addendum).
 * Identical to LDR-FLIP except the front-end reads LINEAR float and clamps to
 * [0,1] (the default srgb tone-map operator) instead of sRGB-decoding — see
 * `YCXCZ_LINEAR_CLAMP_SHADER`. On u8 sources the public `flip_ldr` resolves to
 * the plain `flip` kernel instead (auto-dispatch, `kernels/index.ts`), so this
 * kernel only ever runs on float sources.
 */
export const flipLdrForcedKernel: MultipassKernel = {
  kind: "multipass",
  id: "flip-ldr-forced",
  label: "FLIP (LDR forced)",
  publicName: "flip_ldr",
  displayRange: "unit",
  params: { ppd: 67 },
  buildPasses(ctx: KernelBuildCtx): { passes: KernelPass[]; final: string } {
    const ppd = ctx.params.ppd ?? 67;
    const { passes, flipRef } = buildLdrFlipPasses(ppd, YCXCZ_LINEAR_CLAMP_SHADER, "srcA", "srcB");
    return { passes, final: flipRef };
  },
};
