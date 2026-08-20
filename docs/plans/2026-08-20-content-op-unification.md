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

## Phase 2 — FOUNDATION LANDED / pane wiring REMAINING (commit a83553d)

The **engine + registry half** of Phase 2 is done and gate-green; the **pane +
routing half** (the part that actually kills the flicker) is NOT yet wired.

**Landed (a83553d), zero behavior change — all 24 parity harnesses byte-identical:**
- `image/content-ops` is now a `DirectContentOp | CachedContentOp` discriminated
  union (the union the Phase-1 note deferred). Registered: the six POINTWISE
  diffs as arity-2 `direct` ops (ids == the `engine/kernels` pointwise ids; WGSL
  diff EXPRESSION over slots `a`,`b`; a pure per-channel `cpu` twin = the diff
  pixel-value readout's source of truth; `defaultEncoding` generalizes the
  per-kernel defaults — signed/rel-signed→`red-green`, abs/squared/rel-*→`turbo`),
  and FLIP/HDR-FLIP/SSIM as arity-2 `cached` ops carrying the `kernelId` they
  delegate to (`defaultEncoding` magma). `outputArity:1` is the diff's
  DISPLAY-gating arity (colormaps offered); the content vec4 still physically
  carries the per-channel error the readout reads.
- Shader assembly: `buildContentOpWGSL()` now emits `cairnContent(a, b, opId)` —
  an opId dispatch over the direct ops with IDENTITY as the fallthrough (opId 0,
  the zero-filled default), mirroring `buildApplyOperatorWGSL`. `CONTENT_OP_ID`
  is computed LAZILY (the barrel `export *` evaluates `wgsl.ts` before
  registration runs, so an eager read saw an empty registry — a real ESM
  evaluation-order trap, documented in `wgsl.ts`).
- Engine: `image.wgsl` grew a SECOND source slot (`t_bind11`, logical 11) + the
  `contentOpId` uniform (`u_bind12`, logical 12) + `sampleBilinearB`; `renderImage`
  takes `srcB` + `contentOpId` and binds a 1×1 placeholder for the single-image
  path (opId 0 ignores it → byte-identical). `CpuImagePane` narrows identity to
  its `direct` shape.
- Parity: new `engine/__tests__/content-ops.browser.ts` drives EVERY direct diff
  op through the unified image path (`renderImage(srcB, contentOpId,
  defaultEncoding)`) and asserts the readback === the COMPOSED cpu twin
  (`contentOp.cpu` → `displayEncoding.cpu`) — signed→red-green (analytic) and
  magnitude→turbo, incl. negative mean error + SDR clamp. This proves the unified
  pane's diff CONTENT+DISPLAY render is correct BY CONSTRUCTION before any pane
  rewiring.
- Gates: typecheck; 615 node tests (+6); 24 parity harnesses (metal-3); 243
  pytest; schema/assets/boundary in sync; bundles rebuilt+synced+committed.

**REMAINING (the pane/routing half — not started):**
1. Cached-op rendering on the unified pane: bind the `ensureDiff` result texture
   as slot `a` + identity display (the result IS the scalar error). Generalize the
   diff-cache key to the unified pane's ownership.
2. `GpuImagePane` grows the 2nd source SLOT lifecycle + a content-op MODE menu
   (diff kernels from the registry); reconcile the compare pane's SELF-managed
   two-texture+surface lifecycle vs the pool-managed single-source pane (the key
   structural mismatch — `GpuComparePane` is NOT on the pool).
3. Routing (`ui/src/plot-node.tsx`): a `compare` node in mode `diff` lowers to the
   unified pane (leaves AND stacked-grid slots); a mixed `[image, diff]` stack
   becomes a HOMOGENEOUS stack of unified panes → the existing source-swap path
   (no mount-swap) — THE flicker fix. slide/blend still route to `GpuComparePane`
   (the one documented remount).
4. Chrome migration: the diff metrics chip (MSE/PSNR/MAE/SSIM) + caption ride
   `ImagePaneShell`'s `extraChips`/`overlay.render` seams onto the unified pane.
5. Settings-sync: one path (the bus is ALREADY unified via `deriveCompareEncodingId`).
6. Harnesses: the mixed grid-stacked block must assert NO remount on image↔diff
   flips; `compare-pass` diff parity migrates to the unified pane path. (These are
   INTERACTION harnesses — human/`--all`-run, not the default headless set.)

