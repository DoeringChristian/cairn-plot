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

## Follow-up — DONE: residual stacked-flip flicker (source retention)

**User report.** Flipping slots in a stacked viewport containing a diff (the
report's Validation `[image, FLIP]` stack, rapid arrow-key flipping) still
flickered. Hypothesis in the report: "the error is RE-COMPUTED on each switch."

**Root cause (MEASURED, not guessed).** A self-driving GPU harness
(`renderers/__tests__/stacked-diff-flip.browser.ts`) drives ONE reused
`GpuImagePane` through `image → diff → image → diff …` (the homogeneous
source-swap Phase 2c produces) and counts `getDiffComputeCount()` + source-texture
uploads across the round-trip. It refuted the recompute hypothesis and isolated
the real gap:

- **Diff RESULT — already retained.** Per-revisit `getDiffComputeCount()` delta is
  `0` — the content-keyed diff cache (`diff-cache.ts`, keyed by
  `(contentKeyA, contentKeyB, kernel, params, mapping)`) HITS on every flip-back;
  the FLIP result is NOT recomputed. (First visit is `+2` = the FLIP result + the
  SSIM metric entry, both then cache-stable.) So the reported "re-computed on each
  switch" was wrong for the cached FLIP.
- **SOURCE textures — re-uploaded EVERY flip (the real cost).** Per-revisit
  source-upload delta was `[1,1,1]`: `GpuImagePane`'s `setSource`/`setSourceB`
  effects always ran the async decode→`createTexture`+`write` path, and the pool
  held only ONE source per slot (overwritten on flip, discarded on flip-away), so a
  flip BACK re-decoded + re-uploaded. The cached-result present was DEFERRED behind
  that async re-upload (the diff render gates on `refDims`, set only when the async
  `setSourceB` resolves), so the pane painted a transient/intermediate frame before
  settling. Live confirmation on the served Validation stack: the pane went
  outgoing-image → a DISTINCT intermediate → settled-diff (three distinct
  frame fingerprints); never blank (the frame was held), but visibly perturbed on
  rapid flipping.

**Fix — CONTENT-KEYED SOURCE RETENTION (two cooperating caches).**
- **Pool (GPU textures).** `PaneHandle.setSource`/`setSourceB` take an optional
  `contentKey`; the pool keeps keyed uploads in a small per-pane LRU
  (`PaneEntry.retained`, `uploadOrBindSource`/`evictRetained`). A flip back to a
  resident key REBINDS the texture (no `createTexture`+`write`); the unkeyed
  single-image / deep paths are byte- and lifecycle-identical (an unkeyed texture
  is still freed on replace).
- **Pane (decoded uploads).** `GpuImagePane` caches the decoded `SourceUpload`
  keyed by `contentKeyA`/`contentKeyB` (`uploadCacheRef`) and, on a flip-back hit,
  binds SYNCHRONOUSLY (no `.then`) — `refDims` is set on the same effect pass, so
  the cache-hit diff blits without an async gap or an intermediate frame. The SDR
  compare-primary reuses the existing URL decode cache (`getCachedLoadedImageData`)
  for its synchronous path; the HDR primary was already synchronous (just keyed).
- **Present discipline.** Unchanged and preserved — the pane holds the previous
  frame until the new slot is ready; it never clears. With retention that "ready"
  is now synchronous on flip-back.

**Retention policy + memory bounds.** Both caches are bounded by
`MAX_RETAINED_SOURCE_TEXTURES = 6` (pool export, reused by the pane's upload
cache) — enough for the common stacks (a `[image, diff]` pair needs 3 keyed
textures: image, reference, foreground; a 3-slot diff stack ~4–6). Older keys
evict LRU and re-upload on their next visit. The retained set is **per LIVE pane**
and freed WHOLESALE on `park()`/`dispose()`, so an off-screen pane retains ZERO
textures — the pool's existing park/LRU discipline (`MAX_LIVE_SWAPCHAINS`) stays
the ultimate cap authority; no unbounded GPU (or CPU-buffer) growth.

**Harness added.** `renderers/__tests__/stacked-diff-flip.browser.{ts,html}`
(default set, now 26 harnesses) asserts across a 4-visit stacked flip: per-revisit
diff-recompute delta all `0`, per-revisit source-upload delta all `0` (was
`[1,1,1]`), each visit paints non-blank, and the retained result presents
identical settled content each flip-back. (Immediate-readback blank-sampling was
dropped as unreliable — an in-DOM canvas rotates its swapchain back-buffer
mid-present, the documented `gpu-image-diff` readback gotcha.)

**Gates.** typecheck; 615 node tests; ALL 26 parity harnesses (metal-3, incl. the
new one, stable across repeat runs); 243 pytest; gpu-image bundle rebuilt
(369→370 KB) + synced + committed; report (63 blocks) + gallery (27 types) regen
clean; live report spot-check — no blank frame, no distinct intermediate, settled
content stable across flips, no console errors.

## Follow-up — DONE: residual FAST-flip flicker (present-coherency epoch guard)

**User report (after 0bb636e).** Flicker STILL occurs in stacked viewports, but
ONLY when flipping EXTREMELY FAST and only intermittently — and (narrowed by the
user) ONLY between a diff and a NON-diff slot, never on same-kind flips. Source
retention (0bb636e) closed the flip-BACK re-upload gap but did NOT make the OP
TRANSITION atomic.

**Fix-is-live receipt.** The committed dist bundle carries 0bb636e: its retention
property names (`retained`/`sourceKey`/`sourceBKey`) are present in
`src/cairn_plot/_assets/plot-inline/gpu-image.iife.js` and ABSENT from the parent
(28e4275) bundle (369263→370347 B). The slow-flip harness (`stacked-diff-flip`,
run against current source == the committed bundle) re-confirms 0bb636e's claims
live: per-revisit diff-recompute delta 0 and source-upload delta 0. The served
report (`/private/tmp` @ 8765, `?eager=1`) inlines the NEW bundle (guard
fingerprints `cached-diff` + `img:` present).

**Root cause (MEASURED, not guessed).** A new self-driving STRESS harness
(`renderers/__tests__/stacked-diff-flip-stress.browser.{ts,html}`, default set,
now 27 harnesses) flips ONE reused `GpuImagePane` image↔diff FASTER than the frame
rate (every rAF + double-flips, 400 iters / ~330 op-transitions, seeded-random)
and inspects EVERY actual GPU present via a new pool per-present render log
(`engine/test-hooks`'s `startPaneRenderLog`, fed by `pool.ts`'s `attemptRender`/
`attemptRenderDiffCached`) — the GROUND TRUTH of the bound source keys + op at
each present, not flaky mid-present readback. **Pre-fix rate: 206 / 748 presents
INCOHERENT (27.5%)**, every one the SAME mismatch triple — an IMAGE-mode present
(`contentOpId` identity) whose bound primary was still the diff's KEYED reference
(`sourceKey === "flip:ref"`). Mechanism: on a diff→image flip `renderPass` runs
SYNCHRONOUSLY from the new props (`diffMode`/op/encoding flip instantly), but the
plain image's primary goes through async `loadImageData` (async even on a cache
hit) — so the pane presents the identity blit sampling the PREVIOUS slot's retained
reference texture before the image upload lands. The plain-image path had NO gate
(only the diff path gated, on `refDims`), which is exactly why the artefact is
diff↔non-diff-only (image→diff is held by `refDims === null`; diff→image was not).
A same-kind CONTROL (image↔image) measured ~0 (matching the field report).

