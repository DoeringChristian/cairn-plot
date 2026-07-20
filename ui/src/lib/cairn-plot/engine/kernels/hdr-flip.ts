/**
 * HDR-FLIP multi-pass diff kernel (spec addendum), per Andersson et al. 2021
 * ("Visualizing Errors in Rendered High Dynamic Range Images"). Numerically
 * mirrors the CPU reference (`hdr-flip-reference.ts`) — the two are
 * cross-verified in `engine/__tests__/hdr-flip.browser.ts` (GPU vs CPU) and the
 * CPU reference itself against the official `flip-evaluator` HDR mode
 * (`hdr-flip-reference.test.ts`).
 *
 * ## Inputs
 * Two LINEAR-RGB float sources (rgba16/32float) — HDR imagery (cp.Image hdr
 * arrays / f32-decoded EXR urls). Auto-dispatched under the public `flip` mode
 * when the compare sources are float (`kernels/index.ts` `resolveDiffKernelId`).
 *
 * ## Pass graph (per exposure, all intermediates rgba16float, source resolution)
 * The exposure RANGE + COUNT are precomputed on the CPU from the reference
 * image's luminance (`computeHdrFlipExposures`, deterministic) and passed in as
 * params (`startExposure`/`stopExposure`/`numExposures`) — they enter the diff
 * cache key. For each exposure c_i:
 *   toneYcxczA/B : src → exposure-compensate (2^c_i) → ACES tone map → linRGB →
 *                  YCxCz  (`TONE_YCXCZ_SHADER`, exposure uniform).
 *   labA/B       : YCxCz → CSF spatial filter → Hunt-CIELAB (shared `LAB_SHADER`).
 *   combine[_max]: HyAB color diff ⊕ edge/point feature diff → LDR-FLIP_i, then
 *                  running per-pixel MAX with the previous exposures' accumulator
 *                  (`COMBINE_MAX_SHADER`; the first exposure uses the plain
 *                  `COMBINE_SHADER`). The last accumulator is the HDR-FLIP map.
 * Output ∈ [0,1] (`displayRange:"unit"`).
 */
import { VERTEX_WGSL, FLIP_COLOR_WGSL } from "./prelude.wgsl";
import { FLIP_CMAX } from "./flip-reference.ts";
import {
  LAB_SHADER,
  COMBINE_SHADER,
  csfConstants,
  featureConstants,
  labUniforms,
  combineUniforms,
  u,
} from "./flip.wgsl";
import type { MultipassKernel, KernelPass, KernelBuildCtx } from "./kernel-registry";

// ACES filmic tone mapper (pre-exposure cancellation folded in), matching
// hdr-flip-reference.ts's `acesToneMapChannel`.
const TONE_YCXCZ_SHADER = `
${VERTEX_WGSL}
${FLIP_COLOR_WGSL}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_exp: vec4<f32>; // exposure (c_i), 0, 0, 0

const AK0 = 0.6 * 0.6 * 2.51;
const AK1 = 0.6 * 0.03;
const AK2 = 0.0;
const AK3 = 0.6 * 0.6 * 2.43;
const AK4 = 0.6 * 0.59;
const AK5 = 0.14;

fn aces(x: f32) -> f32 {
  let x2 = x * x;
  let nom = AK0 * x2 + AK1 * x + AK2;
  let denom = AK3 * x2 + AK4 * x + AK5;
  let y = nom / denom;
  return clamp(y, 0.0, 1.0);
}

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(src, px, 0).rgb;
  let scale = exp2(u_exp.x);
  let x = scale * s;
  let tm = vec3<f32>(aces(x.r), aces(x.g), aces(x.b));
  return vec4<f32>(flip_linrgb2ycxcz(tm), 1.0);
}
`;