**⚠ DECISION NEEDED — turbo byte-identity (blocks the "byte-identical to old diff
display" gate for magnitude kernels).** The old diff blit (`renderDiffDisplay`)
renders `turbo` as a PLAIN sequential LUT: raw → `(clamp)` → `cairnDataIndex`
(linear) → `cairnLutColor` (documented in the turbo follow-up: "diff-display
render turbo as a plain sequential LUT"). The unified image `turbo` encoding bakes
tev's FIXED log2 index (`cairnTurboDataIndex`). So routing an abs/squared/relative
diff to the unified pane with `defaultEncoding:turbo` CHANGES the rendered magnitude
mapping (log2 vs linear) — it is NOT byte-identical to today's compare diff. Either
(a) the new turbo-log2 magnitude map is the intended (improved) unified behavior and
"byte-identical" is scoped to signed→red-green + the shared LUT family, or (b) the
magnitude diff ops need a linear-index default encoding to preserve the old blit.
This needs the author's call. (signed→red-green is ALREADY analytic-identical to the
old blit's analytic branch — that half is clean.)

## Phase 1 — DONE (commit d2cb45a)

The `ContentOp` registry landed under `ui/src/lib/cairn-plot/image/content-ops/`
(core-safe, mirroring `image/encodings/`): `registry.ts` (the `ContentOp`
interface + `registerContentOp`/`getContentOp`/`listContentOps` +
`resolveOutputArity`), `ops.ts` (the entries), `wgsl.ts` (the GPU assembler),
`index.ts` (registration side-effect + barrel), plus `registry.test.ts` (shape +
identity-twin) and `registry-drift.test.ts` (the shader-consumes-the-registry
guard). **Only IDENTITY is registered** (sourceArity 1, renderClass `direct`,
outputRange `light`, defaultEncoding `srgb`, no params).

**Dynamic output arity (the identity decision).** `outputArity: number | "source"`.
The `"source"` marker means PASSTHROUGH — the k the DISPLAY stage sees equals the
source channel count (an RGB source stays k=3, a scalar stays k=1). Identity is
`"source"`; resolve against a concrete arity with `resolveOutputArity(op, k)`.
Chosen over a `(k)=>number` function: a marker is declarative and honest, and
identity is the only passthrough op — a full function would over-abstract. Fixed
numbers stay available for the future ops (scalar error = 1, split/blend = 3).

**What moved in the shader assembly.** `engine/shaders/image.wgsl.ts` now
interpolates `buildContentOpWGSL()` — assembling `fn cairnContent(a: vec4<f32>)
-> vec4<f32>` from the registry (Phase 1 body = identity's `wgsl`, i.e.
`return a;`) — and `fs_main` routes the sampled source through
`cairnContent(sampled)` before the display pipeline. Identity is a passthrough
(`content == sampled`), so the ENTIRE display stage downstream (exposure/offset,
`isScalar`/`cairnReduceScalar`/`cairnDataIndex`, analytic/gray-none scalar-modes,
`applyOperator`, output-encode) is UNTOUCHED and byte-identical. No new uniform,
no uniform-layout change (there is exactly one content op, so no `contentOpId`
dispatch is emitted yet — that + a second source slot `b` are Phase 2).
`CpuImagePane.tsx`'s `tonemapToImageData` consumes the SAME declaration: the
per-texel `[r,g,b]` read is routed through `IDENTITY_CONTENT.cpu([[r,g,b]], c)`
(passthrough) before exposure. `image-engine.ts`, `GpuImagePane.tsx`,
`GpuComparePane`, compose, plot-node, and descriptors were NOT touched.

**Gates (byte-pinned).** typecheck clean; **609 node tests** (599 baseline + 10
new content-op tests) pass; **all 23 parity harnesses pass UNMODIFIED** on real
GPU (Apple metal-3) — `image-pass`/`encoding-registry` render through the exact
modified shader and byte-compare to the CPU reference, so passing unmodified IS
the zero-behavior-change proof; 243 pytest; gallery (27 sections) clean; report
regenerates clean (63 blocks) and renders in-browser with no console errors.
plot-inline bundles rebuilt + synced (`core.iife.js` + `gpu-image.iife.js`
carry the assembled `cairnContent`) and committed. No schema/Python change
(content ops are an internal render-stage, not a descriptor kwarg).

**Deviations / notes.** (1) `ContentOp.wgsl` is typed `string` (a direct op's
inline expression); the design's "cached op = pass builder" becomes a
discriminated union in Phase 2 (like `engine/kernels`' Pointwise/Multipass) —
documented, not pre-abstracted. (2) The content-op drift guard has no
TS↔Python mirror (content ops are internal); instead it pins the SHADER to the
registry (asserts `image.wgsl` interpolates `buildContentOpWGSL()` and calls
`cairnContent`), which is the surface that could actually drift. (3) Branch note:
implemented on `diff_unification` (where this design doc + the whole
display-encoding registry it mirrors live at HEAD); the older `tonemapping`
branch predates the design doc and the registry infrastructure.
