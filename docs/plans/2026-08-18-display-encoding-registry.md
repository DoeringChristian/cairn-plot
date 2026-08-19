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

## Phase 3 — DONE (commit d4e5045)

The separate colormap + tone-map menus collapsed into ONE arity-gated DISPLAY
menu (`renderers/display-encoding.ts`: `usePaneEncoding` owns the single
`encoding` id — structural curve↔lut exclusivity, per-arity memory, arity
fall-back — + `displayToolbarButton` with CURVES/COLORMAPS/REMAPS sections split
by a labelled `header` hairline divider that keyboard-nav skips). Both image
panes (GpuImagePane, CpuImagePane SDR+HDR) drive it; EV/OFF/PK/γ sliders now gate
off the ACTIVE encoding's `params` manifest. The bus carries one `encoding` key
(+ derived `colormap`/`tonemap` back-compat, so the compare pane — whose two
menus are MODE-scoped, never co-shown, hence left as-is — still follows). Gates:
typecheck, 556 node tests, all 23 parity harnesses, gallery (27 types) green.
Phase 4 needs to know: the float-LUT path is still cmap-mode `linear` only (norms
log/power + min/max + the `shared.colorRange` double-apply audit remain); Phase 5
absorbs `tonemap.ts`, deletes the per-pane switches, and generates schema/Python
from the registry (`use-image-controller`'s `colormapToolbarButton`/
`tonemapToolbarButton` survive ONLY for the compare pane).

## Phase 4 — DONE (commit c16db89)

NORMS + BOUNDS landed on the DATA (lut) encodings. The lut manifest now declares
`exposure`/`offset`/`min`/`max`/`norm`; a NEW pure `computeDataIndex` (registry) is
the CPU source of truth — the WGSL twin `cairnDataIndex` (in `LUT_FAMILY_WGSL`,
new uniform `u_bind9`) is kept byte-parallel and the `encoding-registry` parity
harness proves it (log / power2 / power0.5 / bounds / bounds+log, per lut, GPU ===
`enc.cpu`). Norm = the nonlinear reshape of the normalized index: `linear`
(identity), `log` (a log squeeze of the index clamped to `LOG_NORM_EPS=1e-4`, so
non-positive floors to the ramp bottom — the documented convention), `power`
(`clamp01(t)^exp`; the exponent REUSES the `gamma` param slot — free on the lut
path, no new uniform). A tiny lut-only `normToolbarButton` (Linear · Log · Power)
shows the picker; the power exponent rides the reused γ slider.
**min/max UI decision (v1):** lut encodings declare BOTH skins but the UI shows
EV/OFF by DEFAULT and min/max sliders only when the descriptor seeds a
`colorRange` (avoids slider overload) — when the bounds skin is engaged EV/OFF are
hidden AND neutralized so the two affines are never composed (single-application).
**colorRange audit outcome:** `shared.colorRange` reaches image panes as a prop
(LeafView `mergedProps`) but was — until Phase 4 — a DEAD prop for images (only 3D
viewports + the grid Colorbar read it), so NO pre-existing double-apply existed.
Phase 4 makes it the seed for the min/max bounds skin; the single-application
invariant (bounds XOR exposure/offset, never both) is enforced by the
`boundsEngaged` gate in both panes + the `computeDataIndex` bounds branch (which
ignores exposure/offset), and pinned by a node test
(`registry.test.ts` "SINGLE-APPLICATION invariant"). No Python/schema change (the
existing `SharedProps.colorRange` / `cp.Shared(colorRange=…)` surface flows
through unchanged — no new kwargs invented). Gates: typecheck, 562 node tests, all
23 parity harnesses, schema-in-sync, gallery (27 types) green.
Phase 5 needs to know: norms/bounds are wired on the FLOAT-LUT path only — the
8-bit SDR false-color colormap (baked CPU-side via `applyColormap`) and the compare
pane's diff-display do NOT yet honor norm/bounds; `renderCompose`'s dead `isScalar`
branch still lacks the `u_bind9` uniform (fine — every caller passes `isScalar:false`).

## Phase 5 — DONE (commit b614b4f)

CLEANUP + single-source generation, behaviour-identical (no rendered-output/UX
change — pinned by the unchanged parity harnesses + gallery).