// COMBINE_SHADER + a 5th input (prevMax, logical binding 4 → native @binding(12))
// and uniforms moved to logical 5/6 (native @binding(17)/(20)); output is the
// per-pixel MAX of this exposure's LDR-FLIP and the running accumulator.
const COMBINE_MAX_SHADER = `
${VERTEX_WGSL}
@group(0) @binding(0) var labA: texture_2d<f32>;
@group(0) @binding(3) var labB: texture_2d<f32>;
@group(0) @binding(6) var ycxczA: texture_2d<f32>;
@group(0) @binding(9) var ycxczB: texture_2d<f32>;
@group(0) @binding(12) var prevMax: texture_2d<f32>;
@group(0) @binding(17) var<uniform> u0: vec4<f32>; // cmax, sd, rF, edgeNorm
@group(0) @binding(20) var<uniform> u1: vec4<f32>; // pointPos, pointNeg, 0, 0

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
      let ex = (-fx * g) / edgeNorm;
      let ey = (-fy * g) / edgeNorm;
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
  let prev = textureLoad(prevMax, px, 0).x;
  let m = max(flip, prev);
  return vec4<f32>(m, m, m, 1.0);
}
`;

export const hdrFlipKernel: MultipassKernel = {
  kind: "multipass",
  id: "hdr-flip",
  label: "FLIP (perceptual)", // shown once in the menu (via `flip`) — never listed directly
  // No `publicName`: HDR-FLIP is reached only by auto-dispatch under the public
  // `flip` mode when sources are float (see `kernels/index.ts`).
  publicName: "flip_hdr",
  displayRange: "unit",
  // Exposure params default to placeholders; the pane / harness computes the real
  // range from the reference luminance (`computeHdrFlipExposures`) and passes them,
  // so they enter the cache key. A direct `computeDiff` with only `ppd` falls back
  // to a minimal 2-exposure [0,4] sweep (deterministic).
  params: { ppd: 67, startExposure: 0, stopExposure: 4, numExposures: 2 },
  buildPasses(ctx: KernelBuildCtx): { passes: KernelPass[]; final: string } {
    const ppd = ctx.params.ppd ?? 67;
    const startExposure = ctx.params.startExposure ?? 0;
    const stopExposure = ctx.params.stopExposure ?? 4;
    const numExposures = Math.max(2, Math.round(ctx.params.numExposures ?? 2));
    const stepSize = (stopExposure - startExposure) / Math.max(numExposures - 1, 1);
    const csf = csfConstants(ppd);
    const feat = featureConstants(ppd);

    const passes: KernelPass[] = [];
    let prevAcc: string | null = null;
    for (let i = 0; i < numExposures; i++) {
      const exposure = startExposure + i * stepSize;
      const s = `_e${i}`;
      const yA = `ycxczA${s}`;
      const yB = `ycxczB${s}`;
      const lA = `labA${s}`;
      const lB = `labB${s}`;
      const acc = `acc${s}`;
      passes.push(
        { name: yA, shader: TONE_YCXCZ_SHADER, inputs: ["srcA"], output: yA, uniforms: () => [u(1, [exposure, 0, 0, 0])] },
        { name: yB, shader: TONE_YCXCZ_SHADER, inputs: ["srcB"], output: yB, uniforms: () => [u(1, [exposure, 0, 0, 0])] },
        { name: lA, shader: LAB_SHADER, inputs: [yA], output: lA, uniforms: () => labUniforms(csf) },
        { name: lB, shader: LAB_SHADER, inputs: [yB], output: lB, uniforms: () => labUniforms(csf) },
      );
      if (prevAcc === null) {
        passes.push({
          name: acc,
          shader: COMBINE_SHADER,
          inputs: [lA, lB, yA, yB],
          output: acc,
          uniforms: () => combineUniforms(feat),
        });
      } else {
        passes.push({
          name: acc,
          shader: COMBINE_MAX_SHADER,
          inputs: [lA, lB, yA, yB, prevAcc],
          output: acc,
          uniforms: () => [
            u(5, [FLIP_CMAX, feat.sd, feat.r, feat.edgeNorm]),
            u(6, [feat.pointPos, feat.pointNeg, 0, 0]),
          ],
        });
      }
      prevAcc = acc;
    }
    return { passes, final: prevAcc! };
  },
};