**Fix — PRESENT-COHERENCY GUARD (epoch at params-assembly level).** `GpuImagePane`
now derives, each render, the content IDENTITY this frame intends —
`expectedPrimaryId` (`A:<contentKeyA>` for a compare, `img:<url>` / `"hdr"` /
`"deep"` for a single image) and `expectedBId` (`B:<contentKeyB>` when a compare
operand is present, else `null`). Two refs (`appliedPrimaryIdRef`/`appliedBIdRef`)
record the identity the pool has ACTUALLY applied, stamped at every upload site
(SDR `applySdr`, HDR, DEEP, `setSourceB` apply + its null branch) — the SAME
expressions, so they converge. `renderPass` PRESENTS only when applied == expected
for BOTH slots; otherwise it RETURNS, HOLDING the previous frame (WebGPU keeps the
last present) until the pending async application lands and bumps
`uploadVersion`/`refUploadVersion` → re-fire. Because op + encoding + compositor
params are pure synchronous derivations of the current props (no async lag), gating
the two async-lagging SOURCE identities is necessary and sufficient — a present can
no longer mix a new op with a previous slot's textures. Deadlock-free (applied is
set from the same values, from an always-scheduled effect) and GENERAL: it equally
gates a plain single-pane image→image URL swap, not only stacks. `imageUrl`/
`hasCompare`/`deepActive`/`compareSource.b` were added to `renderPass`'s deps so the
guard re-evaluates against fresh identities (else an image→image swap would compare
a stale expected id and hold forever).

**Proof.** The stress harness goes 206/748 → **0/748-class incoherent** (0 of 542
presents, CONTROL 0 of 143), STABLE across 3 repeat runs; a render-log no-deadlock
oracle confirms the pane still presents a coherent diff AND a coherent image after
the storm. The slow-flip invariants (0 recompute / 0 re-upload) still hold, and ALL
27 parity harnesses stay green (the "broke nothing" receipt — incl.
`compare-settings-sync`, `grid-stacked`/`-persist`, `gpu-image-diff`, `content-ops`,
every engine parity). Live: rapid arrow-key mashing (~105 flips) on the served
Validation `[image, FLIP]` stack — coherent settle, no blank/intermediate frame, no
console warnings, no legacy fallback.

**Gates.** typecheck; 615 node tests; ALL 27 parity harnesses (metal-3, stress incl.,
stable ×3); 243 pytest; gpu-image bundle rebuilt (370347→370854 B) + synced +
committed; report (63 blocks) + gallery (27 types) regen clean; live report probe.

## Follow-up — DONE: residual FAST-flip flicker was CHROME CHURN (not pixels)

**User report (after 9368ee2).** Intermittent flicker STILL on FAST image↔diff
stacked flips (never same-kind), AFTER the present-coherency guard proved GPU
PRESENTS are coherent. The guard fixed the PIXELS; the residual is the CHROME.

**Finding 1 — CHROME CHURN (measured, deterministic, the primary cause).** A new
DOM harness (`renderers/__tests__/stacked-diff-flip-chrome.browser.{ts,html}`,
default set) drives ONE reused `GpuImagePane` image↔diff under a `MutationObserver`
and counts ELEMENT add/removes in the pane subtree. **Pre-fix, every flip
mounts/unmounts chrome** — measured on the pane AND confirmed live on the served
Validation `[image, FLIP]` stack: the bottom-left LabelChip↔diff caption
(`SPAN.absolute`), the metrics chip (`SPAN[data-gpu-compare-metrics]`), the MODE
menu `<button>` (diff-only), the CHANNELS menu (`DIV.relative.inline-flex`,
image-only), and the histogram button (image-only). 40 flips → 160 add/remove
events: visible popping + toolbar reflow. This is the "flicker."

**Fix 1 — a stacked viewport may change PIXELS, never LAYOUT.** A plain-image pane
that shares a stacked grid with a compare child now RESERVES the compare chrome so
its structure is IDENTICAL to the diff slot's; only content/text swaps across the
flip. Wiring: `StackHasCompareContext` (`stack/stack-context.ts`) is provided by
`GridView`'s stacked branch when `children.some(kind==="compare")`; `LeafView`
reads it and threads `reserveCompareChrome` on the single-image path; the image
renderer adapter (`plot-renderers.tsx ImageStandalone`) forwards it (the missing
forward was caught by the LIVE probe — the pane-level harness passes it directly).
`GpuImagePane` then renders the compare chrome skeleton when `hasCompare ||
reserveCompareChrome`:
- **Chips — PERSISTENCE.** The bottom-left caption slot is ALWAYS mounted (diff
  caption on the compare slot, the image's own label on the reserved slot — the
  SAME `<span>`, text swaps; empty ⇒ `visibility:hidden` via a new `LabelChip
  hidden` prop). The metrics chip is ALWAYS mounted, present-but-invisible + empty
  when there is no live metric. `showLabelChip` is off whenever the compare chrome
  renders (one persistent bottom-left chip, never two swapped ones).
- **Toolbar MODE menu — RESERVED SLOT (chosen over "functional in both modes").**
  The reserved image slot emits the SAME `[compare-mode, display]` leading menus as
  the diff slot; the MODE menu is rendered **disabled/greyed** (new `ToolbarMenu
  disabled`). JUSTIFICATION: in the descriptor model the image child of a mixed
  `[image, diff]` stack is a genuinely SEPARATE plain-image node with no foreground
  operand — it cannot "become" a diff — so a functional MODE menu there would be
  dishonest; reserving the slot keeps layout stable without faking capability.