**ABSORBED `image/tonemap.ts`.** Its registry-delegate exports are gone: the peak
curve wrappers (`extendedClamp/Reinhard/AcesCurve`), the CPU operator table
(`TONEMAP_OPERATORS`), its resolver (`getTonemapOperator`) and the peak-aware
triple dispatch (`applyTonemapOperatorTriple`) were thin pass-throughs to
`image/encodings`; every caller now applies a curve straight from the registry via
`getEncoding(id).cpu(rgb, 3, params)` (CpuImagePane's CPU fallback, the
`image-pass`/`compare-pass` parity harnesses, and the two library barrels — which
dropped the `TONEMAP_OPERATORS`/`getTonemapOperator` re-exports). The dead
post-unification classifiers + menu-group arrays (`isHdrTonemap`, `tonemapHasPeak`,
`HDR_TONEMAP_OPERATORS`, `EXTENDED_ROLLOFF_OPERATORS`, `EXTENDED_PEAK_OPERATORS`)
were removed. What GENUINELY STAYS (documented in the module header) is the
NON-registry layer: the exposure + output-encode pipeline STAGES, the sRGB transfer
fns, the gamma/peak UI config, and the unified render-translation (`resolve*` +
the deprecated-alias tables). `SDR_TONEMAP_OPERATORS` is now DERIVED from the
registry (non-HDR curves + remaps), so the menu set can't drift; `tonemap.test.ts`
re-points its curve goldens at the registry via thin local adapters. Net ~150 LOC
of delegates/dead-code deleted from `tonemap.ts` (645 → ~470 lines).

**MENUS from the registry.** The tone-map + display-transfer toolbar option lists
(`use-image-controller.ts`) now source BOTH their id set (`SDR_TONEMAP_OPERATORS`,
already registry-derived) AND their labels (`encodingLabel` → the entry `label`)
from the registry; the hand-maintained `TONEMAP_LABELS` map was deleted. The
colormap menu (`COLORMAP_MENU_OPTIONS`) was already `listEncodingsByKind("lut")`-
derived. The compare pane's `colormapToolbarButton`/`tonemapToolbarButton` stay
MODE-scoped (diff vs slide/blend, never co-shown) — NOT force-unified per the
brief — but both now draw their lists from the registry-derived constants, so no
hardcoded option arrays survive on either menu.

**GENERATION / drift.** Chosen approach: a NODE DRIFT TEST
(`image/encodings/registry-drift.test.ts`), not a Python-consumed generated file.
Rationale (documented in the test): the committed JSON *schema*
(`cairn-plot-spec.schema.json`) types `colormap`/`tonemap` as plain `string` — it
carries NO enum, so there is nothing there to generate from the registry; the enum
authority is the cross-face CONTRACT JSON + Python's `components.py` tuples. Wiring
the pure-Python package to import a TS-generated artifact at import time is
invasive, so per the design's explicit escape hatch the drift TEST is the
"can't drift" mechanism: it asserts the REGISTRY ids === the contract
(`colormaps`/`tonemapOperators`) === Python (`_COLORMAPS`/`_TONEMAP_OPERATORS`).
The registry is the source; the test names exactly which mirrors to update.

