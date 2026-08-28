import type { DisplayOperation } from "./registry.ts";

/** Compile one display operation into stable shader functions. Selecting an
 * operation selects a cached pipeline; the shader never dispatches on an id. */
export function buildDisplayOperationWGSL(operation: DisplayOperation): string {
  const implementation = operation.implementation;
  if (implementation.kind === "per-channel") {
    return `
const CAIRN_DISPLAY_KIND: i32 = 0;
fn applyDisplayChannel(value: f32, peak: f32) -> f32 {
${implementation.wgsl.trim()}
}
fn applyDisplayOperation(rgb: vec3<f32>, peak: f32) -> vec3<f32> {
  return vec3<f32>(applyDisplayChannel(rgb.r, peak), applyDisplayChannel(rgb.g, peak), applyDisplayChannel(rgb.b, peak));
}
fn applyDisplayIndex(value: f32, normMode: i32, normMin: f32, normMax: f32, boundsActive: bool, gamma: f32) -> f32 {
  return cairnDataIndex(value, normMode, normMin, normMax, boundsActive, gamma);
}
fn applyAnalyticDisplay(value: f32) -> vec3<f32> { return vec3<f32>(value); }`;
  }
  if (implementation.kind === "lut") {
    return `
const CAIRN_DISPLAY_KIND: i32 = 1;
fn applyDisplayOperation(rgb: vec3<f32>, peak: f32) -> vec3<f32> { return rgb; }
fn applyDisplayIndex(value: f32, normMode: i32, normMin: f32, normMax: f32, boundsActive: bool, gamma: f32) -> f32 {
${implementation.index.wgsl.trim()}
}
fn applyAnalyticDisplay(value: f32) -> vec3<f32> { return vec3<f32>(value); }`;
  }
  return `
const CAIRN_DISPLAY_KIND: i32 = 2;
fn applyDisplayOperation(rgb: vec3<f32>, peak: f32) -> vec3<f32> { return rgb; }
fn applyDisplayIndex(value: f32, normMode: i32, normMin: f32, normMax: f32, boundsActive: bool, gamma: f32) -> f32 { return value; }
fn applyAnalyticDisplay(value: f32) -> vec3<f32> {
${implementation.wgsl.trim()}
}`;
}

export const OUTPUT_ENCODE_WGSL = `
fn srgbOetf(x: f32) -> f32 { let v = clamp(x, 0.0, 1.0); if (v <= 0.0031308) { return 12.92 * v; } return 1.055 * pow(v, 1.0 / 2.4) - 0.055; }
fn srgbEotf(x: f32) -> f32 { let v = clamp(x, 0.0, 1.0); if (v <= 0.04045) { return v / 12.92; } return pow((v + 0.055) / 1.055, 2.4); }
fn outputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 { if (hasGamma) { return clamp(pow(clamp(x, 0.0, 1.0), 1.0 / gamma), 0.0, 1.0); } return srgbOetf(x); }
fn extendedSrgbOetf(x: f32) -> f32 { let a = abs(x); let s = sign(x); if (a <= 0.0031308) { return s * 12.92 * a; } return s * (1.055 * pow(a, 1.0 / 2.4) - 0.055); }
fn extendedGammaEncode(x: f32, gamma: f32) -> f32 { return sign(x) * pow(abs(x), 1.0 / gamma); }
fn extendedOutputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 { if (hasGamma) { return extendedGammaEncode(x, gamma); } return extendedSrgbOetf(x); }
`;

export const LUT_FAMILY_WGSL = `
fn cairnLutColor(lut: texture_2d<f32>, scalar: f32, mode: i32, filterLinear: bool) -> vec3<f32> {
  let x = clamp(scalar, 0.0, 1.0) * 255.0;
  if (!filterLinear) { return textureLoad(lut, vec2<i32>(i32(floor(x + 0.5)), 0), 0).rgb; }
  let lo = i32(floor(x)); let hi = min(lo + 1, 255); let t = fract(x);
  return mix(textureLoad(lut, vec2<i32>(lo, 0), 0).rgb, textureLoad(lut, vec2<i32>(hi, 0), 0).rgb, t);
}

fn cairnReduceScalar(rgb: vec3<f32>, reduceMode: i32, k: i32) -> f32 {
  if (k <= 1) { return rgb.x; }
  if (reduceMode == 1) {
    var b = rgb.z;
    if (k < 3) { b = 0.0; }
    return 0.2126 * rgb.x + 0.7152 * rgb.y + 0.0722 * b;
  }
  if (k == 2) { return (rgb.x + rgb.y) * 0.5; }
  return (rgb.x + rgb.y + rgb.z) / 3.0;
}

fn cairnDataIndex(scalar: f32, normMode: i32, minV: f32, maxV: f32, boundsActive: bool, exponent: f32) -> f32 {
  var t = scalar;
  if (boundsActive) {
    let denominator = maxV - minV;
    if (denominator != 0.0) { t = (scalar - minV) / denominator; } else { t = 0.0; }
  }
  if (normMode == 1) {
    let epsilon = 1e-4;
    let clamped = clamp(t, epsilon, 1.0);
    return (log(clamped) - log(epsilon)) / -log(epsilon);
  }
  if (normMode == 2) {
    var power = exponent;
    if (power <= 0.0) { power = 1.0; }
    return pow(clamp(t, 0.0, 1.0), power);
  }
  return t;
}
`;