- **Second row + extra buttons matched.** The reserved image slot forces EV/OFF
  (like the diff slot), suppresses reduce/peak/gamma/bounds, and suppresses the
  histogram button; the CHANNELS menu is suppressed in `LeafView` when
  `stackHasCompare` (the diff sibling has none). Net: both slots' toolbars are
  byte-structurally identical.
- Non-stacked / homogeneous stacks are UNCHANGED (default `false` context) — plain
  images keep today's chrome exactly. Trade-off (documented): a plain image inside
  a MIXED compare stack loses its CHANNELS/histogram/peak/gamma/bounds affordances
  (chrome-stability over those niche controls); EV/OFF + display + MODE remain.

**Finding 2 — resolve flash: VERDICT = the placeholder flash does NOT fire; the
stale-resolve transition DOES (now held cleanly).** A reused `LeafView` flipped
INTO diff still holds the PREVIOUS slot's single-image dataProps for the render
right after the node swaps (the resolve effect updates it synchronously on a cache
HIT). Instrumented via `window.__cairnLeafResolveStats` (`placeholderMounts` /
`staleDiffHolds`) and a real-stack harness
(`stack/stacked-diff-flip-resolve.browser.{ts,html}`, default set, CPU renderers).
**Measured (live report Validation grid, 20 flips): `placeholderMounts = 0`,
`staleDiffHolds = 10`** (== one per image→diff transition). So `LeafView` NEVER
resets to a `"Loading…"` placeholder on a reused flip (the guard-held canvas is
never uncovered), but the stale window IS real — without a fix `mergedProps` would
emit a `compareSource` whose `b` is undefined for one commit. **Fix:** a
SYNCHRONOUS HOLD — when `diffSpec` is set but `state.dataProps.__diffB` is missing,
render the PREVIOUS single-image content (`dp.source`, `reserveCompareChrome` kept
so the held frame's chrome stays the compare skeleton) instead of a half-built
`compareSource`; the resolve effect swaps in the real diff dataProps on the next
commit. Never a placeholder, never an undefined-`b` frame.

**Harness additions.** `stacked-diff-flip-chrome` (DOM stability: 0 element
add/removes across a 40-flip storm + a CSS-independent toolbar-signature equality
via a new always-on `__cairnChromeProbe.chromeSig`, since the width-based overflow
fold can't be measured in a headless page). `stacked-diff-flip-resolve` (real
stacked `[image, diff]` grid through `PlotApp`: `placeholderMounts === 0`,
`staleDiffHolds > 0` as evidence). Default set now **29 harnesses**.

**Live visual verify** (served report `?eager=1`, Validation `[image, FLIP]`
stack, rapid tab flips): image & diff slots' toolbars are pixel-identical (MODE
menu greyed on image / "FLIP (perceptual)" on diff; EV/OFF; Magma display); the
caption + metrics chips are present in both (invisible on the image slot); a
`MutationObserver` over 12 flips records **0 element add/removes and a STABLE
canvas rect (864×648, single sample)**; no console errors.

**Gates.** typecheck; 615 node tests; ALL **29** parity harnesses (metal-3, incl.
the 2 new, + stress/slow/grid unaffected); 243 pytest; core + gpu-image bundles
rebuilt + synced + committed; report (63 blocks) + gallery (27 types) regen clean;
live report probe (0 churn, stable rect, no errors). `uv.lock` left untouched.

## Follow-up — DONE: ORANGE flash CAUGHT + FIXED (cross-content-kind sync adoption)

The prior investigation (368795e, below) proved the PANE present path source⊗encode-
coherent but left ONE honest gap: the DESCRIPTOR GPU real-stack path
(`PlotApp → GridView → NodeDispatch → LeafView → GpuImagePane`) with real page-wide
SELECTION fell back to CPU headlessly, so it was never measured. Closing that gap
REPRODUCED the orange and pinned its mechanism.

**1. The CPU-fallback, root-caused + fixed.** `ImageStandalone` resolves its backend
through `resolveImageRenderer("gpu")`, which returns the CPU pane unless
`window.__cairnPlotGpuImagePane` is set — and that seam is set ONLY by the lazy
`plot-gpu-image-addon` bundle, which a SOURCE harness never loads (it imports the pane
module directly). Nothing in the mode-resolution was broken; the addon's registration
side-effect simply never ran. FIX (harness-side): register the seam exactly as the
addon does — `await getSharedDevice()` → assign `__cairnPlotGpuImagePane = GpuImagePane`
+ `__cairnPlotUseGpuImage = true` — then force `render=gpu`. The real stack then runs on
the GPU headlessly (metal-3), so the pool render-log oracle sees real presents. New
harness: `stack/stacked-diff-flip-realstack-gpu.browser.{ts,html}` (default set; float
sources throughout — an SDR colormap is CPU-baked into the texture → present
`isScalar:false`, INVISIBLE to the encode oracle, so a FLOAT image is required to make
the false-color ride the GPU `isScalar` path the oracle reads).

**2. The sync-adoption hypothesis — CONFIRMED, with a measurement.** A side-by-side
`[float image, FLIP-diff]` grid, BOTH panes SETTLED, then a page-wide selection formed
with the DIFF as ANCHOR (select diff first, add the image) — the exact thing a user does
(the prior pane-level FSYNC probe formed the group at MOUNT, before the diff resolved its
magma default, so its anchor seed carried a curve, not magma → it measured 0 and the
vector looked refuted). **Measured: diff-anchor selection = 97 / 97 image presents ORANGE**
— every image present `mode:image, op:0, isScalar:true, hasColormap:true, cmapSig:magma,
reduce:luminance, ch:3`: a light k=3 float image luminance-reduced through the diff's
magma = the magma UPPER RAMP orange, BY CONSTRUCTION. **CONTROL (image-anchor) = 0**; the
lone stacked-flip storm (no peer) = **0** (re-confirming the pane path itself is coherent —
368795e stands). Mechanism: the settled diff's snapshot publishes
`encoding: deriveCompareEncodingId("scalar", …, "magma") = "magma"` with `compareMode:"diff"`;
the non-anchor plain image's `applyRemoteSettings` called `enc.setEncoding("magma")`
UNCONDITIONALLY (`GpuImagePane.tsx`), false-coloring the light image. (This is a PERSISTENT
orange while the diff is the anchor, not only a 1-frame flash — same root, and the flip-timing
transient is a special case of it.)