**Phase-4 loose ends — explicit NON-GOALS (deferred, unchanged behaviour).** All
three are either output-CHANGING feature work (off-limits in a behaviour-identical
cleanup phase) or dead code, so they are documented rather than fixed:
  1. The 8-bit SDR false-color path (CPU `applyColormap`) does NOT honor
     `norm`/`bounds` — threading `computeDataIndex` there would change rendered
     output for 8-bit colormap+norm images. Follow-up.
  2. The compare pane's diff-display does NOT honor `norm`/`bounds` — same reason
     (and the compare pane isn't on the settings-sync bus yet, task #87).
  3. `renderCompose`'s `processSide` `isScalar` branch still lacks the `u_bind9`
     norm uniform + a `cairnDataIndex` call. It is DEAD (every `renderCompose`
     caller passes `isScalar:false`; diff routes through `diff-engine`, not
     compose), so it is latent-only; left as-is rather than plumbed or deleted
     (deleting would rip the shared `lut` binding out of the compose shader).

Gates: typecheck, 566 node tests (+5 drift), all 23 parity harnesses, 252 pytest,
schema-in-sync, gallery green; plot-inline bundles rebuilt + synced.

## Epic complete

The tonemap/colormap split is fully unified. END STATE:
  - `image/encodings/` is the SINGLE SOURCE OF TRUTH for "how do the selected
    channels become RGB": each `DisplayEncoding` carries `kind` (curve/lut/remap),
    arity, param manifest, `operatorId`, a WGSL curve/family expression, and a
    `cpu` twin. The GPU shaders (`image.wgsl.ts`, `prelude.wgsl.ts`), the engine's
    `OPERATOR_ID`, the CPU panes, the menus, and the `SDR_TONEMAP_OPERATORS` set
    are all ASSEMBLED/DERIVED from it; GPU↔CPU byte parity is proven mechanically
    by the `encoding-registry` harness.
  - ONE arity-gated DISPLAY menu (`usePaneEncoding` + `displayToolbarButton`)
    drives both image panes with per-arity memory + structural curve↔lut
    exclusivity; a per-pane name-keyed param store gives slider continuity across
    encoding switches. Colormaps are legal on the float/unified surface; DATA
    encodings carry norms (linear/log/power) + optional min/max bounds.
  - Cross-face enums (schema contract + Python) can't drift from the registry
    (drift test); `tonemap.ts` is now purely the non-registry pipeline-stage +
    render-translation layer.

DOCUMENTED NON-GOALS carried out of the epic: norm/bounds on the 8-bit false-color
and diff-display paths, and the dead `renderCompose` `isScalar` branch (all above);
plus the compare pane joining the settings-sync bus (task #87). The compare pane's
two mode-scoped menus were deliberately NOT force-unified.

## Follow-up: lut controls row + multi-channel luts — DONE (commit 1defc58)

Two user directives, both landed.

**1. CONTROLS-ROW SEPARATION.** Every control an active encoding declares now
renders in the SECOND toolbar row alongside EV/OFF/PK/γ, never next to the DISPLAY
menu. The NORM picker (Phase 4 had it as a `normToolbarButton` dropdown in
`leadingMenus`, next to the DISPLAY button) moved into the second row as a compact
SEGMENTED control (Lin·Log·Pow). New row idiom: `ToolbarSegmentSpec` +
`ToolbarConfig.segments`, rendered by a new `ToolbarSegment` in `PlotToolbar` at the
LEADING edge of the second row before the sliders (and in the folded overflow as
rows) — the fold key, the null-guard and the second-row render condition all now
count segments. `ImagePaneShell` gained a `rowSegments` prop feeding
`toolbarConfig.segments`. min/max BOUNDS were ALREADY second-row (`extraSliders`),
so they needed no move. Panes drop `normToolbarButton` from `leadingMenus` and pass
`normSegment(...)` (lut-active) via `rowSegments`. `normToolbarButton` is deleted;
`normSegment`/`reduceSegment` (+ `REDUCE_MENU_OPTIONS`) live in `display-encoding.ts`.

**2. MULTI-CHANNEL COLORMAPS.** lut encodings now declare `arities:[1,2,3,4]`
(was `[1]`): a k>1 sample is REDUCED to a scalar before the LUT. `ReduceMode` =
`luminance` (Rec.709 `0.2126R+0.7152G+0.0722B` over the first 3 color channels,
alpha ignored, a missing color channel counts as 0) | `mean` (average of the
`min(k,3)` color channels). DEFAULTS (`defaultReduceMode`): luminance for k≥3, mean
for k=2, identity for k=1. The CPU source of truth is `reduceToScalar` (registry),
applied inside the lut `cpu` twin BEFORE `computeDataIndex`; the GPU twin
`cairnReduceScalar` (in `LUT_FAMILY_WGSL`) is byte-parallel and runs in
`image.wgsl`'s `isScalar` path on the post-exposure/offset `rgb` before
`cairnDataIndex`, keyed on a NEW uniform `u_bind10` (reduceMode.x, channelCount.y —
u_bind9 was full, so a new slot per the "only if none free" rule). `ImageParams`
gained `reduce`+`channelCount`; both panes pass them + expose a `reduceSegment`
(Lum·Mean) in the second row, shown only when the active encoding is a lut AND
sourceArity>1. `usePaneEncoding` arity gating now offers luts at every k∈[1,4]
(`lutIdsForArity`, filtering by each entry's `arities`); per-arity memory + the
channel-selector interplay are unchanged. `reduce` is a per-pane override (null =
follow the k-based default), synced (`ImageSyncSettings.reduce`) and HOME-reset.

**Reduce defaults chosen:** luminance for k≥3 (perceptual weighting is the sensible
RGB/RGBA default), mean for k=2 (no meaningful luma without blue). Deviations: for
k=2 luminance the missing blue channel counts as 0 (defined, non-default edge case);
only the 4th channel is treated as alpha (`colorChannelCount = min(k,3)`, so a
2-channel source is two color channels). The 8-bit SDR false-color pane keeps NO
norm/reduce controls (arity 1, and the documented non-goal above stands).

**Tests.** Node: `registry.test.ts` updated (lut arities `[1,2,3,4]`, params add
`reduce`, `ALLOWED_PARAMS`) + new reduction-math tests (REDUCE_ID, exact Rec.709
weights, `defaultReduceMode`, `colorChannelCount`, `reduceToScalar` per mode incl.
alpha-ignored, and the lut `cpu` reduce-then-index equivalence). Parity harness:
per-lut k=3 luminance + mean cases (GPU `cairnReduceScalar` === cpu twin). Gates:
typecheck, 574 node tests (+8), all 23 parity harnesses green on real GPU,
plot-inline bundles rebuilt + synced, gallery (27 types) clean. No schema/Python
change (reduce is a view-local sync key like norm, not a descriptor kwarg).
