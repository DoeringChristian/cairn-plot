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

## Follow-up: compare pane on DISPLAY conventions — DONE (commit 63c58fa)

The user reported the SLIDE view "still behaves differently, it seems to use the
old conventions." The compare pane (`media-compare/GpuComparePane.tsx`) still had
its own separate tone-map (slide/blend) + colormap (diff) toolbar buttons — the
pre-registry pair — instead of the ONE DISPLAY menu the image panes adopted in
Phase 3. Unified onto the display-encoding conventions.

**1. ONE DISPLAY menu.** The pane's two mode-scoped buttons collapsed into ONE
arity-gated DISPLAY menu (id `display`, aria-label "Display encoding" — the SAME
as the image panes). New pure builder `compareDisplayToolbarButton`
(`renderers/display-encoding.ts`, node-tested): the compare pane's two encoding
FACES are structurally exclusive BY MODE (that IS the arity gating), so only one
section ever applies — slide/blend show the LIGHT curves (Linear·sRGB·Gamma·
Reinhard·ACES); diff shows `None` + the colormap LUTs (the scalar error map is a
DATA encoding). The `normal` remap is dropped from the light face (the compose
shader assembles with `remaps:false`, so it was a latent no-op — a menu-only
change, no rendered-output change).

**2. Second-row controls from the manifest.** EV/OFF/PK/γ already gated the way
the image panes do (curves declare exposure/offset; PK on an engaged HDR surface;
γ for the Gamma curve). ADDED the DATA-encoding NORM picker (Lin·Log·Pow) as a
second-row SEGMENTED control (`normSegment`, `rowSegments`) — shown ONLY in diff
mode while a colormap is active — plus the power-norm `exp` slider (reuses the γ
slot). Reduce is hidden (the diff error map is k=1 scalar). min/max BOUNDS are
NOT shown — see documented-remaining below.