**3. The fix — CONTENT-KIND SCOPING at the receiver (`applyRemoteSettings`).** A diff peer's
`encoding`/`colormap` describe its SCALAR-ERROR face (a colormap chosen to false-color an ERROR
MAP), already tagged `compareMode:"diff"` in the payload. Adopting that scalar colormap onto a
pane rendering LIGHT content is the bug. So a diff's scalar-error DISPLAY encoding is now treated
as DIFF-ONLY — exactly as the bus already treats the compare-only keys (`diffKernel`/
`splitPosition`/…): a pane NOT itself in diff mode ignores it
(`adoptDisplayEncoding = !(patch.compareMode === "diff" && !diffMode)`). Landed in all three
sync receivers (`GpuImagePane`, the SDR + HDR `CpuImagePane`). **Scoping rationale (justified
against default-vs-override semantics):** same-content-kind USER PICKS still sync — an image's
own colormap pick carries NO `compareMode`, so it still reaches image peers; a diff's colormap
still reaches diff peers via the `diffMode` branch (`setDiffColormapOverride`); split/blend peers
publish a LIGHT curve (`compareMode:"split"/"blend"`), which a light image adopts fine — ONLY the
scalar-error `"diff"` face is scoped out. Content-kind based (not dtype), so it fixes the visible
FLOAT orange AND the oracle-invisible SDR one in one path.

**Proof (real GPU, metal-3, ≥3 repeats).** The new harness: diff-anchor **0 orange** (was 97/97),
image-anchor control **0**, stacked flip storm **0** across 3 reps. A DIFFERENTIAL phase drives the
bus directly against a live selected image pane and asserts the fix is PRECISELY scoped: a same-kind
image colormap patch (no `compareMode`) IS still adopted (image goes orange — same-kind sync intact),
while a `compareMode:"diff"` patch is IGNORED. ALL 30 parity harnesses green (incl.
`compare-settings-sync` + `page-wide-selection` — the same-kind-sync regression guards), 615 node
tests, 243 pytest, typecheck.

**4. User-facing capture path (`?paneRenderLog=1`).** `engine/test-hooks` now auto-arms the
render-log oracle when the URL carries `?paneRenderLog=1` OR `window.__cairnPaneRenderLog = 1` is set
before the bundle loads. Zero cost when unarmed (one `URLSearchParams` read at module load; the pool's
`isPaneRenderLogActive()` gate stays false, present path untouched). When armed: every present is logged
(bounded ring — no unbounded growth), and each ORANGE-suspect present (an image-mode blit carrying a
scalar colormap) is `console.warn`ed AND pushed to `window.__cairnPaneRenderLogSuspects`;
`window.__cairnPaneRenderLogRecords()` returns the full buffer. **Usage:** open the report/gallery with
`?paneRenderLog=1`, reproduce the flip, then dump `window.__cairnPaneRenderLogSuspects` (or copy the
console). Present on the GPU path (where the artefact is visible).

**Gates.** typecheck; 615 node tests; ALL 30 parity harnesses (metal-3, incl. the new real-stack GPU
harness, stable ×3); 243 pytest; core + gpu-image bundles rebuilt + synced + committed; report (63
blocks) + gallery (27 types) regen clean. `uv.lock` left untouched.

## Follow-up — DONE: oracle false-positive fix + deep output-color detector (paneRenderLog=2) + context-loss instrumentation; ORANGE not reproduced on Metal

