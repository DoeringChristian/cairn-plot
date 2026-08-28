/**
 * IMAGE render-pass WGSL fragment shader (the engine's only backend, WebGPU).
 * Turns a float/8-bit source image texture into displayed pixels via
 * `exposure -> [colormap] -> tone-map operator -> output-encode`,
 * bit-for-bit (within 1/255) with the CPU reference in `image/tonemap.ts`.
 * See `engine/image-engine.ts`'s module doc comment for the full pipeline
 * description and `ImageParams` contract; this file only documents the
 * SHADER-level details (uniform layout, operator porting, colormap LUT
 * convention).
 *
 * ## Fullscreen triangle + Y-flip
 * Reuses the exact vertex stage from `passthrough.wgsl.ts` (see that file's
 * doc comment for the Y-flip rationale): `uv.y` is flipped (`1.0 - yRaw`) so
 * `readback()`'s row order matches on-screen top-down expectations for the
 * same input — originally cross-checked pixel-for-pixel against a since-
 * removed WebGL2 backend by the parity test harness
 * (`engine/__tests__/image-pass.browser.ts`), now a same-backend regression
 * check against the CPU `image/tonemap.ts` reference.
 *
 * ## Uniform "block" layout (std140-compatible)
 * The RHI maps each `BindGroupEntry.binding = N` onto ONE named uniform
 * (`u_bindN`), not a literal single packed byte-blob — so the six
 * `ImageParams` fields the task brief describes as "one uniform block" are
 * split across THREE named uniform bindings, each a natural WGSL type
 * already supported by the bind-group builder (`WGSL_UNIFORM_TYPE_SIZE` in
 * `webgpu/device.ts` only knows scalar/vecN/mat4 types, no arrays/structs —
 * reusing exactly the vec4-uniform convention `scalebias.wgsl.ts` already
 * established avoids extending that table). Every field keeps IDENTICAL
 * component order:
 *
 *   logical binding 2 (`u_bind2: vec4<f32>`, native binding 2*3+2=8):
 *     .x = exposureEV        (f32, EV stops)
 *     .y = display operation id (f32; assigned by the display-operation registry)
 *     .z = gamma               (f32; <=0 means "unset" -> sRGB OETF encode; the
 *                               renderer packs it per operator via resolveEncodeGamma:
 *                               gamma-op -> γ, linear-op -> 1 (identity), else 0/unset)
 *     .w = isScalar            (f32, 0/1 boolean flag)
 *   logical binding 3 (`u_bind3: vec4<f32>`, native binding 3*3+2=11):
 *     .xy = uvRect.xy (window origin, [0,1] source-space)
 *     .zw = uvRect.wh (window size,   [0,1] source-space)
 *   logical binding 4 (`u_bind4: f32`, native binding 4*3+2=14):
 *     = hdrOut (f32, 0/1 boolean flag)
 *   logical binding 5 (`u_bind5: f32`, native binding 5*3+2=17):
 *     = filterMode (f32, 0=nearest, 1=linear — see "Out-of-bounds..." /
 *       "Source filtering" sections below; Q20)
 *   logical binding 6 (`u_bind6: f32`, native binding 6*3+2=20):
 *     = offset (f32, TEV display offset — added to the scene value AFTER
 *       exposure and BEFORE colormap/tonemap/encode; default 0 = identity)
 *   logical binding 7 (`u_bind7: f32`, native binding 7*3+2=23):
 *     = peak (f32, PEAK white ×SDR white for peak-aware display operations;
 *       default 4, ignored by the others)
 *   logical binding 8 (`u_bind8: f32`, native binding 8*3+2=26):
 *     = srgbDecode (f32, 0/1 — sRGB-DECODE the sampled source to linear BEFORE
 *       exposure; set for an 8-bit sRGB source on the SDR display-transfer path,
 *       0 for the HDR/float path)
 *
 * ## Out-of-bounds -> fully transparent (Q18)
 * `uvRect` (`u_bind3`) is the zoom/pan WINDOW in source-space `[0,1]`; when
 * zoomed OUT past the image's native size, `uvRect.zw` exceeds `1-uvRect.xy`
 * and the window's far edge lands outside `[0,1]`. The image-space UV
 * (`rawSrcUV` below, BEFORE any clamping) is tested against `[0,1)` on both
 * axes first: outside it, the fragment returns `vec4(0.0)` (fully
 * transparent, RGBA all-zero) WITHOUT sampling `t_bind0` at all — no
 * clamped-edge smear/repeat. This requires the WebGPU canvas surface to be
 * configured `alphaMode:'premultiplied'` (`engine/webgpu/surface.ts`) so the
 * zero-alpha fragment actually composites as transparent (an `'opaque'`
 * surface would force every pixel's alpha to 1 at present time, hiding this
 * fix) — the caller's checkerboard background (`cairn-checkerboard`, applied
 * to the pane container behind the canvas) then shows through.
 *
 * ## Source filtering: nearest vs. manual bilinear (Q20)
 * `t_bind0`/`t_bind1` are `unfilterable-float`-safe (`textureLoad`, see
 * "Texel fetch..." below) specifically so `rgba32float`/`r32float` HDR
 * sources work without requiring the optional `float32-filterable` WebGPU
 * feature — a REAL `Sampler`+`textureSample` pair (the RHI's
 * `Device.createSampler`) would need that feature for the HDR path, which
 * isn't guaranteed to be available (see `engine/webgpu/device.ts`'s "Texel
 * fetch" doc note), so it is NOT used here. Instead `filterMode` (`u_bind5`)
 * selects between a single nearest `textureLoad` (`filterMode==0`) and a
 * manual bilinear blend of the four neighboring texels (`filterMode==1`,
 * `sampleBilinearF` below), computed entirely from `textureLoad` calls — this
 * works identically for every `TextureFormat` this engine uses and needs no
 * GPU feature beyond what `textureLoad` already requires. `GpuImagePane`
 * drives `filterMode` from the SAME `PIXEL_VALUE_MIN_SCREEN_PX` threshold
 * `PixelValueOverlay` uses (nearest once a source texel is large enough
 * on-screen to show its per-pixel TEV number, linear below that), so the
 * "crisp/blocky pixels" and "pixel-value numbers" visual cues change in
 * lockstep. At exact 1:1 (or any texel-aligned) sampling the bilinear blend's
 * fractional weight is exactly 0, so it degenerates to the SAME value nearest
 * would produce — this is why enabling it by default does not change any of
 * this file's existing byte-exact parity-test cases (all texel-aligned).
 *
 * ## Operator porting (verbatim from `image/tonemap.ts`)
 * `TONEMAP_OPERATORS` order or its keys, and `applyOperator`'s `if` chain,
 * match `image/tonemap.ts`'s object literal order: `linear`(0), `srgb`(1),
 * `reinhard`(2), `aces`(3). `linear` and `srgb` are literally the SAME
 * per-channel `clamp01` in the CPU source (the sRGB OETF lives in the
 * SEPARATE `outputEncode` stage, not the operator) — ported here as the
 * exact same shared clamp. `reinhardCurve`/`acesCurve` port
 * `reinhardCurve`/`acesCurve` from `tonemap.ts` term-for-term (including the
 * `max(x,0)` pre-clamp and, for ACES, the Narkowicz 2015 rational
 * approximation's exact coefficients).
 *
 * ## Output-encode porting (verbatim from `image/tonemap.ts`)
 * `srgbOetf`/`outputEncode` port `srgbOetf`/`outputEncode` term-for-term: the
 * sRGB OETF's `12.92*v` / `1.055*pow(v,1/2.4)-0.055` piecewise split at
 * `0.0031308`, and the `gamma` override only replacing the sRGB path when
 * `gamma > 0` (`hasGamma`, computed from `u_bind2.z` — WGSL/GLSL have no
 * `undefined`, so "unset" is encoded as `gamma <= 0`, matching
 * `image-engine.ts`'s `ImageParams.gamma?: number` -> uniform packing, which
 * writes `0` for an absent/non-positive `gamma`).
 *
 * ## HDR-out (extended) encode porting (verbatim from `image/tonemap.ts`)
 * On the `hdrOut` path the fragment runs the EXTENDED transfer encode
 * (`extendedOutputEncodeF` -> `extendedSrgbOetf` / `extendedGammaEncode`),
 * porting `image/tonemap.ts`'s `extendedOutputEncode` term-for-term: the SAME
 * sRGB / power curves as the SDR encoders but UNCLAMPED (no `clamp(x,0,1)`, so
 * values past 1 survive as extended brightness) and MIRRORED through the origin
 * for negatives (`sign(x)*f(|x|)`). This is REQUIRED, not optional: a float16
 * `srgb`/`display-p3` canvas stores TRANSFER-ENCODED (non-linear) signals per
 * W3C ColorWeb-CG (`hdr_html_canvas_element` + `canvas-color-space`), so writing
 * raw scene-linear values (the old behavior) renders too dark/contrasty.
 *
 * ## Colormap LUT (scalar-image path)
 * `t_bind1` is a `256x1 rgba32float` texture (or a 1x1 placeholder when
 * `ImageParams.colormap` is absent — see `image-engine.ts`'s
 * `buildColormapTexture`) holding a `256x4` RGBA-float lookup table of DISPLAY
 * (sRGB-encoded) colormap colors. When `isScalar` is set, the scalar value is
 * taken from `rgb.x` AFTER exposure/offset (the colormap SENSITIVITY) and mapped
 * through the SHARED LUT family (`image/encodings`' `cairnLutColor`, the SAME
 * family the diff blit uses) — whose sampled value IS the final display color, so
 * the colormap SHORT-CIRCUITS the tone-map operator + output-encode stages and
 * returns straight to the surface (no re-encode). The family is SELECTED by the same `filterMode`
 * (`u_bind5`) that picks nearest vs. bilinear SOURCE sampling. Nearest source
 * sampling (pixelated zoom) uses the NEAREST index: `clamp(rgb.x,0,1)*255`
 * rounded via `floor(idxF + 0.5)` (deterministic round-half-UP, matching the
 * CPU/test reference's `Math.round` — NOT the shader-native `round()`, which is
 * round-half-to-EVEN in WGSL and implementation-defined in GLSL, so either could
 * disagree with `Math.round`, and each other, exactly at `k+0.5` boundaries), an
 * EXACT integer texel-fetch. Bilinear source sampling (moderate zoom) uses the
 * LINEAR lookup: blend the two adjacent LUT entries by the fractional index, so
 * an interpolated scalar yields a smooth color instead of snapping to one of 256
 * discrete bins (which reintroduces per-texel banding even though the source
 * scalar is smooth — the colormap bug this pairing fixes). At a texel-aligned
 * 8-bit scalar the fractional index is 0, so LINEAR degenerates to the exact
 * NEAREST entry and the byte-exact parity cases are unaffected. This is a
 * new GPU-only pipeline stage (no
 * existing CPU renderer applies a colormap at this point in the pipeline;
 * `model/apply-colormap.ts`'s `applyColormap` operates on already-8-bit,
 * already-tone-mapped diff visualizations, a different use case), so its
 * "source of truth" is this shader + the matching JS reference the test
 * harness computes the SAME way, not an existing CPU renderer.
 *
 * ## Texel fetch, not filtered sampling
 * Both `t_bind0` (source image) and `t_bind1` (LUT) are read via
 * `textureLoad` — see `passthrough.wgsl.ts`'s doc comment for why
 * (`unfilterable-float` sample type avoids the `float32-filterable` feature
 * requirement). The LUT lookup is composed from `textureLoad` fetches: a single
 * exact fetch on the nearest path, and a two-tap blend of adjacent entries on
 * the linear path (`sampleLutLinearF`) — both need only `textureLoad`'s
 * exact-texel semantics, no filterable-float sampler.
 */