**3. Diff display honors NORM (was non-goal #2).** `renderDiffDisplay`
(`engine/diff-engine.ts`) now threads `norm`/`normMin`/`normMax`/`gamma` through a
NEW `u_norm` uniform (`@binding(20)`, packed exactly like image-engine's
`u_bind9`) and calls the SAME `cairnDataIndex` (already in `LUT_FAMILY_WGSL`,
already parity-proven) between the error `avg` and `cairnLutColor`. `norm:"linear"`
+ no bounds ⇒ `dataIdx == avg`, so the pre-follow-up diff colormap is byte-for-byte
unchanged. Parity: `compare-pass.browser.ts` gained a diff-display norm case
(GPU colormap index === CPU `computeDataIndex` twin, per norm: linear/log/power@2/
power@0.5).

**4. Settings bus.** The pane now carries the ONE `encoding` key
(`deriveCompareEncodingId` — a lut id in diff+colormap, else the light curve;
always a valid registry id so an image-pane peer never lands on a non-registry
token) + the `norm` key, alongside the legacy `colormap`/`tonemap` keys (kept for
back-compat). Apply honors incoming `encoding` (lut → diff colormap face; curve →
slide/blend face) plus the legacy keys. HOME resets norm to linear.

**5. Harnesses.** `gpu-compare-menus` clicks the unified "Display encoding" menu
(was "Colormap"); `compare-settings-sync` gained an `encoding`-follows + a NORM
sync assertion (existing change*/getters kept). `gpu-compare-split-numbers` /
`selection-stage` needed no change (no compare-menu-label dependency;
selection-stage already probes the unified "Display encoding" button). Behavior
beyond the unification is untouched (split divider, [/]/arrow flip, metrics,
captions, TEV readback).

**DOCUMENTED-REMAINING (clean subset, not half-wired):**
  - Diff **min/max BOUNDS**: the shader path is fully plumbed (`u_norm` carries
    `boundsMin`/`boundsMax`/`boundsActive`, `renderDiffDisplay` accepts
    `normMin`/`normMax`), but the compare descriptor seeds no `colorRange`, so no
    bounds UI is shown yet. Threading a `colorRange` prop into `cp.Compare` (like
    the image panes' `shared.colorRange`) would light it up with zero engine work.
  - `use-image-controller.ts`'s `colormapToolbarButton`/`tonemapToolbarButton` (+
    `TONEMAP_MENU_OPTIONS`) are now UNUSED (the compare pane was their last
    consumer) — dead exports left in place for a cleanup pass, not removed here.
  - Cross-MODE/-type sync nuance (a curve-face patch clearing a diff-face colormap
    via the derived `colormap:"none"`) matches the image panes' convention; the
    full compare↔compare sync polish is task #87.

Gates: typecheck, 580 node tests (+6 compare-display-encoding), all 23 parity
harnesses green on real GPU (Apple metal-3), plot-inline bundles rebuilt + synced,
gallery (27 types) clean. No schema/Python change (encoding/norm are view-local
sync keys, not descriptor kwargs).

## Follow-up: analytic red-green (tev-style, unclamped) — DONE (commit b3bfa0b)

The RED-GREEN signed colormap became an ANALYTIC encoding — computed per value in
scene-linear space, output UNCLAMPED — replicating tev's `POS_NEG` tonemap.

**tev convention (source).** `github.com/Tom94/tev`, `src/UberShader.cpp`
`applyTonemap`, `POS_NEG` case:
`vec3(-average(min(col,0))*2, average(max(col,0))*2, 0) + background`. So NEGATIVE
(image < reference) → RED, POSITIVE → GREEN, blue 0, amplitude `2*|v|`, and the
result is left UNCLAMPED (only a later `smoothClamp` brightness-limits it). Ported
faithfully: negative → red, positive → green, gain `SIGNED_ANALYTIC_AMPLITUDE=2`.
This matches the pre-existing cairn signed convention (diff `signed` range folded
`(v+1)/2` so `v<0`→the red end), so no sign flip was needed.

**The analytic encoding.** `DisplayEncoding.analytic` (registry) marks a
`kind:"lut"` entry whose color is COMPUTED — no `needsLut`/`lutName`, no texture
bind. `red-green` keeps its id (descriptors/back-compat/sync keys unchanged) but is
now `analytic:true` with `params:["exposure","offset","reduce"]`. The CPU twin
`signedAnalyticColor` + the WGSL twin `cairnSignedAnalyticColor` (in
`LUT_FAMILY_WGSL`) are byte-parallel; the k>1 sample is `reduceToScalar`-collapsed
to the signed scalar first (tev's `average`).

**SDR/HDR output treatment (the convention chosen).** Unlike a table LUT (which
bakes display-sRGB written to the surface UNCHANGED), the analytic color is
SCENE-LINEAR and flows through the SHARED output-encode — exactly like a curve
(`OUTPUT_ENCODE_WGSL`, newly EXTRACTED so `image.wgsl` + the diff blit share ONE
copy). So the SURFACE's own encoder decides the range: SDR (`outputEncode`) clamps
to `[0,1]`; the extended/HDR surface (`extendedOutputEncode`) lets `|v|>1` SURVIVE
(per W3C ColorWeb-CG). Since the two encoders agree on `[0,1]`, an amplitude
`|v|≤1` renders IDENTICALLY on both surfaces; only `|v|>1` diverges (HDR keeps the
over-range error, SDR clamps). On the float image pane the analytic entry takes the
pane's real `hdrOut` (`rt.hdrOut`), not the LUT path's forced `hdrOut:false`.

**Norms/bounds/exposure.** EXPOSURE scales the amplitude (multiply the signed value
before the map — tev applies exposure before POS_NEG); offset shifts it. The
analytic entry declares NO `norm` and NO `min`/`max`: an unbounded signed
diverging map has no log/power reshape or normalize-to-`[0,1]` affine, so those
pickers are hidden (gated on `hasParam`, not just `isLut`). Documented on
`DisplayEncoding.analytic` + `ANALYTIC_LUT_IDS`.

**Paths wired.** image.wgsl `isScalar` branch (`u_bind10.z` analytic flag →
`ImageParams.analytic`); the diff-display blit (`renderDiffDisplay`,
`DiffDisplayParams.analytic`, new `u_src.z`=analytic/`.w`=hdrOut — BYPASSES the
`(v+1)/2` fold + clamp + LUT, output-encodes the raw signed mean); GpuImagePane +
CpuImagePane (CPU-fallback twin) + GpuComparePane (diff face).

**Tests.** Parity: `encoding-registry` routes analytic entries to a dedicated
signed SDR+HDR case (GPU `cairnSignedAnalyticColor` === cpu twin, incl. ±1.0 →
amplitude 2.0 SURVIVING on the HDR path); `compare-pass` adds a diff-display
analytic SDR+HDR case (row-3 mean error 0.53 → green 1.07 > 1 survives). Node:
`registry.test.ts` — analytic entry shape, `SIGNED_ANALYTIC_AMPLITUDE`/
`signedAnalyticColor` exact ±v colors (unclamped past 1), reduce-then-color twin;
the table-lut shape/`[0,1]` tests now EXCLUDE analytic entries (justified: the
analytic cpu is unclamped-linear + LUT-free, a different contract). Gates:
typecheck, 583 node tests, all 23 parity harnesses green on real GPU (Apple
metal-3), plot-inline bundles rebuilt + synced, gallery (27 types) clean. No
schema/Python change — the `red-green` id + contract/Python enums are unchanged
(the 8-bit CPU `applyColormap` false-color path keeps the old red→white→green LUT,
a documented non-goal, so `COLORMAP_STOPS["red-green"]` stays).