**New evidence (user's live env, armed `?paneRenderLog=1`).** After 0758207 the user
STILL sees a 1-frame ORANGE flash on fast image↔diff STACKED flips (Validation stack:
slot A = scalar float image with AUTHORED magma, slot B = FLIP diff magma — BOTH magma
scalar, so the orange = magma UPPER RAMP = a high scalar value). Their console SPAMMED
"ORANGE-suspect" warnings that were FALSE POSITIVES (`channelCount: 1`), and — the crux —
`THREE.WebGLRenderer: Context Lost.` appeared under fast-flip load on the 27+-section
report. Three work items: (1) fix the oracle's false positives, (2) add a cause-agnostic
output-COLOR detector, (3) investigate context loss as the cause.

**1. Oracle false-positive fix (`engine/test-hooks.ts`, DONE).** `isOrangeSuspect` now
additionally requires `channelCount > 1`. The false positive was the LEGITIMATE k=1
authored-colormap scalar pane (a scalar float image the author drew with magma — its
NORMAL render is `mode:image, !op, !b, isScalar, hasColormap`), which the old predicate
flagged on EVERY present. Only a MULTI-channel LIGHT image (k>1) collapsed through a
scalar colormap (reduce→false-color) can be the real mismatch class, so gating on k>1
exempts the authored scalar pane while still catching `ch>1 + colormap on identity`.
(cached-diff and direct diff/compositor ops were already exempt by mode/op/`hasSrcB`.)
Node regression test added (`test-hooks.test.ts`). LIVE-confirmed on the served report:
the authored magma scalar present (`channelCountDist {1:1}`) yields **0 suspects** — the
console spam is gone.

**2. Deep output-COLOR detector — `?paneRenderLog=2` (`test-hooks.ts` + `engine/pool.ts`,
DONE).** Level 2 arms a cause-agnostic flash catcher: per armed present the pool renders an
EXTRA tiny 8×8 pass with the SAME primary texture + params into a per-pane offscreen
readback texture (NOT the rotating swapchain), reads it back (256 B), and averages it to one
RGB. Presents are grouped by a SLOT SIGNATURE (`paneId` + source keys + op + encode — the
`paneId` is load-bearing: an unkeyed single-image pane has an empty `sourceKey`, so without
it every distinct plain image on a page aliases to one baseline and reads as a color jump —
this was caught LIVE, 4 false anomalies on the first build, fixed by the pane id) and each
slot learns its settled color (EMA, anomalies not folded in). A SETTLED slot presenting a
color far from its OWN fingerprint (normalized-RGB Δ > 0.35, value-gated so a held/blank
frame isn't flagged) is logged to `window.__cairnPaneRenderLogHueAnomalies` + console — the
orange flash caught by its actual color, regardless of WHY. **Cost:** an 8×8 render + a
256-B async fire-and-forget readback per present, fully guarded (never disturbs the real
present); ZERO cost at level ≤ 1 / unarmed (`deepColorDetectorActive()` gate). Cross-signature
param mismatches remain the PARAM oracle's job; the detector's unique value is a SAME-slot
color jump (e.g. a garbage cached-result texture) — the vector no param oracle can see.

**3. Context-loss instrumentation + investigation (`test-hooks.ts` + `webgpu/device.ts` +
`three/use-scene3d.ts`, DONE).** Armed at any level, WebGPU `device.lost` and THREE
`webglcontextlost`/`restored` are timestamped to `window.__cairnContextLossEvents` (+ console).
The capture arrays are now SHARED across the three co-resident inlined bundles (core /
gpu-image / three each carry a test-hooks copy — presents land in gpu-image, device-loss in
gpu-image, THREE loss in three): arm reuses a sibling instance's window array so a user reads
ALL instances' records in one place (before this, last-armed-wins fragmented the buffers —
device-loss read 0 while THREE loss landed in a different copy's array).
**Findings (code + LIVE, real Metal, Apple Silicon):**
- WebGPU present ALWAYS uses `loadOp:"clear"` (black) and getCurrentTexture is spec-cleared
  after `configure` — the WebGPU swapchain is NEVER presented uninitialized; orange cannot
  come from an unwritten swapchain on the 2D path.
- The diff-cache is per-Device (`WeakMap<Device, DiffCache>`) — a recreated device gets a
  FRESH cache (no dead-device textures). BUT `getSharedDevice()` memoizes the device promise
  permanently and NOTHING wires `gpuDevice.lost → resetSharedDevice()` — there is no WebGPU
  device-loss RECOVERY. A genuine robustness gap (a lost WebGPU device bricks every 2D pane
  until reload), but it produces BLANK/CPU-fallback, not orange — reported as a recommendation,
  NOT fixed (a speculative recovery refactor is unwarranted by the evidence; repo discipline).
- The `THREE.WebGLRenderer: Context Lost` is the WebGL 3D viewers (capped at
  `MAX_LIVE_CONTEXTS=16`, with a deliberate 1-frame over-cap allowance during a sync storm —
  the trigger). It is ALREADY handled: `use-scene3d`'s `webglcontextrestored` re-renders on
  recovery (parks + cached snapshot). Benign, and on the 2D-separate WebGL context — it does
  NOT touch the WebGPU image/diff pane's color.

**LIVE PROOF (served `/private/tmp` @ 8765, real report `?eager=1&paneRenderLog=2`, Apple
Metal).** Fresh load + a flip storm on the Validation `[a: official FLIP, b: prediction]`
stacked magma pane (≈120 arrow-key flips, present buffer 36→**197**: 74 cached-diff + 91
scalar-magma — the exact orange path): **suspects 0, hue-anomalies 0, webgpu-device-lost 0.**
The only context-loss events were **5 `three-webgl-context-lost` at 2477–3386 ms** — i.e.
during the INITIAL 3D-viewer mount burst, NOT during the flip storm (tens of seconds later):
context loss does NOT correlate with flips and never coincided with any orange/hue anomaly.
Console during the whole run: only the 3 level-2 ARM lines (one per bundle) — no ORANGE, no
HUE-ANOMALY, no device-loss. Also proven headlessly: `stacked-diff-flip-stress` now arms the
deep detector across its FLIP + direct-magma storms (×3 each) and asserts the 8×8 sampler
actually ran (`samples > 0`, settled slots > 0) AND saw **0 hue anomalies**.

**VERDICT (honest).** The reported orange was NOT reproduced on this Apple-Silicon Metal
hardware — neither the param oracle nor the deep color detector caught a single anomalous
present across a real report-page flip storm, and the observed context loss is the benign,
auto-recovered WebGL/THREE kind confined to initial mount (zero WebGPU device loss, no flip
correlation). No pane fix is warranted by the evidence. What LANDED: the oracle false-positive
fix (the user's console is now quiet), the `?paneRenderLog=2` deep color detector (the
cause-agnostic flash catcher), and context-loss instrumentation. If the flash recurs on the
USER's hardware, their next repro with `?paneRenderLog=2` captures it BY COLOR on
`window.__cairnPaneRenderLogHueAnomalies` (each carries the output rgb/hue + the present's full
source⊗encode record) and any correlated loss on `window.__cairnContextLossEvents` — cause-
agnostic evidence no param oracle can produce.

**Gates.** typecheck; 622 node tests (615 + 7 new `test-hooks`); ALL 30 parity harnesses
(metal, incl. the deep-mode stress assertion); 243 pytest; core + gpu-image + three bundles
rebuilt + synced + committed; report (63 blocks) + gallery regen clean; live report deep-mode
storm proof. `uv.lock` left untouched.

## Follow-up — DONE: the one-frame flash was a PAINT-WINDOW HOLD (paint-atomic flips)

**Confirmed mechanism (finally — from the user's screen recording).** Every prior
oracle missed it because every PRESENT is coherent: the artefact is a PAINT WINDOW
CONTAINING NO PRESENT. On a fast image→diff stacked flip the flip commits (the tab
strip updates instantly) but the pane's engine render for the NEW slot ran in a
POST-PAINT (passive) `useEffect` — so the FIRST PAINTED FRAME after the flip still
showed the HELD previous slot (WebGPU keeps the last present; the demo's magma/orange
gradient is why the held image region read as an orange flash, and why only the image
region flashed — the transparent bg is unchanged). This is the hold-last-frame design
(correct for genuinely-async loads) meeting React's effect timing. Same-KIND flips
were mechanically identical (also post-paint) but imperceptible — two similar frames.
The render log + present-coherency + deep color oracles all pass BY CONSTRUCTION here:
they inspect presents, and there is no torn present — just a real previous present
displayed for one paint.

**Fix — PAINT-ATOMIC render when the target is RESIDENT.** When a flip's target is
fully resident — retained source textures (0bb636e LRU) + synchronously-bindable
decode + (for a cached op) a diff-result cache HIT — the engine render now runs
PRE-PAINT, in a `useLayoutEffect`, so the first painted frame already shows the new
slot. NON-resident targets keep the hold-previous-frame behavior (correct for async
loads). Concretely (`renderers/GpuImagePane.tsx`):
- The 3 source-upload effects (SDR / HDR / `setSourceB`) became `useLayoutEffect`
  (their deps exclude the viewport, so pan/zoom scheduling is untouched — they only
  fire on a source/identity change), so a resident flip binds its textures + stamps
  `appliedPrimaryIdRef`/`appliedBIdRef`/`refDims`/`naturalDims` synchronously in the
  commit, BEFORE paint. The SDR synchronous flip-back fast-path was broadened from
  compare-primary-only to EVERY non-colormapped image (`colormap === "none"`), so the
  diff→image direction (a plain unkeyed image target) is paint-atomic too, not just
  image→diff.
- A new pre-paint `useLayoutEffect` render runs the flip when `contentIdentity`
  changed (a genuine flip, not pan/zoom/exposure) AND `targetResident` (both applied
  source identities match this frame's expected, dims known, and — for FLIP/HDR-FLIP/
  SSIM — `PaneHandle.isDiffResultCached(...)` HITs, a new NON-mutating pool peek:
  `diff-cache.ts` `has()` + `diff-engine.ts` `hasDiff()` + the pool method, so a cold
  cache stays on the post-paint path rather than recomputing multi-pass on the paint
  critical path). `expectedPrimaryId`/`expectedBId` were hoisted to body scope (one
  source of truth for the render closure AND the residency check).
- **Double-render deduped** (layout render vs. the retained post-paint effect):
  `renderPass` now RETURNS whether it actually submitted (a held/guarded frame ⇒
  false), and both effects share a `lastRenderedRef` keyed on
  `(renderId, uploadVersion, containerTick)` — `renderId` is a `useMemo(()=>({}),
  [renderPass])` that changes iff any pixel-affecting dep changes. So a resident flip
  submits exactly once (pre-paint); the post-paint effect skips the duplicate. The
  present-coherency guard PASSES on the pre-paint render (sources are resident by
  gate). The screenshot/`requestRender` force paths call `renderPass` directly and are
  unaffected (no self-dedupe inside `renderPass`).
- **Anti-churn (regression the paint-atomicity EXPOSED).** The diff kernel/colormap
  re-seed effects reset to defaults when `compareSource` is absent (the image slot),
  then re-applied the descriptor value POST-paint on flip-back — a lag the new
  pre-paint render caught as a transient wrong-kernel/wrong-colormap present (turbo
  instead of magma, direct-absolute instead of cached-flip), which `stacked-diff-flip-
  stress` flagged. Fixed: both re-seed effects now no-op when `!compareSource` (keep
  the diff state dormant across image↔diff flips), so flip-back's diff params are
  correct on the SAME frame.

**Harness proof — assert on PAINTED FRAMES, not presents.** New default harness
`renderers/__tests__/stacked-diff-flip-paint.browser.{ts,html}` (32nd). It drives ONE
reused `GpuImagePane` image↔diff FASTER than the frame rate (a ~3ms task gap vs a
~16ms paint — the artefact condition) and classifies each RESIDENT flip against real
browser PAINT boundaries: the pane records (guarded, test-only, in `engine/test-hooks`
— zero production cost) a pre-paint COMMIT marker + the new slot's first render SUBMIT,
each `performance.now()`-stamped, grouped by a content EPOCH; a free-running rAF loop
records every paint boundary; a flip is STALE iff a paint falls strictly between its
commit and its new-slot submit (a browser painted the OLD slot after commit). This is
robust to two traps discovered here: (a) an in-DOM WebGPU canvas rotates its swapchain,
so `createImageBitmap(canvas)` right after a flip returns a STALE buffer while the pool
render log shows the new slot rendered — canvas readback is NOT a reliable paint sampler
(the ground-truth render log confirmed the fix while the canvas read lied); (b)
`flushSync` MASKS the artefact (it flushes passive effects pre-paint), and React's early
passive-flush before a layout-effect-triggered re-render means a "post"-labelled submit
can still be pre-paint — only the submit-vs-paint-boundary timing is decisive.
**Measured (real GPU, metal-3): pre-fix 15/240 image↔diff + 8/239 same-kind stale
first-frames (deterministic under the fast-flip stress; 94/94 + 119/119 when the whole
paint-atomic path is disabled); post-fix 0/360 image↔diff AND 0 same-kind, stable ×3.**
Correctness (the pane presents the right settled slot) stays pinned by the render-log
oracle. 2 new `test-hooks` node tests for the paint-phase log.

**Live visual verify** (served report `?eager=1&paneRenderLog=2`, Apple Metal, the
Validation `[a: official FLIP, b: prediction]` stacked magma pane, rapid tab-flip
storm): the deep output-color detector recorded **0 hue anomalies and 0 orange
suspects**; the pane rendered coherent content throughout (no tearing/garbage). The
image-frame-inside-the-diff-tab flash is what the synthetic paint-boundary harness
measures directly (0/360 post-fix).

**Gates.** typecheck; 624 node tests (622 + 2 new `test-hooks`); ALL 31 parity harnesses
(metal, incl. the new `stacked-diff-flip-paint`; `stacked-diff-flip-stress` re-green
after the anti-churn fix); 243 pytest; gpu-image bundle rebuilt (370854→~377.9 KB) +
synced + committed; report (63 blocks) + gallery (27 types) regen clean; live deep-mode
storm probe (0 anomalies). `uv.lock` left untouched.

## Follow-up — INVESTIGATION: reported one-frame ORANGE viewport flash (sharpened oracle; NOT reproduced at the pane)

**User report (after 9368ee2 + c459c34).** Fast image↔diff STACKED flips still
intermittently flash the VIEWPORT (the diff map itself, not chrome) ORANGE for one
frame — "maybe the max of the plasma/magma colormap." Working hypothesis: one
present mixes a MISMATCHED (source, params) combination — an IMAGE source rendered
through the DIFF's scalar display params (`isScalar`+reduce collapses a light image
to a ~0.5–1.0 scalar → magma/plasma UPPER ramp = orange). The 9368ee2 guard gates
ONLY the two async source identities; the concern was that the encode/op fields
(`contentOpId`/`isScalar`/lut/reduce) could lag across an effect boundary and slip a
present through with the right source but a stale diff's encode — invisible to the
prior stress oracle (which only checked `contentOpId`-vs-`sourceKey`).

**Sharpened oracle (built, LANDED).** `engine/test-hooks`'s `PaneRenderRecord` now
carries the FULL display-encode fingerprint per present — `operator`, `hdrOut`,
`reduce`, `channelCount`, a combined `scalarMode` (analytic/grayNone/turbo/LUT),
`hasColormap` + a `colormapSig` (a few sampled LUT entries, so magma≠turbo≠viridis),
`contentParam` — read straight off the `ImageParams` the pool ACTUALLY presented
with (`engine/pool.ts`'s `displayFingerprint`, computed ONLY when a harness started
the log — an `isPaneRenderLogActive()` gate keeps the production present path
cost-free). This is the GROUND TRUTH of the full (source ⊗ encode) combination at
each present — no flaky mid-present pixel readback (an in-DOM canvas rotates its
swapchain back-buffer, the documented readback gotcha; a settled-canvas readback in
this investigation returned rgb(6,6,6) blanks, confirming the unreliability). The
`stacked-diff-flip-stress` harness now classifies EVERY present against the captured
SETTLED fingerprints of each slot: a present matching neither settled slot is a
FULL-STATE (source⊗encode) mismatch; among those, a scalar-LUT-over-light one is an
ORANGE frame BY CONSTRUCTION (a light source collapsed through a scalar colormap =
the magma-upper-ramp orange). The oracle spans two single-pane storms (image↔FLIP
cached-magma AND image↔absolute DIRECT-magma — the latter drives `attemptRender`
with `isScalar`+magma, the exact scalar path the artefact rides), a synced-pair SDR
storm, and a FLOAT-synced (diff-anchor ⊕ image-peer) probe, each ≥3 repeats.

**Measured — the pane present path is ALREADY full-state coherent.** Pre-existing
rates (no pane change): **source-incoherent 0, FULL-STATE mismatch 0, ORANGE 0**
across ALL storms — single-pane image↔FLIP (≈540 presents/rep ×3), single-pane
image↔DIRECT-magma (≈535/rep ×3), CONTROL image↔image (0/145), synced-pair SDR
(≈1700 presents ×3), and the FLOAT diff-anchor⊕image-peer probe (0/247). So the
reported orange is NOT a source⊗encode tear in the `GpuImagePane` present path.

**Why (mechanism, verified not assumed).** `renderImage` rebuilds the ENTIRE uniform
set + a fresh bind group per call (no persistent uniform between presents — checked),
so there is no stale-uniform-bleed vector. And `renderPass` derives `expectedPrimaryId`/
`expectedBId` AND the full `params` from ONE consistent render closure — `hasCompare`/
`diffMode`/`compareOpMode`/`contentKeyA/B` are pure synchronous prop derivations, so a
single closure can NOT pair an image source-identity with diff encode params; the
9368ee2 source guard then withholds the present until the (async) applied source
identities equal that closure's expected identities. The only state-derived encode
fields (`diffColormapOverride`/`diffKernel`/`reduceOverride`, and the image `enc`) never
cross between the image and diff branches within a pane on a stacked flip (diff uses
`effectiveDiffColormap`, image uses `enc`; neither is written by the other's path
absent the settings-sync bus). The one path by which a diff's display encoding could
reach a plain image is the settings-sync bus — `applyRemoteSettings` adopting a diff
peer's `deriveCompareEncodingId("scalar", …, "magma") = "magma"` into a plain image's
`enc` — but the FLOAT synced-peer probe measured 0 (the light-image `enc` did not
false-color), so that vector did not bleed either.

**Remaining UNTESTED path (honest gap + recommended next repro).** The DESCRIPTOR
GPU real-stack path (`PlotApp → GridView stacked → NodeDispatch → LeafView →
GpuImagePane` with the LeafView async-resolve + `diffSpec` cross-commit timing) could
NOT be exercised headlessly — a scratch real-stack harness forced to `render=gpu` fell
back to CPU (0 pool presents logged), so the live GPU pane under cross-commit prop
delivery was not measured. Architecturally React hands the pane ONE consistent
`mergedProps` snapshot per commit and `LeafView` holds cleanly (never emits an
undefined-`b` `compareSource`; c459c34), so a torn props set should not reach the pane
— but this was reasoned, not measured on GPU. NEXT: a GPU real-stack harness that
actually mounts `GpuImagePane` (resolve the CPU-fallback in headless), reusing the
per-present render-log oracle landed here; and/or reliable per-present GPU
texture-copy readback to see an SDR CPU-baked-colormap flash the ground-truth encode
oracle cannot (SDR colormaps are baked into the texture → `isScalar:false`).

**No pane fix was landed** — none is warranted by the evidence (the pane is coherent;
the 9368ee2 source guard + pure-synchronous encode derivation already keep every
tested present source⊗encode-coherent). The atomic-params-snapshot refactor was NOT
applied: it would reframe (not change) an already-correct guard and risk regressing a
2600-line critical pane for no measured benefit. What LANDED is the strengthened
oracle — a strict superset of the prior source-only check, now a permanent regression
guard that WOULD catch the described artefact if it ever occurs.

**Gates.** typecheck; 615 node tests; ALL 29 parity harnesses (metal-3, incl. the
sharpened stress harness, stable ×3); gpu-image bundle rebuilt + synced (test-only
fingerprint additions; production present path unchanged — fingerprint gated behind
`isPaneRenderLogActive`). pytest + report/gallery regen UNAFFECTED (no
schema/render-behavior change). `uv.lock` left untouched.

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

## Follow-up — DONE: reference-image flash on stacked image↔diff flips (present-gate = no primary-identity render in diff mode + synchronous resolve)

**User report (ground truth, post-874800e).** In a stacked grid holding a normal
image and a diff of it, switching between the tabs *every so often* shows, for ONE
frame, the diff's **REFERENCE** image instead of the error map. Every prior oracle
(present-coherency, deep-color, orange-suspect, paint-atomic-at-the-pane) missed it
because the offending frame is a PLAIN IDENTITY BLIT OF THE PRIMARY TEXTURE — and in
the unified pane's diff mode the primary source IS the reference (`source`=reference,
`compareSource.b`=foreground). That present is fully param-coherent (the reference IS
the bound primary; no colormap ⇒ no orange flag): only *which pipeline drew it* is
wrong. The lesson (recorded so it isn't re-learned): the render log needed a
MODE/PIPELINE predicate, not another source⊗encode predicate.

**Two independent hops could put the reference on the visible surface — both closed
by code reading (no pre-fix repro; the bug is ground truth):**

1. **LeafView resolve lag (the measured real-path hop).** On a stacked flip the
   reused `LeafView` receives the new node in the FLIP COMMIT, but its resolved
   `state` still holds the PREVIOUS slot's `dataProps` until the async resolve
   effect's `setState` lands a *second* commit (`resolve-cache` peeks synchronously,
   but the setState round-trip is still a commit later). So the flip commit paints
   stale content, and — on a diff→image flip — `state` holds the DIFF resolution
   whose `source` IS the reference, which the single-image path would spread as a
   plain image (no `compareSource`) → the pane blits the reference. **Fix
   (`plot-node.tsx`):** (a) SYNCHRONOUS RESOLVE — derive `dataProps` from
   `peekResolved(resolveKey)` DURING RENDER, so a warmed/prefetched flip carries the
   correct slot's data in the flip commit itself (pure derive-from-cache-during-
   render; no setState-in-render). (b) DIFF-PAIR PREFETCH — `GridView`'s stacked
   prefetch now warms each compare child's `|diffpair` key (via the shared
   `resolveDiffPair`, the single source of truth for LeafView's effect AND the
   prefetch), so both slots are resident by the time the user flips (previously ONLY
   plain `plot` leaves were prefetched — every first diff flip hit the cold async
   hold). (c) REFERENCE-LEAK GUARD — on the single-image path a `state` fallback that
   still carries `__diffB` (a stale diff resolution) is rejected rather than emitted
   as `source:<reference>`; it holds instead.

