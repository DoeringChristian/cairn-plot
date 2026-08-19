# Display-encoding registry — unify tonemaps + colormaps

**Thesis:** colormaps and tonemap operators are the SAME pipeline slot — rival,
mutually-exclusive answers to "how do the selected channels become RGB". The
current split (two menus, two prop channels, scattered per-pane shader/CPU
paths, "Normal map" hiding in the tonemap list) is historical, not semantic.

## The model (settled with the user, 2026-08-18)

```
channels (1..3)              ← channel selector (parts/layers epic)
  → ENCODING (EXCLUSIVE, arity-gated): the WHOLE mapping ℝᵏ → RGB
       LIGHT curves:  aces/reinhard/srgb/… — declare exposure, offset, peak, γ
       DATA luts:     viridis/magma/…      — declare exposure/offset (sensitivity)
                       or min/max + norm (lin/log/power); arity 1 only
       REMAPS:        normal map = (x+1)/2 — declares NOTHING; arity 3 only
```

Key facts that pinned this down:
- Operators are defined over SCENE-LINEAR input — only affine (exposure) may
  precede them; log/power before a tonemap is never legitimate. Nonlinearity
  belongs INSIDE each encoding (operator ↔ norm are the same slot).
- The encodings are structurally parallel: (compressor, color-assigner) =
  (operator, channel-identity) for light, (norm, LUT) for data. Hence the
  "these feel like the same thing" intuition — and hence exclusivity.
- **There is NO shared affine stage.** The normal map proves it: `(x+1)/2` IS
  the mapping — exposure on it is meaningless. Exposure/offset are ordinary
  PARAMETERS most encodings declare, not pipeline structure. Future encodings
  may reinterpret them (e.g. signed exposure semantics) — the declaration is
  per-encoding; the pipeline doesn't care.
- Existing UX already behaves exclusively (colormap hides the tonemap menu;
  diff mode = LUT + sensitivity + no curve). The model was implicit.
- **NOTED for later (user, not scheduled): the compare pane's DIFF DISPLAY is
  itself a DATA-encoding instance** — scalar error → sensitivity params → LUT.
  Once the registry exists, `renderDiffDisplay`'s private LUT/sensitivity
  plumbing should CONSUME the registry rather than keep its own copy (fold
  into Phase 2 or a follow-up).

## Parameter store (continuity without a shared stage)

A per-pane param store keyed by NAME (`exposure`, `offset`, `peak`, `gamma`,
`min`, `max`, `norm`). An encoding reads only the params it DECLARES; the store
retains everything across encoding switches and channel flips. So exposure set
under `aces` carries to `viridis` (both declare it), is ignored by `normal`,
and is restored on switching back. The settings-sync bus publishes name-keyed
param patches (same partial-apply as today). HOME resets the store.

## The registry (mirrors `engine/kernels` — the house pattern)

```ts
interface DisplayEncoding {
  id: string;                        // "aces" | "viridis" | "normal" | …
  label: string;
  kind: "curve" | "lut" | "remap";   // menu section
  arities: number[];                 // normal: [3]; curves: [1..4]; luts: [1]
  needsHdrSurface?: boolean;         // extended-* curves
  /** Param MANIFEST — which named params this encoding reads. Drives which
   *  sliders render. Exposure/offset are declared here like any other param. */
  params: Array<"exposure" | "offset" | "peak" | "gamma" | "min" | "max" | "norm">;
  needsLut?: boolean;                // lut FAMILY binds a 256×1 texture
  wgsl: string;                      // fn encode(v: vec4f, p: Params) -> vec3f
  cpu(v: readonly number[], k: number, p: Params): [number, number, number];
}
```

- **Shader FAMILIES, not per-entry pipelines**: ~curve / lut / remap families;
  colormaps are ONE family parameterized by LUT texture (texel data, not code).
  Pipeline cache keyed by family id (exactly like diff kernels). Params ride a
  FIXED uniform struct (stable layout; unused slots ignored) — slider drags
  never recompile; the manifest is UI gating only.
- **CPU/GPU parity by construction**: `cpu` + `wgsl` on one object → ONE
  mechanical parity harness iterating the registry.
- **Arity is runtime state** (channel selector): an encoding that doesn't
  support the new k auto-falls-back to the default curve; last-used encoding
  is remembered PER ARITY (flip back to `Z` → viridis restored).
