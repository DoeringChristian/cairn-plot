# Content-Op Unification — ONE viewport pane for images and comparisons

**Status:** approved (design dialogue 2026-08-20). Implemented in phases; each
phase appends a DONE note here.

## Motivation

Three shipped bugs share one root: two parallel pane implementations
(`GpuImagePane`, `GpuComparePane`) over one shared engine.

1. The compare pane kept pre-unification menu conventions (fixed 63c58fa).
2. `useLegacyImageProps` forwarded `colormap` on the uint8 branch only — the
   float branch dropped it (fixed e342617). The compare pane was unaffected
   because it takes a *different seam* into the same engine.
3. Mixed stacked grids (image + compare) flicker on cross-kind flips because
   the pane MOUNT-SWAPS (341c577) — the canvas is torn down and re-created,
   and every flip pays engine-init + upload latency even where the blank frame
   is hidden.

Every fix so far has been boundary-patching. The boundary itself is the bug.

## The model

A pane's frame is `display_encode(content(uv))` — one persistent surface, one
shader family, two stages.

### CONTENT stage

Produces the k-channel value at each texel from 1–2 **source slots**. Every
current mode is one **ContentOp**. Ops split into two render classes:

| class | ops | where they render |
|---|---|---|
| `direct` | identity, signed, absolute, squared, relative·, split, blend, slide | inline in the display shader — a few ALU ops on 1–2 sampled texels, per frame. No cache; divider drag / blend slider are free. |
| `cached` | FLIP, HDR-FLIP, SSIM | multi-pass compute into a result texture keyed by (source content keys, op id, compute params); the display shader samples it. Zoom / encoding changes never recompute. |

### DISPLAY stage

Unchanged — the existing display-encoding registry (curves / LUTs / analytic,
reduce, bounds, shared output-encode with SDR clamp / HDR extended). It is
gated by the ContentOp's **output arity** instead of the raw source arity: a
scalar error (k=1) offers colormaps; split/blend/identity-RGB (k=3) offer
curves. The arity-gating machinery already exists.

## The ContentOp registry

Mirrors the `DisplayEncoding` house pattern (`image/encodings/registry.ts`):
ONE object per op declares everything; no scattered switches.

```ts
interface ContentOp {
  id: string;                       // "identity" | "signed" | ... | "split" | "flip"
  label: string;
  sourceArity: 1 | 2;
  renderClass: "direct" | "cached";
  outputArity: number;              // k fed to the display stage (1 scalar errors, 3 split/blend/identity-RGB)
  outputRange: "R+" | "R" | "light";
  defaultEncoding: string;          // generalizes the per-kernel defaults:
                                    // identity→srgb, abs/squared→turbo, signed→red-green, FLIP/SSIM→magma
  params?: ParamName[];             // split position, blend t, kernel params → toolbar rows via the manifest idiom
  wgsl: ...;                        // direct: inline `cairnContent(...)`; cached: pass builder
  cpu: ...;                        // twin — parity-tested; single source of truth for pixel-value readout
  chrome?: {                        // React contributions rendered by the ONE pane shell
    metrics?: ...;                  // FLIP mean error chip etc.
    captions?: ...;                 // per-side labels (split/blend/slide)
    gesture?: ...;                  // split divider pointer controller
  };
}
```

The existing `engine/kernels` diff registry becomes the arity-2 ops; identity
is the arity-1 op; split/blend/slide are arity-2 direct ops with
`outputArity: 3`.

## What dies by construction

- Cross-kind flicker + flip latency (every flip is a slot/op rewire on one
  persistent canvas — the 341c577 mount-swap machinery is deleted).
- The seam-drop bug class (one props path into one pane).
- Task #87 (compare settings-sync duplication — one sync path).
- Mode-scoped menu special cases.
- `GpuComparePane` itself (end state).

## Phases

1. **ContentOp registry + identity op.** GpuImagePane consumes content through
   the registry. ZERO behavior change; parity harness pins bytes.
2. **Diff ops.** Pointwise kernels as `direct` ops; FLIP/HDR-FLIP/SSIM as
   `cached` ops behind the generalized result-texture cache. The pane grows a
   second source slot; diff nodes route to the unified pane; per-kernel default
   colormaps become `op.defaultEncoding`. Mixed `[image, diff]` stacks become
   homogeneous — the reported flicker dies here.
3. **Compositor ops.** split/blend/slide as `direct` ops + gesture controller +
   captions/metrics as chrome contributions. Absorbs task #88 (split
   pixel-number misalignment).
4. **Delete GpuComparePane.** Compare nodes lower to the unified pane; the
   mount-swap machinery is removed; CpuImagePane gets the cpu twins; harnesses
   migrate; ONE settings-sync path.

Each phase lands gate-green: typecheck, node tests, all parity harnesses,
pytest, schema/contracts in sync, bundles rebuilt + synced + committed,
report + gallery regen clean.

## Named risks

- Split-divider gesture + pixel-number alignment (fiddly UI; task #88).
- HDR-FLIP's multi-exposure loop is the most complex cached op.
- Harnesses encode the current compare DOM heavily — migrate, don't fork.