2. **The pane's direct-op branch with `contentOpId === 0` (the primary-identity
   submit).** `contentOpId(id)` returns 0 = IDENTITY (`cairnContent → return a` = the
   primary/reference) for ANY id not registered as a direct content op. The DIRECT-op
   diff branch (`renderPass`) rendered `handle.render({…, contentOpId:
   contentOpId(kernelId)})` — a transiently-unrecognized / mis-resolved `kernelId`
   ⇒ opId 0 ⇒ a raw blit of the REFERENCE onto the visible surface while a compare is
   set. **Fix (`GpuImagePane.tsx`):** in diff mode a primary-identity render is NEVER
   presentable — if `opId === 0` the branch HOLDS the previous frame (WebGPU keeps the
   last present) and re-fires when `resolvedKernelId` settles. A diff present must
   always come from the diff pipeline for the CURRENT op. The plain-image branch
   likewise HOLDS (`if (hasCompare) return false`) — the belt-and-suspenders floor for
   any degenerate `compareSource.mode`. Cached-diff (`renderDiffCached`) already blits
   the RESULT, not the primary, and its failure path parks to the CPU pane (never the
   reference).

**Regression tripwire (not a pre-fix baseline).** `ImageParams.compareIntended`
(test-only tag, set = `hasCompare`) is recorded per present; `test-hooks`'
`isPipelineMismatch(r)` flags `mode:"image" && !contentOpId && !hasSrcB &&
compareIntended` — a primary-identity present while a compare is intended. This
predicate would have caught the flash from day one. The real-stack GPU harness
(`stacked-diff-flip-realstack-gpu`) grew a Phase D that drives the REAL tree
(`PlotApp→GridView→NodeDispatch→LeafView→GpuImagePane`, GPU, metal-3) through a
fast image↔diff flip storm and asserts, post-fix: ZERO stale painted frames
(paint-boundary vs first diff-submit), ZERO `staleDiffHolds`, ZERO pipeline-mismatch
presents. (A toggle-gated pre-fix pass measured 4/60 stale painted frames + 60/60
stale-diff holds → 0/0/0 post-fix, corroborating the mechanism; kept only because it
fell out for free — NOT the acceptance test.)