import { buildDisplayOperationWGSL, LUT_FAMILY_WGSL, OUTPUT_ENCODE_WGSL, type WebGpuDisplayOperation } from "../display.ts";
import { buildImageOperationWGSL } from "../image-operations.ts";

export function buildImageWGSL(displayOperation: WebGpuDisplayOperation): string {
return `
struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  let xRaw = f32((vertexIndex << 1u) & 2u);
  let yRaw = f32(vertexIndex & 2u);
  var out: VSOut;
  // Y-flip vs the GLSL sibling shader's v_uv — see module doc comment.
  out.uv = vec2<f32>(xRaw, 1.0 - yRaw);
  out.position = vec4<f32>(xRaw * 2.0 - 1.0, yRaw * 2.0 - 1.0, 0.0, 1.0);
  return out;
}

// Logical binding 0 (texture, source image) -> native binding 0*3+0 = 0.
@group(0) @binding(0) var t_bind0: texture_2d<f32>;
// Logical binding 1 (texture, colormap LUT 256x1) -> native binding 1*3+0 = 3.
@group(0) @binding(3) var t_bind1: texture_2d<f32>;
// Logical binding 2 (uniform vec4: exposureEV, operator, gamma, isScalar) -> native binding 2*3+2 = 8.
@group(0) @binding(8) var<uniform> u_bind2: vec4<f32>;
// Logical binding 3 (uniform vec4: uvRect.x, uvRect.y, uvRect.w, uvRect.h) -> native binding 3*3+2 = 11.
@group(0) @binding(11) var<uniform> u_bind3: vec4<f32>;
// Logical binding 4 (uniform f32: hdrOut) -> native binding 4*3+2 = 14.
@group(0) @binding(14) var<uniform> u_bind4: f32;
// Logical binding 5 (uniform f32: filterMode, 0=nearest/1=linear) -> native binding 5*3+2 = 17.
@group(0) @binding(17) var<uniform> u_bind5: f32;
// Logical binding 6 (uniform f32: display OFFSET, TEV convention — added after
// exposure, before colormap/tonemap/encode) -> native binding 6*3+2 = 20.
// Defaults to 0 (the bind-group builder zero-fills any binding the caller omits),
// so an image with no offset renders bit-for-bit as before.
@group(0) @binding(20) var<uniform> u_bind6: f32;
// Logical binding 7 (uniform f32: PEAK white, ×SDR white — for the peak-
// peak-aware display operations) -> native binding 7*3+2 = 23. Defaults to 0 when the caller
// omits it (zero-filled); the engine
// always writes EXTENDED_TONEMAP_PEAK_DEFAULT (4), and the roll-off curves guard
// peak<=0 anyway.
@group(0) @binding(23) var<uniform> u_bind7: f32;
// Logical binding 8 (uniform f32: srgbDecode, 0/1) -> native binding 8*3+2 = 26.
// When 1, sRGB-DECODE the sampled source to linear light BEFORE exposure (an
// 8-bit sRGB source going through the display-transfer pipeline). Default 0
// (zero-filled when the caller omits it) — the HDR/float path leaves it off, so
// a scene-linear source is untouched and every existing case renders as before.
@group(0) @binding(26) var<uniform> u_bind8: f32;
// Logical binding 9 (uniform vec4: DATA-encoding norm params — normMode,
// boundsMin, boundsMax, boundsActive) -> native binding 9*3+2 = 29. Only the
// scalar/LUT (isScalar) path reads it; it feeds cairnDataIndex (the norm
// reshape + min/max bounds affine). Defaults to vec4(0) when the caller omits it
// (zero-filled) — normMode 0 (linear) + boundsActive 0, so a colormap with no
// norm/bounds renders bit-for-bit as before. The power exponent reuses the gamma
// uniform (u_bind2.z), free on the lut path.
@group(0) @binding(29) var<uniform> u_bind9: vec4<f32>;
// Logical binding 10 (uniform vec4: DATA-encoding multi-channel REDUCE params —
// reduceMode, channelCount k, SCALAR-MODE enum (.z), gray encode-gamma (.w)) ->
// native binding 10*3+2 = 32. Only the scalar/LUT (isScalar) path reads it; it
// feeds cairnReduceScalar (the ℝᵏ→scalar collapse) BEFORE cairnDataIndex. .z is a
// scalar-MODE enum: 0 = LUT sample (table colormap), 1 = ANALYTIC signed-color
// (tev red-green: cairnSignedAnalyticColor + shared output-encode, no LUT bind),
// 2 = LINEAR SCALAR (the linear scalar DATA encoding: cairnDataIndex → scene-
// linear gray vec3 → shared output-encode; HDR-native, no LUT bind), 3 = TURBO
// false-color (tev-exact: the bound turbo table sampled at cairnTurboDataIndex —
// the FIXED log2 index BAKED into the encoding, bypassing cairnDataIndex's norm).
// .w carries the
// GRAY-NONE encode-gamma (0 = sRGB OETF, >0 = the 1/γ power curve) — the transfer
// the gray output-encode uses (the power-NORM exponent still rides u_bind2.z). Both
// .z and .w default to 0 when the caller omits the slot (zero-filled) → LUT mode +
// sRGB encode; with cairnReduceScalar's k<=1 guard a scalar colormap (k=1) renders
// bit-for-bit as before.
@group(0) @binding(32) var<uniform> u_bind10: vec4<f32>;
// Logical binding 11 (texture, SECOND source slot b — the reference/baseline of
// an arity-2 diff IMAGE operation) -> native binding 11*3+0 = 33. For a single-image
// (arity-1) render this is a 1x1 placeholder the caller binds (WebGPU requires
// every declared binding to have a resource); the IDENTITY image operation (opId 0)
// ignores b, so the single-image path is byte-for-byte unaffected. See
// engine/image-engine.ts's srcB handling + operations/wgsl.ts.
@group(0) @binding(33) var t_bind11: texture_2d<f32>;
// Logical binding 12 (uniform f32: imageOperationId — the CONTENT-op dispatch id) ->
// native binding 12*3+2 = 38. Selects the image operation cairnContent applies to the
// two sampled slots: 0 = IDENTITY (passthrough of a; the zero-filled default, so
// a caller that sets no op renders as before), 1.. = the direct diff ops
// (signed/absolute/…) assembled from the content-op registry. See
// operations/wgsl.ts (IMAGE_OPERATION_ID).
@group(0) @binding(38) var<uniform> u_bind12: f32;
// Logical binding 13 (uniform vec4: COMPOSITOR param — the per-frame scalar the
// Phase-3 compositor image operations (split/blend) read) -> native binding 13*3+2 = 41.
// .x = the divider position (split) or the mix alpha (blend); .yzw reserved (0).
// Driven live (divider drag / blend slider) with NO shader recompile — only this
// uniform changes. Defaults to vec4(0) when the caller omits it (zero-filled): the
// diff/identity ops ignore it, so the single-image + diff paths are unaffected. See
// engine/image-engine.ts's contentParam handling + operations/wgsl.ts.
@group(0) @binding(41) var<uniform> u_bind13: vec4<f32>;
// Logical binding 14 (uniform vec4: DISPLAY-space post-processing — the 8-bit
// ImageProcessing block's brightness/contrast/flipSign) -> native binding
// 14*3+2 = 44. .x = brightness, .y = contrast, .z = flipSign (0/1); .w reserved.
// Applied as a FINAL affine in the ENCODED (display) color space AFTER the
// output-encode — the numeric mirror of the CPU SDR pane's CSS filter
// (media-compare/post-processing's brightness(1+b) contrast(1+c) invert), so one
// knob renders identically on the CPU (CSS) and GPU (shader) backends (audit H1).
// Defaults to vec4(0) when the caller omits it (zero-filled): brightness 0 +
// contrast 0 + flipSign 0 = cairnDisplayAdjust identity, so every existing case
// (and every path where the pane sets no processing) renders bit-for-bit as
// before. exposure/offset are NOT here — they are lifted top-level and applied in
// scene-linear space (u_bind2.x / u_bind6). Ported byte-identically from
// image/tonemap.ts's applyDisplayAdjust1.
@group(0) @binding(44) var<uniform> u_bind14: vec4<f32>;

// Display-transfer stage — the SDR sRGB/gamma OETF (+ the sRGB EOTF that
// LINEARIZES an 8-bit source when srgbDecode/u_bind8 is set) and the EXTENDED
// (unclamped, origin-mirrored) HDR-out encoders — ASSEMBLED from the shared
// OUTPUT_ENCODE_WGSL (image/encodings), the SAME block the diff-display blit
// (engine/diff-engine.ts) interpolates. Ported byte-identically from
// image/tonemap.ts's srgbOetf/srgbEotf/outputEncode + extended*; see that file's
// doc block for WHY the hdrOut path must transfer-encode (W3C ColorWeb-CG).
${OUTPUT_ENCODE_WGSL}

// Manual bilinear blend of the 4 texels surrounding 'uv' (source-space
// [0,1]) — see module doc comment's "Source filtering" section for why this
// is hand-rolled instead of a real Sampler+textureSample. 'uv' is assumed
// already inside [0,1) (the OOB-transparent check runs before this is
// called); neighbor indices are clamped to the texture's own edge (standard
// filter-kernel clamp-to-edge, NOT the Q18 uvRect-window OOB check above).
fn sampleBilinearF(uv: vec2<f32>, dims: vec2<f32>) -> vec4<f32> {
  let texel = uv * dims - vec2<f32>(0.5);
  let base = floor(texel);
  let frac = texel - base;
  let maxX = i32(dims.x) - 1;
  let maxY = i32(dims.y) - 1;
  let x0 = clamp(i32(base.x), 0, maxX);
  let x1 = clamp(i32(base.x) + 1, 0, maxX);
  let y0 = clamp(i32(base.y), 0, maxY);
  let y1 = clamp(i32(base.y) + 1, 0, maxY);
  let c00 = textureLoad(t_bind0, vec2<i32>(x0, y0), 0);
  let c10 = textureLoad(t_bind0, vec2<i32>(x1, y0), 0);
  let c01 = textureLoad(t_bind0, vec2<i32>(x0, y1), 0);
  let c11 = textureLoad(t_bind0, vec2<i32>(x1, y1), 0);
  let top = mix(c00, c10, frac.x);
  let bot = mix(c01, c11, frac.x);
  return mix(top, bot, frac.y);
}

// Manual bilinear blend for the SECOND source slot (t_bind11) — the arity-2 diff
// IMAGE operations sample both slots at the fragment source UV. A verbatim twin of
// sampleBilinearF on t_bind11 (WGSL textures are not first-class parameters, so
// the sampler is duplicated rather than parameterized). Unused by the single-image
// (identity) path.
fn sampleBilinearB(uv: vec2<f32>, dims: vec2<f32>) -> vec4<f32> {
  let texel = uv * dims - vec2<f32>(0.5);
  let base = floor(texel);
  let frac = texel - base;
  let maxX = i32(dims.x) - 1;
  let maxY = i32(dims.y) - 1;
  let x0 = clamp(i32(base.x), 0, maxX);
  let x1 = clamp(i32(base.x) + 1, 0, maxX);
  let y0 = clamp(i32(base.y), 0, maxY);
  let y1 = clamp(i32(base.y) + 1, 0, maxY);
  let c00 = textureLoad(t_bind11, vec2<i32>(x0, y0), 0);
  let c10 = textureLoad(t_bind11, vec2<i32>(x1, y0), 0);
  let c01 = textureLoad(t_bind11, vec2<i32>(x0, y1), 0);
  let c11 = textureLoad(t_bind11, vec2<i32>(x1, y1), 0);
  let top = mix(c00, c10, frac.x);
  let bot = mix(c01, c11, frac.x);
  return mix(top, bot, frac.y);
}

// Colormap LUT family — the SHARED cairnLutColor(lut, scalar, cmapMode,
// filterLinear) from image/encodings (LUT_FAMILY_WGSL), the SAME family the diff
// blit consumes. Its nearest/linear samplers are selected by the SAME filter
// flag (u_bind5) that picks nearest/bilinear source sampling, so a colormapped
// image shares ONE interpolation decision with the plain path: crisp round-half-
// UP nearest at the pixelated zoom, adjacent-entry blend at moderate zoom (so an
// interpolated scalar yields a smooth color instead of snapping to one of 256
// bins). The float single-image path uses cmap-mode 0 (linear / full ramp); the
// LUT holds DISPLAY (sRGB) colors written to the surface UNCHANGED (no output
// re-encode) — see the isScalar short-circuit in fs_main.
${LUT_FAMILY_WGSL}
${buildDisplayOperationWGSL(displayOperation)}

// CONTENT stage — ASSEMBLED from the content-op registry (image/operations),
// the single source of truth for "what k-channel value does this texel carry".
// cairnContent(a, b, uv, param, opId) dispatches on the imageOperationId uniform
// (u_bind12): opId 0 = IDENTITY (passthrough of the single sampled slot a — the
// sampled source enters the display pipeline here, byte-for-byte the pre-diff
// path); opId 1.. = the direct pointwise diff ops (signed/absolute/squared +
// relative variants), each the raw per-channel error over the two sampled slots
// a,b; and the COMPOSITOR ops split/blend, which composite a,b by the fragment
// SCREEN uv against the compositor param (u_bind13.x — the divider position /
// alpha). The display stage downstream (exposure, isScalar/reduce/dataIndex,
// applyOperator, output-encode) is unchanged and consumes cairnContent's output —
// a diff is displayed as a scalar error (reduce → colormap) via its
// defaultEncoding; a split/blend composite is LIGHT (k=3) displayed as a plain
// image (curves).
${buildImageOperationWGSL()}

// DISPLAY-space post-processing (brightness/contrast/flipSign) — the numeric
// mirror of image/tonemap.ts's applyDisplayAdjust1 (which itself is the numeric
// definition of the CPU SDR pane's CSS filter). Applied to the ENCODED display
// color AFTER the output-encode: brightness(1+b) then contrast(1+c) then, when
// flipSign, invert(1). UNCLAMPED — the surface write / readback clamps to [0,1],
// matching CSS rasterization. With the zero-filled default (b=0,c=0,flip=0) this
// is the identity, so every non-processing path is byte-for-byte unchanged.
fn cairnDisplayAdjust(c: vec3<f32>) -> vec3<f32> {
  let brightness = u_bind14.x;
  let contrast = u_bind14.y;
  let flip = u_bind14.z > 0.5;
  var v = c * (1.0 + brightness);
  v = (v - vec3<f32>(0.5)) * (1.0 + contrast) + vec3<f32>(0.5);
  if (flip) { v = vec3<f32>(1.0) - v; }
  return v;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let srcDims = vec2<f32>(textureDimensions(t_bind0));
  let uvRect = u_bind3;
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  // Image-space UV, UNCLAMPED — Q18: test this against [0,1) before doing
  // anything else. Zoomed-out (uvRect.zw > 1-uvRect.xy) pushes this outside
  // [0,1] on purpose; that region must render fully transparent, not a
  // clamped-edge smear.
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));

  let filterLinear = u_bind5 > 0.5;
  var sampled: vec4<f32>;
  if (filterLinear) {
    sampled = sampleBilinearF(srcUV, srcDims);
  } else {
    let coord = vec2<i32>(srcUV * srcDims);
    sampled = textureLoad(t_bind0, coord, 0);
  }

  // SECOND source slot b — sampled at the same source UV from t_bind11 (its own
  // dims). Only the arity-2 diff IMAGE operations read it; for the single-image path
  // it is a 1x1 placeholder the IDENTITY op ignores, so this sample is inert.
  let srcDimsB = vec2<f32>(textureDimensions(t_bind11));
  var sampledB: vec4<f32>;
  if (filterLinear) {
    sampledB = sampleBilinearB(srcUV, srcDimsB);
  } else {
    let coordB = vec2<i32>(srcUV * srcDimsB);
    sampledB = textureLoad(t_bind11, coordB, 0);
  }

  let exposureEV = u_bind2.x;
  let gamma = u_bind2.z;
  let isScalar = u_bind2.w > 0.5;
  let hdrOut = u_bind4 > 0.5;
  let offset = u_bind6;
  let peak = u_bind7;
  let srgbDecode = u_bind8 > 0.5;

  // CONTENT stage — the sampled source slot(s) enter the display pipeline through
  // the content-op registry (cairnContent, assembled above), dispatched by the
  // imageOperationId uniform (u_bind12). opId 0 = IDENTITY (passthrough of a, the
  // zero-filled default), so content == sampled and the single-image display
  // pipeline below is byte-for-byte unchanged; opId 1.. = the direct diff ops
  // (raw per-channel error over a,b), which the display stage then encodes
  // (reduce -> colormap) via the op's defaultEncoding.
  let imageOperationId = i32(round(u_bind12));
  // uv (fragment SCREEN uv) + u_bind13 (the compositor param) feed the split/
  // blend COMPOSITOR ops — the divider is a DEST-space cut (uv.x < param.x), so
  // it stays put under source zoom/pan exactly like GpuComparePane. The diff /
  // identity ops ignore both, so this is inert for every non-compositor op.
  let content = cairnContent(sampled, sampledB, uv, u_bind13, imageOperationId);

  // 0) [SDR display-transfer path] sRGB-DECODE the sampled 8-bit source to
  //    linear light so exposure/offset + the chosen transfer operate on linear
  //    values (tev-style). Off for the HDR/float path (scene-linear already).
  var src = content.rgb;
  if (srgbDecode) {
    src = vec3<f32>(srgbEotf(src.r), srgbEotf(src.g), srgbEotf(src.b));
  }

  // 1) exposure + offset (TEV convention), in scene-linear space:
  //    v * 2^EV + offset. Offset is additive AFTER exposure, BEFORE the
  //    colormap / tone-map / output-encode stages below.
  var rgb = src * exp2(exposureEV) + vec3<f32>(offset);

  // 2) scalar image + colormap LUT family (the DATA encoding). The scalar (rgb.x,
  //    AFTER exposure/offset = the colormap SENSITIVITY) indexes the shared LUT
  //    family; the sampled value is the FINAL DISPLAY color (the LUT holds sRGB-
  //    encoded colormap colors), so a colormap SHORT-CIRCUITS the tone-map
  //    operator + output-encode stages entirely and returns straight to the
  //    surface — exactly the diff blit's convention, and why the two now share
  //    one family. cmap-mode 0 (linear/full ramp) for the float image. The LUT
  //    lookup still mirrors the source filter (linear at moderate zoom, nearest
  //    pixelated) so false-color interpolation never diverges from the plain path.
  if (isScalar) {
    // Multi-channel follow-up: a k>1 sample is first REDUCED to a scalar
    // (cairnReduceScalar — luminance/mean over the color channels, via u_bind10.x
    // + k=u_bind10.y), so a colormap is legal on RGB/RGBA sources, not only
    // isolated scalars. At k<=1 it returns rgb.x (the pre-follow-up scalar).
    // Then the norm reshape (linear/log/power via u_bind9.x, power exponent =
    // gamma) + the optional min/max bounds affine (u_bind9.yz, engaged by
    // boundsActive u_bind9.w). With the zero-filled default (normMode 0,
    // boundsActive 0) cairnDataIndex is the identity, so the exposure/offset
    // sensitivity (already folded into the reduced scalar) is the sole affine.
    let reduceMode = i32(round(u_bind10.x));
    let channelCount = i32(round(u_bind10.y));
    // u_bind10.z is a SCALAR-MODE enum, not a bare flag: 0 = LUT sample (table
    // colormap), 1 = ANALYTIC (computed signed color, tev red-green), 2 = GRAY
    // NONE (the linear scalar data encoding — scalar → data index →
    // scene-linear gray → shared output-encode, HDR-native), 3 = TURBO false-color
    // (tev-exact: the bound turbo table sampled at cairnTurboDataIndex, the FIXED
    // log2 index baked into the encoding). Kept an enum (not flags) so a fresh
    // uniform slot stays free for the gray encode-gamma (.w).
    let linearScalar = u_bind10.z > 0.5;
    let dataDisplayKind = CAIRN_DISPLAY_KIND;
    let scalar = cairnReduceScalar(rgb, reduceMode, channelCount);
    if (dataDisplayKind == 2) {
      // ANALYTIC signed error (tev-style red-green) — computed color, no LUT
      // bind. The reduced signed scalar (exposure already SCALED its amplitude)
      // maps to a SCENE-LINEAR color that flows through the SHARED output-encode
      // (like a curve), so |v|>1 survives on the extended/HDR surface while |v|<=1
      // renders identically on SDR. gamma here is the sRGB OETF path (hasGamma
      // false when the pane leaves gamma unset — the analytic entry has no γ).
      let lin = applyAnalyticDisplay(scalar);
      let hasG = gamma > 0.0;
      if (hdrOut) {
        let enc = vec3<f32>(
          extendedOutputEncodeF(lin.r, gamma, hasG),
          extendedOutputEncodeF(lin.g, gamma, hasG),
          extendedOutputEncodeF(lin.b, gamma, hasG),
        );
        return vec4<f32>(cairnDisplayAdjust(enc), 1.0);
      }
      let enc = vec3<f32>(
        outputEncodeF(lin.r, gamma, hasG),
        outputEncodeF(lin.g, gamma, hasG),
        outputEncodeF(lin.b, gamma, hasG),
      );
      return vec4<f32>(cairnDisplayAdjust(enc), 1.0);
    }
    let normMode = i32(round(u_bind9.x));
    let boundsActive = u_bind9.w > 0.5;
    let idx = applyDisplayIndex(scalar, normMode, u_bind9.y, u_bind9.z, boundsActive, gamma);
    if (linearScalar) {
      // LINEAR SCALAR (the linear scalar DATA encoding). A single-channel
      // scalar is DATA, not light: it carries the SAME data index the LUT path
      // computes (cairnDataIndex — linear norm + no bounds = the RAW value passed
      // through UNCLAMPED; log/power/bounds map it to [0,1]), but its color is the
      // SCENE-LINEAR gray vec3(idx) run through the SHARED output-encode — exactly
      // like a curve / the analytic entry, NOT a baked-sRGB LUT sample. So the SDR
      // surface clamps to [0,1] (byte-identical to the old srgb/linear/gamma curve
      // for in-range values) while the extended/HDR surface lets idx>1 SURVIVE.
      // The output-encode transfer is the curve's own encode-gamma (u_bind10.w:
      // 0 = sRGB OETF, >0 = the 1/γ power curve — linear→1, gamma→γ). The power-
      // NORM exponent still rides the gamma uniform (u_bind2.z) inside
      // cairnDataIndex above, so the two never collide.
      let ge = u_bind10.w;
      let hasGe = ge > 0.0;
      if (hdrOut) {
        let e = extendedOutputEncodeF(idx, ge, hasGe);
        return vec4<f32>(cairnDisplayAdjust(vec3<f32>(e, e, e)), 1.0);
      }
      let e = outputEncodeF(idx, ge, hasGe);
      return vec4<f32>(cairnDisplayAdjust(vec3<f32>(e, e, e)), 1.0);
    }
    return vec4<f32>(cairnDisplayAdjust(cairnLutColor(t_bind1, idx, 0, filterLinear)), 1.0);
  }

  // 3) tone-map operator: HDR [0,inf) -> display-linear [0,1] (or [0,peak] for
  //    the extended roll-off operators, which stay HDR-out).
  rgb = applyDisplayOperation(rgb, peak);

  // 4) output-encode.
  let hasGamma = gamma > 0.0;
  if (hdrOut) {
    // EXTENDED HDR surface (rgba16float, srgb/display-p3): the canvas stores
    // TRANSFER-ENCODED (non-linear) signals per W3C ColorWeb-CG, so ENCODE the
    // display-linear light the operator produced — the extended (unclamped,
    // origin-mirrored) sRGB OETF, or the extended power curve for the Gamma
    // operator (hasGamma). Values above 1 / below 0 survive as extended
    // brightness. See extendedOutputEncodeF + image/tonemap.ts's doc block.
    let enc = vec3<f32>(
      extendedOutputEncodeF(rgb.r, gamma, hasGamma),
      extendedOutputEncodeF(rgb.g, gamma, hasGamma),
      extendedOutputEncodeF(rgb.b, gamma, hasGamma),
    );
    return vec4<f32>(cairnDisplayAdjust(enc), 1.0);
  }
  let enc = vec3<f32>(
    outputEncodeF(rgb.r, gamma, hasGamma),
    outputEncodeF(rgb.g, gamma, hasGamma),
    outputEncodeF(rgb.b, gamma, hasGamma),
  );
  return vec4<f32>(cairnDisplayAdjust(enc), 1.0);
}
`;
}