- **Single source of truth**: schema enums + Python validation lists GENERATE
  from the registry. Descriptor/Python keep `tonemap=` / `colormap=` as
  back-compat aliases resolving to encoding ids; the settings bus carries ONE
  `encoding` key + name-keyed params.

## UI

ONE **DISPLAY menu** (standard ToolbarButtonSpec dropdown) replacing the
tonemap + colormap pair: sections by kind, entries gated by the CURRENT channel
arity. Sliders render from the ACTIVE encoding's param manifest — an encoding
with no params (normal map) shows none.

## Phases (each shippable, behavior-identical until 3)

1. **Registry + curve migration** — the 10 operators (incl. extended-*) into
   the registry; both image panes + compare pane render curves through it; the
   param store replaces the scattered per-slider state. Parity harness lands.
2. **LUT family** — colormaps as registry entries; LUT encoding legal on the
   float/unified surface (subsumes task #86); diff-mode display consumes the
   family (the noted unification above).
3. **Menu unification** — one DISPLAY menu, arity gating, per-arity memory,
   "Normal map" moved to kind:"remap". Old menus deleted.
4. **Norms + bounds** — log/power and min/max params for the DATA encodings
   (audit the shared.colorRange touchpoint for double-apply).
5. **Cleanup** — tonemap.ts absorbed; per-pane switch statements deleted;
   schema/Python generation from the registry.

## Why this wasn't caught earlier

The tonemap/colormap split predates the channel work; every incremental diff
conformed to it locally, and diff-scoped review passes validate changes against
the existing architecture rather than questioning it. The unification became
visible only when the channel selector made "what do the selected channels
become" a first-class question. Lesson: periodic structure-level review, not
only diff-level.

## Phase 1 — DONE (commit 77446c8)

The `DisplayEncoding` registry landed under `ui/src/lib/cairn-plot/image/encodings/`
(core-safe, mirroring `engine/kernels`): the 10 curve/remap operators carry their
`cpu` twin + a WGSL curve expression + `operatorId` on one object; `image.wgsl.ts`,
`prelude.wgsl.ts` (compose) and `image-engine.ts`'s `OPERATOR_ID` are all now
ASSEMBLED/generated from it, and `image/tonemap.ts` keeps every export but
delegates the curve math to the registry. Behaviour-identical — pinned by
`tonemap.test.ts`, the new node `registry.test.ts` (shape) + the new WebGPU
`encoding-registry.browser.ts` parity harness (GPU applyOperator === cpu twin),
and unchanged results across all pre-existing engine parity harnesses.
Scope choices: registry `wgsl` is the operator CURVE only (exposure/output-encode
stay shared stages, per the phased plan); `params` are declared per-encoding
(UI-gating metadata, not yet wired); compose keeps `remaps:false` so the `normal`
remap stays single-image-only (exactly as before). No UI/schema/Python changes.

## Phase 2 — DONE (commit e012536)

Colormaps are now `kind:"lut"` registry entries (`encodings/luts.ts`, generated
from `COLORMAP_STOPS` → arity `[1]`, `needsLut`, `lutName` table ref, sensitivity
params) driving the colormap menus via `listEncodingsByKind("lut")`; ONE shared
`LUT_FAMILY_WGSL` (`cairnLutColor`) + `colormapFloatLUT` table now back BOTH the
single-image `isScalar` path (which short-circuits operator/output-encode — the
LUT holds display sRGB) AND `renderDiffDisplay` (its private LUT/index plumbing
deleted), so the diff blit and the image LUT are literally one family. Colormap is
legal on the FLOAT surface (task #86): GpuImagePane renders a scalar float source
through the LUT family (scalar→exposure/offset→LUT), CpuImagePane's HDR path has
the CPU twin, both exposing the colormap menu (exclusive with the tonemap menu).
The `encoding-registry` parity harness now covers the LUT family (GPU LUT ===
cpu twin per colormap). Deviations: the float-image LUT uses cmap-mode `linear`
only (diverging fold + min/max/norms are Phase 4); the compose `processSide`
`isScalar` branch (dead — every caller passes `isScalar:false`) was left as-is.
Phase 3 (menu unification) needs to know: the LUT entries + `listEncodingsByKind`
are ready to feed ONE Display menu with kind sections; per-arity memory + moving
`normal` to a `remap` section is all that remains.
