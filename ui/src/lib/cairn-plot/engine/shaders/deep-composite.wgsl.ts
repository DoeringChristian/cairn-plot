/**
 * `engine/shaders/deep-composite.wgsl.ts` — the GPU DEEP-EXR depth composite.
 *
 * A fullscreen FRAGMENT pass that composites one deep pixel per fragment: it
 * walks that pixel's Z-sorted samples and OVER-accumulates (premultiplied
 * alpha) while `Z ≤ zClip`, writing the premultiplied RGBA straight into the
 * pane's `rgba16float` source texture — the SAME texture the display pass then
 * samples/tone-maps. A depth-slider tick is just a uniform write + one draw +
 * the existing blit — no wasm call, no CPU re-upload (that per-tick full-frame
 * upload was the thing keeping the wasm path off real-time).
 *
 * ## Why a fragment pass (not compute)
 * The source texture already carries `RENDER_ATTACHMENT` usage, so a render
 * pass can target it directly; a compute pass would need the shared display
 * texture to ALSO be a write `rgba16float` storage texture (extra usage flags
 * + a separate write path). Read-only storage buffers are fully allowed in the
 * fragment stage, and one texel per fragment is the natural per-pixel mapping.
 *
 * ## Storage layout (see wasm/openexr binding `DeepGpuCsr`)
 *   offsets: array<u32>       pixels+1 prefix sums; pixel i → [offsets[i], offsets[i+1])
 *   colors:  array<vec4<f32>> premultiplied RGBA per sample (f32 — portable; f16
 *                             in storage needs the shader-f16 feature, and the
 *                             sample counts here are modest, ≈9-12 MB at Trunks)
 *   zs:      array<f32>       per-sample Z, ASCENDING within a pixel ⇒ early break
 *   params:  vec4<f32>        (width, height, zClip, unused)
 *
 * Bindings are a fixed, hand-authored layout (a DEDICATED pipeline in
 * `webgpu/device.ts`, like the reduce pass) — NOT the generic
 * `parseWGSLBindings` scheme, which only knows uniform/texture/sampler.
 *
 * ## Orientation
 * `@builtin(position)` row 0 is the top of the render target, matching the
 * wasm CSR's row-major top-to-bottom pixel index `y*width + x` and the wasm
 * flat upload — so GPU composite and wasm flatten agree pixel-for-pixel (the
 * browser harness asserts this within f16 tolerance).
 */
export const deepCompositeWGSL = /* wgsl */ `
struct Params { dims: vec4<f32> }; // x=width, y=height, z=zClip, w=unused

@group(0) @binding(0) var<storage, read> offsets: array<u32>;
@group(0) @binding(1) var<storage, read> colors: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> zs: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  // Single oversized triangle covering the viewport.
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  return vec4<f32>(p[vid], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
  let w = u32(params.dims.x);
  let h = u32(params.dims.y);
  let x = u32(frag.x);
  let y = u32(frag.y);
  if (x >= w || y >= h) { return vec4<f32>(0.0, 0.0, 0.0, 0.0); }
  let idx = y * w + x;
  let start = offsets[idx];
  let end = offsets[idx + 1u];
  let zClip = params.dims.z;
  // Front-to-back OVER over premultiplied samples: acc += (1 - acc.a) * sample.
  var acc = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  for (var s: u32 = start; s < end; s = s + 1u) {
    if (zs[s] > zClip) { break; } // samples ascending in Z ⇒ the rest are farther
    let c = colors[s];
    let wgt = 1.0 - acc.a;
    acc = acc + wgt * c;
  }
  return acc;
}
`;