**ACCEPTANCE.** The acceptance test is the USER's own re-test on their hardware — this
note reports the mechanism closed and what was measured; it does NOT claim the pixel
the user sees is fixed.

**Gates.** typecheck; 626 node tests (624 + 2 new `isPipelineMismatch`); ALL 31 parity
harnesses (metal-3, incl. the extended real-stack GPU harness); 243 pytest; core +
gpu-image bundles rebuilt + synced + committed; report (63 blocks) + gallery (27
types) regen clean. `uv.lock` left untouched.

## Follow-up — DONE: authored-colormap flash on flips (encoding generation lag → commit-synchronous reseed)

**User report (after the reference-flash fix a790e34).** The reference flash is gone,
replaced by a NEW one-frame artefact: the OFFICIAL-FLIP slot (a scalar image with
AUTHORED `colormap="magma"`) occasionally paints ONE frame WITHOUT magma — raw
grayscale scalar — on flips. **Same bug class, one layer up:** the a790e34
present-gate covered which PIPELINE drew a frame; this covers which ENCODING
GENERATION it drew with.

**Mechanism (code reading, no repro).** `usePaneEncoding`
(`renderers/display-encoding.ts`) held the active `encodingId` in `useState` and
RESEEDED it from `propColormap`/`propTonemap` in a `useEffect` — ONE COMMIT LATER.
The paint-atomic flip render (which reads `encodingId` synchronously) therefore
painted the PREVIOUS slot's encoding on the flip commit; magma landed the next
commit. Before a790e34 this was masked because that commit painted the *held*
previous frame; making the flip commit render immediately unmasked it. Presentability
had covered pipeline, not encoding generation.

