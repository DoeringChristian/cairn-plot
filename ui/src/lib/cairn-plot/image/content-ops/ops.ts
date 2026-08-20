/**
 * The built-in content ops (Phase 1 — IDENTITY only). Mirrors
 * `image/encodings/curves.ts`: each op carries BOTH its WGSL snippet and its
 * `cpu` twin on one object, so the GPU shader assembly and the CPU pane are the
 * SAME declaration.
 */
import { registerContentOp, type ContentOp } from "./registry.ts";

/**
 * IDENTITY — the single-source passthrough. This is "where the source sample
 * enters the display pipeline": its WGSL is the sampled source slot `a` verbatim
 * (a `vec4<f32>`), and its `cpu` returns the sampled slot's channel vector
 * unchanged. Output arity is `"source"` (a passthrough — an RGB source stays
 * k=3, a scalar stays k=1); output range is `light`; the default DISPLAY encoding
 * is `srgb`. Declares no params (the split/blend knobs belong to future
 * compositor ops). So a pane routing its content through identity renders
 * byte-for-byte as before the registry existed.
 */
const identity: ContentOp = {
  id: "identity",
  label: "Identity",
  sourceArity: 1,
  renderClass: "direct",
  outputArity: "source",
  outputRange: "light",
  defaultEncoding: "srgb",
  params: [],
  // The sampled source enters the display pipeline HERE — passthrough.
  wgsl: "a",
  cpu: (sources) => sources[0] as number[],
};

export const CONTENT_OPS: ContentOp[] = [identity];

let registered = false;
export function registerContentOps(): void {
  if (registered) return;
  registered = true;
  for (const op of CONTENT_OPS) registerContentOp(op);
}
