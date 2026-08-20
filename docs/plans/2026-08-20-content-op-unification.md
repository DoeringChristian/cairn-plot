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

## Phase 4 — DONE / EPIC COMPLETE (commits d821875, 28e4275, + the sweep commit)

`GpuComparePane` is DELETED. There is now ONE viewport pane — `GpuImagePane`
(+ its `CpuImagePane` CPU twin) — for images AND every image-compare mode (diff,
split, blend), reached identically from the descriptor tree AND the cross-type
card/3D-snapshot consumers. The two-parallel-panes-over-one-engine root cause the
Motivation named is gone by construction.

**Consumer migration (d821875).** The last two `GpuComparePane` consumers —
`ImageViewportPane` (image card) and `OffscreenComparePanes` (live-3D snapshot
compare), both via `CompositeMediaPane` → `CrossTypeCompositeMediaPane` — now
render the unified `GpuImagePane` + `compareSource`. The design question the
brief posed (an image operand vs a rendered-3D-snapshot operand) resolves
cleanly: AFTER the offscreen snapshot BOTH sides of a cross-type compare are
plain decoded sources (a URL or a decoded float side), so the unified image pane
serves them directly — no consumer needed live dual-texture compositing the
unified pane can't expose, so NONE had to stop. `compositor.tsx`'s
engine-composited branch builds `source` = slot a = REFERENCE
(`baselineUrl`/`baselineFloat`) and `compareSource.b` = slot b = FOREGROUND
(`imageUrl`/`imageFloat`) — byte-parity with the old `texA − texB` (texA =
reference, verified against `GpuComparePane`'s texture assignment). It resolves
the pane through the SAME `__cairnPlotGpuImagePane` window seam
`plot-renderers.tsx` uses; the compare-only seam `__cairnPlotGpuComparePane` is
gone. `CompositeMediaPane` stays as the CORE dispatcher (its CPU fallbacks —
`MediaComparePane` / `CpuFloatComparePane` / the diff `CpuImagePane` — are the
cross-type consumers' real CPU composite and are unchanged).

**Deletion + sweep (28e4275).** Deleted `media-compare/GpuComparePane.tsx`
(~1990 LOC) + the 3 human-run interaction harnesses that mounted it
(`gpu-compare-menus`/`-geometry`/`-diff-readback`, .ts + .html, ~1470 LOC), whose
coverage is FOLDED into the self-driving parity set (kernel/colormap menu
compute-decoupling → `content-ops` cache-hit compute-count + `gpu-image-diff`
MODE-menu switch; split-boundary geometry → the migrated `gpu-compare-split-numbers`;
FLIP TEV readback → `content-ops` cached-readback parity + `gpu-image-diff`).
Deleted dead exports whose last consumer was `GpuComparePane`:
`use-image-controller.ts`'s `colormapToolbarButton`/`tonemapToolbarButton`
(+ `TONEMAP_MENU_OPTIONS`), and `diff-engine.ts`'s `ensureDiffScalars`. ~3.5k LOC
net removed. Migrated importers: the addon (stops injecting the compare seam),
`media-compare/index.ts` (stops exporting it), `engine-fallback` cases 3/4 →
`GpuImagePane` + `compareSource`, the two default-set harnesses
(`compare-settings-sync`/`grid-stacked-persist`) drop the dead compare-pane
injection, and the source-guard unit tests (split-divider / ref-badge /
label-chip / toolbar-seam) retargeted onto `GpuImagePane` (+ `CpuImagePane`
compare chrome).

**Kept (reused by the unified pane, NOT orphaned):** `buildCompareModeMenu`
(`compare-mode-menu`), `compareCaptions`, `computeCompareMapping`,
`SplitDivider`, `use-split-flip-keys`, `RefBadge`/`LabelChip`, the diff kernels,
`compareDisplayToolbarButton`/`deriveCompareEncodingId`. `renderCompose` /
`renderDiffDisplay` REMAIN as engine primitives still exercised by the parity
harnesses (`compare-pass`/`flip`/`ssim`/`hdr-flip`) — no longer on any production
pane path, but their parity proofs are retained (the brief's "delete … if nothing
consumes it" condition isn't met while a harness proves them).

**Task #87 (compare settings-sync duplication) — CLOSED.** There is now ONE
settings-sync path: the unified pane's `useSyncedImageSettings` bus. The compare
display-encoding bridge `deriveCompareEncodingId` is now INTERNAL to that one
pane (consumers: `renderers/display-encoding.ts` where it lives, +
`renderers/GpuImagePane.tsx` — no second pane, no duplication to reconcile), so
#87's concern is closed by construction rather than by a new abstraction. No code
change was needed beyond the deletion.

**Harness migrations.** The 3 human-run `gpu-compare-*` harnesses are folded into
the self-driving set (above) — none silently target deleted code. `engine-fallback`
(human-run) cases 3/4 drive the unified pane. All 25 default parity harnesses stay
green on metal-3.

### DEVIATION / remaining gap — CPU compare composite (Phase-4 item 3, partial)

The brief's "CpuImagePane gets the compositor cpu twins — a real CPU split/blend
composite … diff via the pointwise twins" is **documented as a deferred gap**, not
landed, for a concrete structural reason discovered during implementation:

- A real CPU **diff** renders a `<canvas>` (the `image/diff.ts` `computeDiff`
  pixel path). But in CPU mode the homogeneous `[image, diff]` STACK relies on the
  image tab AND the diff tab rendering the SAME `<img>` surface, so the stacked
  image↔diff flip stays a seamless same-DOM-node swap (NO remount) — this is
  exactly what `stack/grid-stacked` asserts (it forces `render=cpu`). A
  canvas-based CPU diff reintroduces an `<img>`→`<canvas>` surface swap on the
  flip, breaking that no-remount invariant (empirically confirmed: the harness's
  image↔diff persistence + zoom-persist checks fail). Completing this correctly
  requires the CPU diff to render into the SAME `<img>` surface (compute →
  data-URL), which is a real feature with its own validation burden — deferred
  rather than shipped unvalidated.
- A real CPU **split/blend** is a VIEWPORT-space (dest-space) composite, not a
  per-source-texel one, so the "per-texel via the op cpu twins" shortcut the brief
  suggested does not directly apply; it needs the `MediaComparePane`-style
  CSS/clip composite.

Impact is narrow: this is ONLY the DESCRIPTOR path's compare fallback in a
no-WebGPU / `render=cpu` environment. It keeps the Phase-3 behavior — the
REFERENCE rendered degraded + the full compare CHROME (per-side captions + split
REF badge, same DOM/selectors) so reference re-pick + labeling work. The
cross-type consumers are UNAFFECTED — they still get a real CPU split/blend/diff
via the compositor's preserved `MediaComparePane` / `CpuImagePane`-diff /
`CpuFloatComparePane` fallbacks (the `cpu-compare-fallback` harness pins this).
The cached kernels (FLIP/HDR-FLIP/SSIM) stay GPU-only with degraded+chrome, as
the brief specified. `CpuImagePane`'s doc comments record the gap + the correct
completion shape.

**Schema / contracts:** unchanged — the descriptor surface (`cp.Compare` /
`cp.Image`) is untouched; content ops + panes are an internal render-stage. The
Python docstrings (`bundle.py`/`elements.py`) + `docs/API.md` that named the
deleted pane were updated to the unified-pane wording.

**Gates (every commit):** typecheck; 615 node tests; all 25 parity harnesses
(metal-3); 243 pytest; core + gpu-image bundles rebuilt (gpu-image 404→369 KB) +
synced + committed; report (63 blocks) + gallery (27 types) regen clean; live
report spot-check.

## Phase 3 — DONE (commits 9f70506, 04a5e64, a96ab54, + the harness/doc commit)

split/blend became `direct` compositor ContentOps on the unified pane; the last
cross-kind remount is gone. Landed in four green stages.

**Registry + engine (9f70506).** `split`/`blend` are arity-2 `direct` ops —
`outputArity 3`, `outputRange "light"`, `defaultEncoding "srgb"`, param
`split`/`blend`. Their WGSL joins `cairnContent`'s dispatch as `select(b, a, uv.x
< param.x)` / `mix(a, b, param.x)` (slot a = REFERENCE, b = FOREGROUND — the
diff/routing binding, so split shows the reference left of the divider exactly
like `GpuComparePane`'s `select(colorB, colorA, uv.x < split)`; a hard split is
select-then-display == display-then-select → byte-identical; blend mixes the RAW
light — the unified model, like the turbo-log2 ruling). `cairnContent`'s signature
grew `uv` (the fragment SCREEN uv — the divider is a DEST-space cut) + `param`
(the compositor scalar); the image shader binds a new compositor-param uniform
`u_bind13` and `renderImage` packs `ImageParams.contentParam` into it — divider
drag / blend slider only change the uniform, NO recompile. A per-texel `cpu` twin
(reading a new `ContentOpCpuCtx` = uv+param) drives readout/parity; the diff +
identity twins keep their `(sources,k)` shape (optional arg). `content-ops.browser`
proves split/blend GPU render === the composed cpu twin on BOTH an SDR (clamp +
sRGB OETF) and an HDR (`rgba16float`, extended unclamped encode) surface.

**Pane + chrome (04a5e64).** `GpuImagePane` renders the compositor behind
`compareSource.opId ∈ {split,blend}` (later `compareSource.mode`), through the
pool: `render({contentOpId, contentParam})`, the pool injects `srcB`, one LIGHT
display pass (isScalar false). Chrome ported from `GpuComparePane`: the shared
`SplitDivider` (a wrapper child, `left:split%`, agreeing with the shader's
screen-space `uv.x < split` by construction), `useSplitFlipKeys` ([ / ] / arrows),
`RefBadge` (split), per-side caption chips (reference bottom-left, foreground
bottom-right), the MSE/PSNR/MAE/SSIM chip (all compare modes), and the MODE menu +
the mode's DISPLAY menu (light curves for a composite, scalar colormap for diff).

**Routing + retire (a96ab54).** `NodeDispatch` lowers a compare node in ANY mode
(diff AND split/blend) to `LeafView` + `compareSource` — the SAME component an
image leaf renders. `CompareSource.mode` is explicit (`opId` stays the diff
kernel). `stackKindKey` returns `plot:image` for EVERY compare node, so
`[image,split]`, `[diff,blend]`, … are all homogeneous → source-swap on ONE reused
pane. **The 341c577 `mixedImageStack` + `stackPaneSync` machinery is retired**
(the two sync-group ids, the memo, the conditional `PaneSyncContext.Provider`);
`canStack` is just `homogeneousStack`. `CompareView` + the `CompositeMediaPane`
route are DELETED from `plot-node` (no descriptor-tree caller left).

**Harness coverage + verify (this commit).** `gpu-compare-split-numbers` (the #88
proof) migrated onto the unified pane (`GpuImagePane` + `compareSource:{mode:
"split"}`, `__cairnImageDiffProbe`'s `overlayTexelCenter`/`srcDims`/`readbackSurface`).

### Task #88 — root cause + fix (documented per the brief)

The naive PORT reintroduces #88: the unified pane's `single` `PixelValueOverlay`
maps EVERY texel through the PRIMARY framing dims (`naturalDims`). Both split
operands are drawn stretched into the SAME framing quad (each sampled through one
normalized uv window, scaled by its OWN `textureDimensions`), so the non-primary
side's texel `px` is placed at `quadLeft + (px+0.5)*quadW/primaryW` instead of
`/sideW` — an error PROPORTIONAL to `px` (zero at the left edge, growing with
texel index, WORST at large / mismatched resolution). **Fix:** the compositor
readout uses the shell's `overlay.render` variant to emit TWO split-clipped
`PixelValueOverlay`s, each carrying its OWN `sourceDims` — the reference side
through the framing grid (identity), the FOREGROUND side through `refDims` (its own
grid). This mirrors `GpuComparePane`'s per-side overlays; `computeSourceFit(sourceDims)`
then places each side's numbers on their pixels. Proven by the migrated
split-numbers harness (mismatched 64×48 vs 100×70 + large 1200×800 vs 1100×760:
per-side numbers land <1px on their own grid, the old primary-grid placement drifts
>15px and grows with index).

### What was retired / GpuComparePane's remaining consumers

Retired: `mixedImageStack`, `stackPaneSync` (+ its two `useId` groups + the memo +
the conditional Provider), `compareDescriptorIsDiff`, `CompareView`, and
`plot-node`'s `CompositeMediaPane` import. `GpuComparePane` itself is KEPT (Phase 4
deletes it): its remaining consumers are the CROSS-TYPE / card paths NOT in the
descriptor tree — `ImageViewportPane` → `CrossTypeCompositeMediaPane` (the image
CARD path) and `OffscreenComparePanes` → `CrossTypeCompositeMediaPane` (live 3D /
point-cloud snapshot compare); a 3D operand has no `DecodedSource`, so it can't
lower to the unified image pane.

### Deviations

- **CPU fallback.** The compositor is GPU-only; on `render=cpu` / no-WebGPU,
  `CpuImagePane` renders a compare's REFERENCE image DEGRADED (no live composite)
  but keeps the compare CHROME (per-side caption chips + split REF badge, same
  DOM/selectors) so the selection-stage reference re-pick + labeling still work. A
  real CPU composite is Phase 4 ("CpuImagePane gets the cpu twins"). Captions are
  inlined (compare-captions pulls `engine/kernels` — the core bundle stays engine-free).
- **Per-side srgbDecode.** The unified pane has ONE `srgbDecode` flag (follows the
  primary); a MIXED-dtype split (u8 vs float operands) can't per-side decode like
  `GpuComparePane`. Same-dtype operands (the near-universal case — a compare's two
  sides are the same series/metric) are exact; documented.
- **Compositor sampling.** split/blend sample BOTH slots at the normalized `srcUV`
  (fill-stretch, each by its own dims) — identical to `compare.wgsl` and the direct-
  diff path, so mismatched sizes render like today. `computeCompareMapping` governs
  the metrics + the per-side readout grid (the #88 fix), NOT the composite sampling
  (the brief's "same as diff" — the direct path never mapped the composite either).
- **Visual verify.** All the brief's scenarios (divider drag, [ / ] keys, captions,
  #88 alignment at mismatched res, blend, split→diff→split no-remount, flicker-free
  stack) are covered by the migrated/extended HEADLESS harnesses (split-numbers,
  compare-settings-sync, grid-stacked, grid-stacked-persist). The live in-browser
  eyeball is the HUMAN-RUN step (like the 3 human-run `gpu-compare-*` interaction
  harnesses, which still target the KEPT `GpuComparePane` and are unaffected).

## Phase 2 — DONE (commits a83553d, 5244fc4, 09c4731, 0bb5b94)

Phase 2 is COMPLETE and gate-green. Landing 2 (the routing switch — the flicker
fix) landed per the epic author's ARCHITECTURAL RULING (folded in here, not
relitigated): the image↔diff flip remounted because `LeafView` and `CompareView`
are DIFFERENT React component types at the stacked slot, so the dispatch was
COLLAPSED inside `PlotNodeView` — a diff-mode compare now lowers to the SAME
`LeafView` → `image` renderer → `GpuImagePane` family an image leaf uses.

**How the ruling was implemented (`ui/src/plot-node.tsx`):**
- **Dispatch collapsed into `NodeDispatch`** (a new component one level INSIDE the
  pane's `PaneSelectionFrame`, rendered by `PlotNodeView`). It dispatches on
  `(node.kind + effective compare mode)`: a `compare` node whose lifted `viewMode`
  is `"diff"` → `<LeafView node={synthLeaf} diffSpec={…}/>` (a SYNTHESIZED image
  leaf whose `data` = the reference side + a resolved `compareSource` where `b` =
  the foreground side); `"split"/"blend"` → `<CompareView node control/>` exactly
  as before. Because BOTH the image-plot slot and the diff-compare slot now render
  `LeafView`, an `[image, diff]` stack is homogeneous and the flip is a source-swap
  on ONE reused instance — no remount, no flicker (verified LIVE: the SAME `<canvas>`
  DOM node persists across the flip, and by `stack/grid-stacked`'s new marker-
  persistence assertions + `grid-stacked-persist`'s canvas-survival check).
- **Mode hoisting** (`useCompareControl`, keyed by the pane's sync identity): the
  compare view-mode state (viewMode/diffKernel/splitPos/blendAlpha) is HOISTED out
  of `CompareView` up to `NodeDispatch` — seeded from the descriptor (override-null
  pattern so a fresh compare re-seeds), updated from the panes' menu callbacks AND
  a READ-ONLY subscription to the settings-sync bus (`subscribeImageSettings` on
  `paneSync.settingsSyncGroupId`). The bus read is what lets mode sync across a
  page-wide selection even when the mounted pane is a diff `GpuImagePane` (which
  can't apply a `compareMode` patch itself — that's a routing decision above the
  pane). It NEVER publishes (the panes already publish those keys); it only reads,
  so no loops. Held in a component that is reused across the stacked flip → the mode
  survives stacking; seeded per-descriptor → survives selection.
- **Lowering** (`LeafView` diff path): both operands resolve through the compare
  resolver (`resolveFrame`) — `node.data` (reference) → `source`, `diffSpec.fgData`
  (foreground) → `compareSource.b` — cached once under a stable `|diffpair` key so a
  flip-back is synchronous (no flash). `frameToSource` maps a `ResolvedCompareFrame`
  to the dtype-tagged `DecodedSource`. The LIVE diff settings (kernel/colormap/
  callbacks) merge at render (no re-fetch). `ImageStandalone` threads `compareSource`
  → `GpuImagePane`. **Slot convention: `source` = reference, `b` = foreground**
  (`diff = source − b`, byte-parity with the compare pane's `texA − texB`).
- **`stackKindKey` homogeneity** (descriptor-based): `stackKindKey(compare mode:diff)`
  returns the image-leaf key `plot:image`, so `homogeneousStack([image, diff])` is
  true. This AUTOMATICALLY retires the 341c577 `mixedImageStack` mount-swap path for
  `[image, diff]` (now homogeneous → source-swap, no `stackPaneSync` group), while
  KEEPING it for `[image, slide/blend]` (still `compare`-keyed → mixed). Diff↔slide/
  blend mode switches are the ONE documented remaining remount.
- **Pane edits (`GpuImagePane.tsx`):** `changeCompareMode` now also
  `publishSettings({compareMode})` (so a selected peer's router follows the switch
  out of diff); the `__cairnImageDiffProbe` seam grew `compareMode`/`changeCompareMode`/
  `encodingId`/`effectiveTonemap` + a `changeColormap` alias so a unified harness
  drives either pane across a mode switch.

**Harness deltas:** `compare-settings-sync` + `grid-stacked-persist` migrated to
find the pane by its selectable FRAME (pane-type-agnostic) and read EITHER
`__cairnCompareProbe` (slide/blend) OR `__cairnImageDiffProbe` (diff), and wire
`__cairnPlotGpuImagePane`; `grid-stacked` gained an `[image, diff]` homogeneous
section asserting DOM-marker element persistence + zoom persistence + no hidden
sibling across the flip. All split/blend coverage stays green (the compare-pane
path is untouched).

**Gates:** typecheck; 615 node tests; ALL 25 parity harnesses (metal-3); 243
pytest; assets in sync; bundles rebuilt + synced + committed; report (63 blocks) +
gallery (27 sections) regen clean; LIVE visual verify — stacked validation grid
image↔FLIP flip has NO flicker / NO remount (same canvas node), magma render +
metrics chip present, plain (non-stacked) diff compares work, no console errors.

## Phase 2c — LANDING 1 DONE (diff-capable pane, no routing) (commit 09c4731)

The **DIFF-CAPABLE PANE** (design task C) is landed and gate-green — `GpuImagePane`
now renders a diff when given `compareSource`, driven THROUGH the pool. Routing
(Landing 2 / task D) is deliberately NOT yet wired, so nothing points at the new
capability and every existing gate stays green trivially.

**Landed (09c4731), single-image path byte-identical when `compareSource` absent:**
- `renderers/image-backend.ts` — the `CompareSource` shape (`b` reference operand,
  `opId` diff MODE, colormap override, align/fit, content keys, per-side labels,
  mode/kernel echo callbacks) + the optional `compareSource` prop on
  `ImageBackendProps`. **Slot convention:** `diff = source − compareSource.b`
  (slot a = `source`, slot b = `b`), matching the diff-engine's `texA − texB`; the
  CALLER assigns reference→`source`, foreground→`b` to match `GpuComparePane`'s
  sign (byte-parity is caller-controlled, no swap in the pane).
- `renderers/GpuImagePane.tsx` — a `diffMode` render branch: DIRECT pointwise ops
  render inline (`handle.render({contentOpId})`, the pool injects `srcB`), CACHED
  metrics (FLIP/HDR-FLIP/SSIM) via `handle.renderDiffCached`. DISPLAY reuses the
  pane's own encoding machinery keyed off `resolveDiffColormap(kernel, override)`:
  analytic red-green (signed), turbo-log2 (magnitude), a plain LUT (magma/…), or
  raw per-channel error ("none"). Plus the MODE menu (`buildCompareModeMenu`) +
  scalar-error colormap menu (`compareDisplayToolbarButton`), the MSE/PSNR/MAE/SSIM
  chip + diff caption (via the shell's EXISTING `extraChips` seam — no new
  `ImagePaneShell` props needed, so E collapsed to reuse), the diff TEV readout
  (direct op `cpu` twin / cached RESULT readback), and diff settings-sync
  (`deriveCompareEncodingId` + the override that sticks across kernel switches,
  HOME clears — task F). A `__cairnImageDiffProbe` test seam mirrors
  `__cairnCompareProbe`.
- `engine/pool.ts` — `PaneHandle.computeMetrics` / `computeSsim` / `readDiffResult`:
  the pool owns the two source textures, so the diff CHROME computes over them
  (ported from `GpuComparePane`, routed through the pool — the honest "port, don't
  rewrite").
- **Harnesses:** `content-ops.browser.ts` (default gate) gained a pool-chrome case
  (`computeMetrics`/`computeSsim`/`readDiffResult` === direct engine references).
  New `renderers/__tests__/gpu-image-diff.browser.{ts,html}` — a SELF-DRIVING pane
  harness (in the default set): signed→red-green diverging map (7873 red + 7873
  green px on symmetric data), FLIP→magma, MODE-menu kernel switch, metrics chip,
  HOME reset. Exact per-byte diff-engine equivalence stays pinned by
  content-ops.browser.ts; the pane harness reads the COMPOSITED canvas via
  `createImageBitmap` (an in-DOM canvas rotates its swapchain texture, so a
  `device.readback` of the surface reads blank — a harness-readback gotcha, NOT a
  pane bug; the pane renders correctly).
- **Gates:** typecheck; 615 node tests; ALL 25 parity harnesses (metal-3, incl. the
  new self-driving diff pane harness); 243 pytest; boundary/schema in sync;
  gpu-image bundle rebuilt + synced + committed.

**REMAINING — LANDING 2 (routing / task D) — the flicker fix, NOT started.** This
is the core-dispatch surgery the design flagged as red-gating stack/compare/
selection if done partially. Precise remaining seams:
1. **`CompareView` diff lowering.** A compare node in mode `"diff"` must render a
   `GpuImagePane` with a `compareSource` built from the resolved frames (reference
   → `source`, foreground → `compareSource.b`, each `ResolvedCompareFrame`'s
   `url`→`urlSource` / `float`→`FloatSource`), NOT `CompositeMediaPane`→
   `GpuComparePane`. slide/blend STILL route to `GpuComparePane`; the MODE menu
   switching INTO diff routes to the unified pane (and back on slide/blend — the
   ONE documented remount). Wire `compareSource.onCompareModeChange`/
   `onDiffKernelChange` back to `CompareView`'s lifted `viewMode`/`diffKernel`.
2. **`stackKindKey` homogeneity — THE crux + an ARCHITECTURAL FORK (beyond the
   standing decisions).** `stackKindKey(compare mode:diff)` must equal an image
   leaf's key so `[image, diff]` is `homogeneousStack` → the source-swap reused-
   renderer path (no `stackPaneSync`, no mount-swap). BUT the standing decision
   "stackKindKey(diff) === image-leaf key" is necessary yet NOT sufficient for a
   no-remount flip: the stacked slot renders `<PlotNodeView node={activeChild}/>`,
   which dispatches on `node.kind` → `LeafView` (plot) vs `CompareView` (compare).
   Those are DIFFERENT React component types at the same tree position, so React
   REMOUNTS the subtree (incl. the `GpuImagePane` canvas) on an image↔diff flip
   even though both ultimately render `GpuImagePane` — the flicker survives. AND
   `LeafView` lowers through the renderer-registry `*Standalone` adapter while
   `CompareView` goes through `CompositeMediaPane` — two different pipelines.
   **The fork:** to make the flip a true source-swap, image-plot and diff-compare
   must lower to the SAME component instance at the stacked slot. Options: (a) a
   shared `UnifiedImageView` that both `PlotNodeView` branches (plot-image AND
   compare-diff) render, itself rendering `GpuImagePane` with/without
   `compareSource`; (b) teach `LeafView` to accept a diff-compare node and build
   `compareSource`. Either is a real routing refactor the task's one-liner
   ("lower a diff-mode compare to a GpuImagePane ... so the reused instance ...
   is one component type") under-specifies. This needs the author's call on the
   shared-lowering shape before implementation, since it reshapes the core
   `PlotNodeView`/`LeafView`/`CompareView` dispatch.
3. **Retire `mixedImageStack` for the image+diff case** (keep it for image+slide/
   blend until Phase 3).
4. **Harness migration:** `stack/grid-stacked` mixed section → NO-remount asserts
   (a DOM-marker element persists across image↔diff flips, zoom persists, no hidden
   sibling); `compare-settings-sync` diff expectations onto the unified path;
   `selection-stage`/`compare-pass` as needed; KEEP split/blend coverage green.
5. **Visual verify:** regen report + serve `/private/tmp` + open the stacked-grid
   validation flip (image↔FLIP no-flicker, element persistence LIVE, magma +
   metrics chip).

## Phase 2b — POOL ENGINE half landed (A+B); pane+routing (C–H) REMAINING (commit 5244fc4)

**Turbo log2 — RULING (resolves the ⚠ DECISION NEEDED below).** The turbo-log2
magnitude map IS the intended unified behavior (tev-exact). "Byte-identical to the
old diff blit" is SCOPED to: signed / rel-signed → red-green (analytic, already
identical) + ANY explicitly-picked non-turbo LUT (e.g. magma on a cached FLIP,
proven byte-identical below). Magnitude diffs routed to the unified pane with
`defaultEncoding:turbo` change from the old blit's LINEAR turbo index to tev's
FIXED log2 index ON PURPOSE — option (a), not a regression.

**A+B — pool engine half (DONE, gate-green, commit 5244fc4).** The two pieces the
unified pane needs from the pool-managed single-source pane, with the single-image
path byte-pinned (unmodified image harnesses):
- **A. Second source slot.** `PaneEntry.sourceB`/`srcTextureB` +
  `PaneHandle.setSourceB(upload|null)` — retained + uploaded in `activateEntry`,
  freed in `parkEntry`, re-uploaded on restore, dropped in `dispose` (mirrors the
  primary `a` buffer). `attemptRender` injects the pool-owned `srcTextureB` as
  `params.srcB`, so a `params.contentOpId` selecting a `direct` diff op samples
  both slots; absent → the 1x1-placeholder single-image path (opId 0 ignores it).
- **B. `PaneHandle.renderDiffCached(kernelId, contentKeys, computeParams,
  displayParams, mapping?)`** — the FLIP/HDR-FLIP/SSIM path: `ensureDiff(a,b)` over
  the two live slots (the diff-engine's content-keyed cache OWNS the result texture)
  → `renderImage` blits the scalar-error RESULT through the unified image path
  (identity content + isScalar colormap). Never-throws (parks + returns `null`) like
  `render`. The diff cache was already general — only pool OWNERSHIP of the compute
  is new.
- **Parity (real GPU, metal-3):** `content-ops.browser.ts` gained two POOL cases —
  every direct diff op driven through `setSource`+`setSourceB`+`render(contentOpId)`
  reads back byte-identical to the composed cpu twin, and `renderDiffCached(flip)`
  reads back byte-identical to the manual `ensureDiff`+`renderImage(result, magma)`
  reference with a repeat render proven a cache HIT (compute count flat). Added
  `getCanvasSurfaceForTest` (introspection-only) for the surface readback.
- **Gates:** typecheck; 615 node tests; all 24 parity harnesses; 243 pytest;
  boundary/schema in sync; gpu-image bundle rebuilt + synced + committed.

**C–H — pane + routing + chrome + sync + harnesses + visual (NOT STARTED).** These
are tightly coupled and were deliberately NOT attempted piecemeal, because the only
green landing is the whole set (a partial `plot-node` routing change alters the core
dispatch and red-gates the stack/compare/selection harnesses). Precise seam map for
the continuation:
- **C. `GpuImagePane` diff capability.** Add an optional `compareSource` to
  `ImageBackendProps` (`renderers/image-backend.ts`) carrying the reference operand
  (uint8/float, like `GpuComparePane`'s `imageFloat`/`baselineFloat`), the diff
  MODE (a content-op id) + kernel + colormap-override + align/fit. When present the
  pane: uploads the reference via `handle.setSourceB` (direct ops) and either
  `render({contentOpId, isScalar, defaultEncoding})` (direct) or
  `handle.renderDiffCached(...)` (cached FLIP/SSIM); adds a diff MODE menu (from the
  ContentOp registry, `listContentOps`) to `leadingMenus`; resolves the diff colormap
  via `resolveDiffColormap` + per-kernel-default vs override (`colormapState`, exactly
  as `GpuComparePane` does). The single-image path is UNTOUCHED when `compareSource`
  is absent (byte-pinned). Most of `GpuComparePane`'s diff render (lines ~1121–1421:
  `resolvedKernelId`/`hdrExposures`/`diffCmapMode`/`diffColormap`/`diffAnalytic`,
  the `mapping`/`framingDims`/`contentKey*` derivations, the metrics/SSIM/TEV-readback
  effects) ports across — but through the POOL (`renderDiffCached` for cached, the
  pool-injected `srcB` for direct) instead of self-managed textures.
- **D. Routing (`plot-node.tsx`) — the flicker fix + THE crux.** A `compare` node in
  mode `"diff"` must render through the SAME `GpuImagePane`-family instance an image
  leaf renders, so `stackKindKey(compare mode:diff) === stackKindKey(image leaf)`
  (`plot-node.tsx:963`) makes a `[image, diff]` stack HOMOGENEOUS →
  `homogeneousStack` → the source-swap reused-renderer path (no remount, no
  `stackPaneSync` group). This requires: (1) `stackKindKey` to inspect a compare
  node's resolved mode (diff vs slide/blend) and return the image leaf's key for
  diff; (2) `PlotNodeView`/`CompareView` to lower a diff-mode compare to a
  `GpuImagePane` with `compareSource` (NOT `CompositeMediaPane`→`GpuComparePane`),
  so the reused instance across an image↔diff flip is one component type; (3) retire
  `mixedImageStack` for the image+diff case (keep it for image+slide/blend until
  Phase 3). slide/blend STILL route to `GpuComparePane` (the one documented remaining
  remount — Phase 3 absorbs them).
- **E. `ImagePaneShell` chrome.** Promote `metrics?`/`caption?` props next to
  `extraChips` (`ImagePaneShell.tsx:~287`) + `overlay.render` (~614); move the
  MSE/PSNR/MAE/SSIM chip + diff caption from `GpuComparePane` (lines ~1786–1985) onto
  the unified diff pane.
- **F. Sync.** Reuse the existing bus + `deriveCompareEncodingId` +
  `resolveDiffColormap` semantics (the compare pane already does; the image pane's
  `useSyncedImageSettings` is the same bus) — pick sticks across kernel switches,
  HOME resets.
- **G. Harnesses.** Extend `stack/grid-stacked` mixed section with NO-remount
  assertions (a DOM-marker element persists across image↔diff flips, zoom persists,
  no hidden sibling); add a signed→red-green byte-identity-vs-old-compare-path case;
  migrate `compare-settings-sync` diff expectations; KEEP split/blend coverage;
  pixel-value readout parity (op cpu twins / cached readback) vs the existing diff-TEV
  numbers.
- **H. Visual verify.** Regen report + serve `/private/tmp` + open the stacked-grid
  validation flip (image↔FLIP no-flicker, element persistence live, magma + metrics
  chip).

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