**Fix — commit-synchronous encoding derivation (`display-encoding.ts`).** The
descriptor reseed moved from the `useEffect` into the RENDER body as React's
supported *adjust-state-during-render* / storing-information-from-previous-renders
pattern: when the descriptor `propsKey` differs from `prevPropsRef` DURING RENDER,
reseed `encodingId` + clear per-arity memory (`setEncodingId` during render →
React discards the pass and re-renders with the reseeded id, so the COMMITTED flip
frame already carries the authored encoding). Guarded on the propsKey change so it
fires once, not a loop. Preserved exactly: user/sync-override stickiness + per-arity
memory (neither changes the descriptor propsKey, so the branch leaves them intact),
alias handling, sync-bus adoption, HOME reset. The pure ARITY-flip reseed (channel
selector — a user gesture, not the flip-commit critical path) stays in an effect.

**Tripwire extended.** `ImageParams.authoredColormap` (test-only, set = the
descriptor authored a colormap LUT for this single-image pane) is recorded per
present; `test-hooks`' `isEncodingGenerationMismatch(r)` flags `mode:"image" &&
!contentOpId && !hasSrcB && authoredColormap && !hasColormap` — an authored-colormap
pane drawn with no colormap bound (the stale-generation frame). Param-coherent, so
the source⊗encode oracles were silent; this catches the WRONG GENERATION. The
real-stack GPU harness grew Phase E — a stacked `[magma-scalar image, plain image]`
grid flipped fast — asserting the magma slot is exercised (non-vacuous) and ZERO
encoding-generation mismatches. (A deliberate user curve-override on a
colormap-authored pane is a benign case of this predicate's shape; the flip
harnesses drive descriptor flips only, so the tripwire stays precise.)

**ACCEPTANCE.** The user's own re-test remains the acceptance gate; this closes the
encoding-generation lag mechanism and reports what was measured.

**Gates.** typecheck; 628 node tests (626 + 2 new `isEncodingGenerationMismatch`);
ALL 31 parity harnesses (metal-3, incl. the extended real-stack GPU harness Phase E);
243 pytest; core + gpu-image bundles rebuilt + synced + committed; report (63 blocks)
+ gallery (27 types) regen clean. `uv.lock` left untouched.
