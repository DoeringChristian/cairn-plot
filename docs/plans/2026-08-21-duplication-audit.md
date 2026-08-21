# Post-Unification Audit: Duplicate-State & Drift Findings

Branch `diff_unification` of `cairn-plot`. Every entry below is anchored to code read directly; all findings are confirmed real. Ranked by user-visible severity, then grouped by the structural theme that produced them. The recurring root cause is the epic's signature: **a surface (menu / registry / prop type / enum) was unified while the state or logic backing it was left as two-or-more hand-synchronized copies.**

---

## HIGH — Documented controls silently do nothing on the default renderer

### H1. The `processing` block (brightness/contrast/offset/flipSign, and exposure/offset on the `data=` path) is dropped by GpuImagePane, the DEFAULT renderer
**Claim:** Python emits a `processing` block for 8-bit images that only `CpuImagePane` reads; the default WebGPU pane ignores it entirely, so documented, validated kwargs render nothing on most machines.

**Anchors / evidence:**
- Python packs the knobs into `props['processing'] = {brightness, contrast, gamma, exposure, offset, flipSign}` — `src/cairn_plot/components.py:743-750`, called from the 8-bit path at `components.py:1226-1233`; docstring promises they work (`components.py:982`).
- Only consumer is CPU: `CpuImagePane.tsx:586-587` (`useGammaFilter(processing)` → `post-processing.tsx:26-29`).
- `GpuImagePane.tsx` has **zero** references to `processing`/`brightness`/`contrast`/`flipSign`; it reads only top-level `props.exposure`/`props.offset` (`image-backend.ts:543-544`, `GpuImagePane.tsx:1470-1474`).
- GPU is the default for uint8: addon sets `__cairnPlotUseGpuImage=true` on load (`plot-gpu-image-addon.tsx:120`), `resolveImageRenderer` returns the GPU pane in `auto` (`plot-renderers.tsx:121,157`).
- Extra inconsistency: the top-level *lift* that would make exposure/offset work on GPU exists **only on the `url=` path** (`components.py:1124-1140`, mirrored `builders.ts:280-290`); the `data=` path never got it.

**Risk:** `cp.Image(uint8_array, brightness=…, contrast=…, flip_sign=…)` has no visible effect on WebGPU, contradicting the API docs. The same `exposure=`/`offset=` kwarg produces different pixels depending on `data=` vs `url=` **and** on which backend the viewer happens to get — a silent, non-deterministic drop of a documented control.

**Suggested consolidation:** Give the `data=` 8-bit path the same top-level lift the `url=` path uses, and wire GpuImagePane to read the unified exposure/offset/brightness/contrast/flipSign surface (or apply `processing` in the GPU shader) so a single knob resolves identically on both backends.

---

## MEDIUM — Twin state stores for one concept (still hand-coherent, one missed branch from a bug)

### M1. Diff colormap vs. image display-encoding are two stores for "how this pane maps values to color" (the exemplar bug class, still structurally present)
**Claim:** On the one unified pane, the diff-mode colormap and the image-mode encoding are two independent React stores; the menu/registry is unified but every settings path must hand-branch on `diffMode` to hit the right store.

**Anchors / evidence:**
- Store A (diff face): `diffColormapOverride` useState — `GpuImagePane.tsx:769-770`; consumed as `effectiveDiffColormap` at `:801`; persisted by its own once-seed `diffReseededRef` effect (`:771-791`); publisher `changeDiffColormap` (`:980-993`); modified-dot `diffColormapModified` (`:793`); reset branch `:2768-2770`.
- Store B (image face): `enc = usePaneEncoding(...)` — `:576`; drives image face via `enc.colormap`/`enc.encodingId`; persisted by usePaneEncoding's own per-arity memory + render-time reseed (`display-encoding.ts:330-358`); publisher `changeEncoding` (`:917-928`); reset `enc.resetEncoding()` (`:2740`).
- Neither store reads the other. `settingsSnapshot` forks into two entirely different payload shapes by `diffMode` (`:870-909`); `applyRemoteSettings` routes an incoming colormap patch to `enc.setEncoding` normally but to `setDiffColormapOverride` when `diffMode` (`:843-864`).

**Risk:** Any settings/sync/persistence path that forgets the `diffMode` branch reads/writes the wrong store. Not hypothetical — the documented "orange-frame fix" (`:824-840`, measured `stacked-diff-flip-realstack-gpu` 97/97) arose exactly here: a diff's scalar-error colormap leaked onto light image content because the two split stores had to be manually mode-scoped in the sync bus. Divergent persistence (usePaneEncoding memory vs `diffReseededRef`) are parallel hand-maintained copies that can drift.

**Nuance:** A diff's scalar-error false-color and an image's light→RGB encoding are arguably two *faces*, so a naive one-store merge is wrong (it would carry magma onto the image). The correct fix is a single store modeling two mode-scoped faces.

**Suggested consolidation:** Fold both faces into one `usePaneEncoding`-style store keyed by mode (as `enc` already models curve XOR lut XOR none under one id), so seed/reseed/publish/modified/reset/snapshot/apply-remote each touch one store instead of six hand-synced sites.

### M2. The diff KERNEL (which error metric) is held in two stores — the hoisted per-node override and a pane-local state
**Claim:** The chosen diff metric lives in both `useCompareControl`'s hoisted `kernelOverride` and GpuImagePane's pane-local `diffKernel`, kept convergent only by a callback, a prop-reseed effect, two independent bus subscriptions, and a split HOME path.

**Anchors / evidence:**
- Store A: `plot-node.tsx:1480` `kernelOverride` → returned as `diffKernel` (`:1516`) → `diffSpec.diffKernel` (`:1566`) → `compareSource.opId` (mergedProps `:437`); its own bus subscription at `:1488-1490`.
- Store B: `GpuImagePane.tsx:741-742` pane-local `diffKernel`, seeded from `compareSource.opId`, reseeded by effect `:744-754`, rendered via `resolvedKernelId` (`:800`).
- Menu pick writes **both** (`:755-762`); a remote bus patch in `applyRemoteSettings` writes **only** the pane-local store (`:865`) while the owner independently writes its own override. HOME is split: with an owner it routes through `compareSource.onCompareReset()`, else it resets pane-local `setDiffKernel(diffKernelMeta.default)` (`:2190-2194`, `:2756-2762`).

**Risk:** The hoisted owner is per-node and unmounts on stacked/enlarge flip-away, so the chosen metric can silently reset to descriptor on flip-back — while its *sibling* on the same menu (diff colormap) is deliberately made to persist (`:771-791`), giving two controls in one menu inconsistent behavior. The no-owner HOME fallback resets to `diffKernelMeta.default` (first-mount seed) rather than the live descriptor. (No live misfire reproduced — paths currently converge — but the convergence is accidental.)

**Suggested consolidation:** Make one store authoritative (the hoisted owner when present) and have the pane derive from it, rather than seeding a parallel pane-local copy; unify the bus write and HOME reset onto that single owner.

### M3. Settings-sync bus keeps a flat `lastStates` snapshot that cannot represent per-patch `compareMode` scoping — late-join replay is poisoned
**Claim:** The bus merges every patch into one flat object, losing the association between a colormap and the mode it was published under; a stale `compareMode:'diff'` tag then poisons the snapshot replayed to late joiners.

**Anchors / evidence:**
- Pure spread merge, no key deletion: `image-settings-sync.ts:112` `const merged = {...(lastStates.get(groupId) ?? {}), ...patch}`.
- JOIN replays merged snapshot: `use-synced-image-settings.ts:52-53`.
- Live apply gates on the single `compareMode`: `adoptDisplayEncoding = !(patch.compareMode === 'diff' && !diffMode)` (`GpuImagePane.tsx:840`, mirror `CpuImagePane.tsx:475`). Image publishes omit `compareMode` (`GpuImagePane.tsx:889-908`), so `colormap:turbo` merges over a prior diff's `compareMode:'diff'` → `{colormap:turbo, compareMode:'diff'}`.
- Cross-type groups are the intended orange-frame-fix target (`image-settings-sync.ts:33-41`, `GpuImagePane.tsx:824-839`), so the sequence is reachable.

**Risk:** A late-joining light-image pane reads the poisoned snapshot and either (a) refuses the group's real image colormap (visibly fails to sync) or (b) adopts a diff's magma onto a light image (the orange-frame class the per-patch scoping was written to prevent). Only bites panes that join **after** a mode-crossing publish — evades the per-patch live path the code was tested on.

**Suggested consolidation:** Store `lastStates` per content-kind/face (or carry `compareMode` on every field, image publishes included, and clear it), so replay reconstructs per-patch scoping instead of a lossy flat merge.

### M4. The image display-settings management block is triplicated across GpuImagePane, CpuSdrImagePane, CpuHdrImagePane — and the three copies already diverge
**Claim:** view-local state + controlledSurface reseed effects + `applyRemoteSettings` + `settingsSnapshot` + `change*` publishers + `onReset` + `extraModified` are three parallel implementations of one behavior, and the "don't adopt a diff peer's scalar colormap onto a light pane" rule is spelled three different ways over three different notions of "diff".

**Anchors / evidence:**
- Three hand-copies: `applyRemoteSettings` (`GpuImagePane.tsx:822`, `CpuImagePane.tsx:470`, `:1198`); `settingsSnapshot` (`GpuImagePane.tsx:870`, `CpuImagePane.tsx:486`, `:1226`); reseed effects (`GpuImagePane.tsx:635/657/701`, `CpuImagePane.tsx:461/1145/1177`); `onReset`/`extraModified` (`GpuImagePane.tsx:2739/2772`, `CpuImagePane.tsx:1033/1038`, `:1513/1521`).
- The scoping predicate diverges **and** gates on different diff concepts: `GpuImagePane.tsx:840` boolean unified `diffMode`; `CpuImagePane.tsx:475` a legacy string `DiffMode` enum (file header line 13) merely sharing the name; `CpuImagePane.tsx:1205` unconditional (`patch.compareMode !== "diff"`), correct-by-accident only because CpuHdr can never be a diff face.

**Risk:** A sync fix or newly-synced control added to one backend silently misses the other two; HOME/reset clears a different set depending on which backend and dtype rendered the pane. No live misrender today, but any future edit to the rule — or CpuHdr gaining a compare face — silently desyncs one pane (the exact failure mode that produced the original orange-frame bug).

**Suggested consolidation:** Extract one shared hook (`useImageDisplaySettings`) parameterized by backend/dtype capability, so `applyRemoteSettings`/snapshot/publishers/reset/scoping-rule exist once. Unify the two `diffMode` semantics on the boolean Phase-2c concept.

---

## MEDIUM — Python ↔ TS contract drift (guarded on the wrong axis)

### M5. Four validation enums are hardcoded twice (Python + TS) and covered by no cross-language contract test
**Claim:** compare view-modes, aligns, fits, and pixel-value notations exist as independent Python and TS copies, absent from the contract JSON and both contract tests, so the two faces can silently diverge.

**Anchors / evidence:**
- Python: `_COMPARE_VIEW_MODES` (`components.py:152`), `_COMPARE_ALIGNS` (`:176`), `_COMPARE_FITS` (`:177`), `_PIXEL_VALUE_NOTATIONS` (`:788`).
- TS twins: `COMPARE_VIEW_MODES` (`validate.ts:54`), `COMPARE_ALIGNS` (`:62-68`), `COMPARE_FITS` (`:69`), `PIXEL_VALUE_NOTATIONS` (`:70`); a **third** pixel-notation copy as a type union at `PixelValueOverlay.tsx:92`.
- `schema/cairn-plot-contracts.json` holds only colormaps/tonemapOperators/aliases/displayTransfers/compareKernelPublicNames/builders; `test_contracts.py` and `contracts.test.ts` assert only those — the four enums are guarded by neither.

**Risk:** Adding/renaming a compare align, fit, view-mode, or pixel notation on one face passes all tests while the other rejects it — a latent cross-face break with no CI signal. (Somewhat softened by the validators throwing loudly rather than mis-rendering.)

**Suggested consolidation:** Move all four enums into `cairn-plot-contracts.json` and assert them in both contract tests (as the colormap/tonemap sets already are); collapse the third pixel-notation type union to derive from the runtime list.

### M6. The public-mode → kernel-id mapping that emits `diffSubmode` is duplicated verbatim in Python and TS; contract guards only the KEYS
**Claim:** Both languages hand-maintain an identical public-name→kernel-id table whose VALUES (the ids) are never checked against the kernel registry, so a kernel-id rename drifts both tables with no test failure.

**Anchors / evidence:**
- Python `_COMPARE_KERNEL_MODES` (`components.py:153-169`), emitted as `built['diffSubmode']` (`:2015,2034`).
- TS `COMPARE_KERNEL_MODES` (`validate.ts:41-51`), emitted at `builders.ts:336,344`.
- True source of truth is the kernel registry `{publicName,id}` pairs (`absolute.wgsl.ts:7/9`, etc.) with `kernelIdForPublicName()` (`engine/kernels/index.ts:88-91`) — which the builder ignores; ids mirrored a fourth time in `ops.ts:87-137`.
- Guards check keys only: `test_contracts.py:54` (`.keys()`), `contracts.test.ts` (`listDiffKernelPublicNames()`), `builders.test.ts:147` (`Object.keys(...)`).

**Risk:** Rename kernel id `absolute`→`abs_error` in the registry without touching the two tables → all guards stay green (public name `abs` unchanged) but both faces emit stale `diffSubmode` → `getDiffKernel` fails to resolve → broken/blank Absolute-Error diff in every pane, both authoring paths, zero test failures.

**Suggested consolidation:** Have the builder call `kernelIdForPublicName()` (registry-derived) instead of a hardcoded table, and add a contract assertion that every emitted `diffSubmode` value resolves to a registered kernel id.

### M7. `overlay`/`overlaySettings` honored on uint8 path, silently dropped on float/HDR path
**Claim:** The unified `ImageBackendProps` declares `overlay`/`overlaySettings` for any dtype, but they are threaded only in the uint8 branch and hard-nulled for the float surface — the same latent-drop shape as the fixed colormap-on-float bug.

**Anchors / evidence:**
- Declared for all dtypes: `image-backend.ts:384-385`.
- Threaded only in uint8 branch of `useLegacyImageProps` (`:556-557`); float branch (`:505-532`) omits them; `HdrImageProps` has no overlay field.
- GpuImagePane hard-nulls for float: `const overlay = hdrMode ? undefined : (props as SdrImageProps).overlay;` (`GpuImagePane.tsx:2429-2430`).
- Reachable: `plot-descriptor.ts` returns `decodedToSource(decoded)` **with** `overlay: parseOverlay(...)` for float decodes (`:313/315`, `:344/346`, `:352/354`; `decodedToSource:457-473`); `plot-renderers.tsx:353-354` forwards regardless of dtype. Overlays default-on (`DEFAULT_OVERLAY_SETTINGS.enabled=true`, `types.ts:122-123`).

**Risk:** Identical detection metadata draws boxes/masks on a uint8 PNG but renders **nothing** on an EXR/float image — no error, no warning. Float/EXR is exactly where per-region overlays matter most. (`processing` being SDR-only here is intentional per its docstring — not part of this defect.)

**Suggested consolidation:** Move `overlay`/`overlaySettings` onto the shared `ImageBackendProps` consumption (both branches of `useLegacyImageProps`, `HdrImageProps`) and drop the `hdrMode ? undefined` null-out so the overlay compositor runs on the float surface too.

---

## LOW — Latent divergences, dead code, and naming/doc rot

### Backend/cache divergence (recoverable resets, extra work — no data loss)

**L1. Engine-failure fallback discards live GPU-pane state.** `if (engineFailed) return <CpuImagePane {...backendProps} />` forwards the ORIGINAL descriptor props (`GpuImagePane.tsx:2441-2444`, captured `:343`), not the live state; CpuImagePane re-seeds from those props (`CpuImagePane.tsx:486-500`). Both panes hold independent useState for the same settings (Gpu `:576/629/654/673/674/692/698/741/769`; Cpu `:443/458/1126/1143/1158/1159/1171/1173`). A hard GPU failure mid-session (`renderPass`→`setEngineFailed(true)`, `:1881-1888`) resets exposure/offset/peak/gamma/bounds/colormap/kernel to descriptor; the CPU SDR path even lacks EV/offset sliders so those can't be re-applied. Rare error path. *Fix: seed CpuImagePane from the live settings snapshot on fallback, not descriptor props.*

**L2. Flip-back served by two independent LRU caches at the same cap.** `uploadCacheRef` (CPU upload, keyed on `b`, capped via `rememberUpload`, `GpuImagePane.tsx:463/511`, touched only in setSourceB `:1406-1418`) and pool `retained` (GPU textures, keyed on both `a` and `b`, `pool.ts:362/438`) evict on different key sets. Since the pool spends slots on `contentKeyA`, past ~5 distinct diff slots a flip-back is a CPU-upload HIT but pool MISS → a synchronous re-upload. Divergence is one-directional (upload set is a superset), and the re-upload is synchronous inside the pre-paint fast path, so no flicker — just sub-frame GPU churn. *Fix: key both caches identically or drive upload residency off the pool.*

### Dead code / stranded seams (no runtime behavior)

**L3. Four orphaned `ViewportCapabilities` descriptors.** `meshViewportCapabilities` (`mesh-viewport.tsx:503`), `pointCloudViewportCapabilities` (`pointcloud-viewport.tsx:447`), `boxesViewportCapabilities` (`boxes-viewport.tsx:463`), `volumeViewportCapabilities` (`volume-viewport.tsx:404`) appear only in their own files (cross-file mentions are prose comments claiming they "mirror" each other). Only `imageViewportCapabilities` reaches a barrel (`viewport/index.ts:15`, `index.ts:251`) — and even it has no in-repo consumer. The intended viewport-module registry was never built. *Fix: delete the four dead consts, or build the registry that consumes them.*

**L4. `diffCacheSize`/`clearDiffCache` dead.** Exported at `diff-engine.ts:444/449`, no caller in either repo; their only historical consumer was the deleted `GpuComparePane`. Leaves the diff-result LRU cap (from the `ce554bb4` diff-cache-caps work) with **no** test asserting it evicts or clears. *Fix: either wire these into an eviction test or remove them.*

**L5. Context-loss test hooks dead.** `getContextLossEvents` (`test-hooks.ts:567`) and `contextLossInstrumentationActive` (`:552`) have zero callers; both duplicate live paths (the `window.__cairnContextLossEvents` global and the `userCaptureArmed` check). Note the write path *is* live (`use-scene3d.ts:877/880`, `webgpu/device.ts:646`) — only these two read accessors are stranded. *Fix: remove the two dead accessors.*

**L6. Misc dead utility exports.** Each occurs once repo-wide with no barrel re-export: `svgToPng` (`plot-to-png.ts:170`), `poolLiveCount` (`context-pool.ts:158`), `PLOT_MARGIN` (`theme.ts:51`), `hasFloat16Array` (`half.ts:54`), `__resetCapabilityNoticeForTests` (`capability-notice.ts:318`). Two are load-bearing-*looking* test seams implying coverage that doesn't exist. *Fix: delete, or wire the test seams into their tests.*

**L7. Dead `NormMode`/log/power configuration surface.** `type NormMode = 'linear'|'log'|'power'` (`registry.ts:122`), `NORM_ID` (`:132`), and the log/power shader branches (`wgsl.ts:229-234`) are unreachable — no producer ever emits non-`linear` (panes hardcode linear and say so: `CpuImagePane.tsx:1218`, `GpuImagePane.tsx:854/1802/1822/2695`); `norm` was never a Python kwarg. Deliberately retained inert substrate, covered by parity tests. *Fix: none required; document as intentional or prune the unreachable branches.*

**L8. Selection-sync field lists non-uniform + phantom `interpolation` field.** CpuSdr syncs only encoding/colormap/tonemap/tonemapGamma (`CpuImagePane.tsx:486-494`) while CpuHdr (`:1226-1237`) and Gpu (`GpuImagePane.tsx:870-909`) add exposureEV/offset/reduce/bounds. This tracks genuine per-pane capability differences (SDR pane has no exposure/bounds *state*), so it is not a dropped sync — but `ImageSyncSettings.interpolation` (`image-settings-sync.ts:56`) is declared and never published or applied by any pane (`GpuImagePane.tsx:2427` treats it prop-only). *Fix: remove the dead `interpolation` field and its stale docstring line (`image-settings-sync.ts:6`).*

### Naming / documentation rot (test fidelity, maintainer confidence)

**L9. `GpuComparePane` cited as authoritative spec in ~27 files after deletion.** No definition exists (deleted in `28e4275`; the `.worktrees/*` copies are other branches). Parity claims point at an unopenable component: "Mirrors GpuComparePane's diff kernel" (`GpuImagePane.tsx:731`), "byte-identical to GpuComparePane's compose" (`:1595`), `ops.ts:151/195`, `image.wgsl.ts:414`; several comments cite the nonexistent path `media-compare/GpuComparePane.tsx` as current (`ImagePaneShell.tsx:9`, `ssim-metric.ts:14`, `test-hooks.ts:8`, `LabelChip.tsx:14`, `RefBadge.tsx:11`). A meaningful subset are honest "now deleted (Phase 4)" breadcrumbs (`compositor.tsx:70`, `media-compare/index.ts:93`, etc.) — legitimate, not rot. Comment-only, zero runtime impact. *Fix: rewrite parity claims to reference the unified pane + content-op registry as the source of truth.*

**L10. Probe-seam naming unconsolidated.** One `paneRef` element carries three probes — `__cairnImageDiffProbe` (`GpuImagePane.tsx:2094`), `__cairnImagePaneProbe` (`:2212`), `__cairnChromeProbe` (`:2416`); the "Diff" probe also carries split/blend compositor seams (`:2125`), making its name a misnomer. Legacy `__cairnCompareProbe` is never assigned yet read as a dead `??` fallback in **two** harnesses (`compare-settings-sync.browser.ts:186`, `grid-stacked-persist.browser.ts:102`) — the claimed third harness only mentions it in a comment. Probe `.home` seams reset a strict subset of the real `onReset` (`:2186-2196`/`:2229` vs `:2739-2768`) yet claim to match it. Test-only. *Fix: rename the misnamed probe, delete the dead `__cairnCompareProbe` fallback, and make probe `.home` call the real `onReset` so HOME-regression tests have real coverage.*

**L11. Stale "side" compare-mode comment.** `types.ts:70-72` documents `MediaCompareModeKind` as `(normal | side | split | blend | diff)`, but the enum is `'normal'|'split'|'blend'|'diff'` — no `side` (`mode.ts:14`, array `:16-21`). Doc-only. *Fix: correct the comment.*

---

## Systemic patterns

The findings collapse into five recurring root causes, all traceable to the unification epic collapsing surfaces faster than the state/logic behind them:

1. **Unified surface, un-unified backing state.** One menu/registry/prop-type over two-or-more hand-synced stores, coherent only because every seed/reseed/publish/reset/snapshot/apply-remote site remembers to touch all copies (M1, M2, M4). The seed bug (diff colormap vs encoding) is the exemplar; M3 is the same failure in the sync bus, where a *flat* snapshot structurally cannot represent the per-patch scoping the live path depends on.

2. **Per-dtype / per-backend fan-out that silently drops a unified prop on one branch.** A prop declared once on the unified type is threaded on the uint8/GPU path but omitted on the float/CPU path — no error, just a missing effect (H1, M7, L1, L8). This is the highest-severity class because the drop is invisible and depends on the viewer's hardware.

3. **Cross-language duplication guarded on the wrong axis.** Python and TS hand-maintain identical tables/enums; the contract test checks the *keys* (or a subset of sets) but not the *values* or the full set, so drift passes CI (M5, M6). The registry that should be the single source of truth already exists (`kernelIdForPublicName`) but the builders bypass it.

4. **Registry-that-was-never-built.** Descriptors/accessors were exported in anticipation of a consuming registry (viewport modules, cache introspection, context-loss instrumentation) that never landed, leaving orphaned exports that read as live features (L3, L4, L5, L6).

5. **Deleted-behavior surfaces and phantom specs.** Removed components/modes (`GpuComparePane`, the norm picker, `side` mode) survive as unreachable config, dead probe fallbacks, and parity comments pointing at code that no longer exists (L7, L9, L10, L11) — corrosive to maintainer confidence and the primary way a future edit re-derives wrong behavior.

The single highest-leverage remediation is a shared `useImageDisplaySettings` hook that owns one mode-scoped store plus one copy each of apply-remote/snapshot/publish/reset — it directly closes M1, M2, M4, and structurally prevents the class behind M3 and M7.

---

## Addendum — duplicated-logic dimension (rerun)

The original run's fifth planned dimension — **the same ALGORITHM re-expressed in 2+ places that can drift** (as opposed to the twin-*state* stores of M1–M4 or the enum/table copies of M5–M6) — failed to execute. This addendum reruns it: a fresh sweep of `ui/src/lib/cairn-plot/`, `ui/src/`, and `src/cairn_plot/` for copy-pasted computation. Each candidate was adversarially checked so that pure delegation/layering (the EXR worker→`decodeExrPreferWasm` core, the single-source `colormaps/` LUT stack, `resolveColormapMode`, the `formatChannelValue`/`formatNum` pixel formatter, `reduceToScalar`) is NOT reported. Three confirmed findings; the rest of the surface is genuinely consolidated (recorded below).

### D1. The object-contain letterbox (fit scale + centering) is hand-reimplemented in 4 sites that bypass the `computeFit` primitive built to be its single source
**Claim:** `renderers/region-select.ts` exports `computeFit`/`screenPerTexel`/`screenToTexel` as THE shared object-contain screen↔texel primitive (and `PixelValueOverlay` + `ImagePaneShell` correctly consume it), yet four other sites recompute the identical `scale = min(box.w/natural, box.h/natural)` + `(box − disp)/2` centering inline instead of calling it.

**Anchors / evidence:**
- Shared primitive: `region-select.ts:64-82` `computeFit` (`scale = Math.min(box.width/visibleW, box.height/visibleH)`, `imgLeft/imgTop = (box − disp)/2`), `screenPerTexel` `:85-87`. Good consumers: `PixelValueOverlay.tsx:45,288,303` ("the SAME `computeFit` the region marquee uses"), `ImagePaneShell.tsx:81-87,362,989`.
- Hand-copy 1: `GpuImagePane.tsx:307-311` (`viewportToUvRect`) — `scale = Math.min(paneBox.width/naturalW, paneBox.height/naturalH)`, then `imgLeft/imgTop = (paneBox − disp)/2` verbatim, before composing zoom/pan (the zoom/pan compose IS unique; the fit scale+centering is the copy).
- Hand-copy 2: `GpuImagePane.tsx:331-343` (`screenPxPerTexel`) — `Math.min(box.width/visibleW, box.height/visibleH)`; its own doc (`:323-327`) admits it is "the exact same object-contain-fit formula `PixelValueOverlay.tsx`'s `draw()` uses" that must "stay in EXACT lockstep."
- Hand-copy 3: `viewport/reframe.ts:66-67` — `S = Math.min(oldBox.width/naturalWidth, oldBox.height/naturalHeight)` (+ `S2` for the new box), the home-fit letterbox scale re-derived for the resize reframe.
- Hand-copy 4: `renderers/ImageOverlay.tsx:65-71` — `scale = Math.min(cw/naturalWidth, ch/naturalHeight)`, `left/top = (cw − dispW)/2` / `(ch − dispH)/2`, verbatim.

**Risk:** Hover pixel-readout, the region marquee, the GPU nearest/linear filter-switch threshold (`Q20`), the resize reframe, and the overlay-box placement must all agree on one letterbox geometry. `computeFit` is the deliberate seam that guarantees it — but an edit to it (a DPR term, a min-scale clamp, a non-centered or fill fit) silently misses the four inline copies, so hover lands on the wrong texel / the filter flips at a different zoom than the numbers appear / overlay boxes drift off the image. `GpuImagePane`'s own comment naming the lockstep requirement is the tell that the coupling is currently hand-maintained, not enforced.

**Adversarial self-check:** Not layering — the shared primitive exists AND has real consumers, proving the seam; these four re-express the formula rather than import it. `viewportToUvRect`'s zoom/pan composition is legitimately unique and is NOT counted; only its embedded fit scale + centering is the duplicate.

**Suggested consolidation:** Have `viewportToUvRect`, `screenPxPerTexel`, `reframeViewportForResize`, and `ImageOverlay`'s rect memo call `computeFit`/`screenPerTexel` (feeding the full-window `sourceWindow` where they use the whole image) so the object-contain scale+centering exists once.

### D2. The diff-id → default-color decision is hardcoded in TWO parallel registries (kernel `defaultColormap` + content-op `defaultEncoding`) with matching values kept in sync by hand
**Claim:** For the overlapping pointwise-diff ids (`signed`/`absolute`/`squared`/`relative_*`) the default color is asserted independently in the `engine/kernels` registry (`defaultColormap`) AND the `content-ops` registry (`defaultEncoding`) — two literal tables encoding the same id→color rule, neither derived from the other.

**Anchors / evidence:**
- Kernel table (LIVE in the runtime UI): per-kernel `defaultColormap` — `signed.wgsl.ts:12` `"red-green"`, `absolute.wgsl.ts:11` / `squared.wgsl.ts:11` / `relative-*.wgsl.ts` `"turbo"`, `flip.wgsl.ts:299` / `ssim.wgsl.ts:200` / `hdr-flip.ts:165` `"magma"`; surfaced by `kernelDefaultColormap()` (`kernel-registry.ts:149-150`) and consumed by the actual pane seed/reset at `GpuImagePane.tsx:588,969,2201,2783`.
- Content-op table: per-op `defaultEncoding` — `content-ops/ops.ts:76` `range === "R" ? "red-green" : "turbo"` (the SAME signed→red-green / magnitude→turbo split), `:217` `"magma"`, declared required at `content-ops/registry.ts:134`. Its own comment (`ops.ts:14-15`) states `defaultEncoding` "generalizes the kernels' per-kernel `defaultColormap`" — i.e. a re-statement, not a derivation.
- `defaultEncoding` is consumed only by the parity/registry TESTS (`engine/__tests__/content-ops.browser.ts:97,324`, `content-ops/registry.test.ts:50,65,78,91`) via `getEncoding(op.defaultEncoding)`; the runtime diff color comes from the KERNEL table through `GpuImagePane`. So the two tables answer the same question on different paths.

**Risk:** Change a kernel's `defaultColormap` (e.g. `absolute` turbo→magma) without editing the content-op's `defaultEncoding` and the runtime seed (kernel table) diverges from the parity harness's display twin (content-op table): the harness still passes against its own stale value while the UI shows a different default, or the registry-drift test fails on a value the user never sees. Two hand-synced copies of one decision, guarded only by tests that each read their own copy.

**Adversarial self-check:** `defaultEncoding` is a genuine superset concept (it also covers `identity`/`split`/`blend` as `srgb`, which have no kernel default) — that non-overlapping part is legitimate, NOT reported. The duplication is strictly the pointwise-diff subset where both tables hardcode the identical red-green/turbo value for the same id.

**Suggested consolidation:** Derive the pointwise op's `defaultEncoding` from `kernelDefaultColormap(op.id)` (or vice-versa) so the shared subset resolves from one table; keep only the compositor/identity encodings as literals.

### D3. The `viridis → turbo` back-compat alias is written as three independent literals (1 Python, 2 TS)
**Claim:** The removed-colormap alias is re-expressed three times rather than shared, and unlike the colormap SET (contract-pinned) the alias MAPPING is asserted by no cross-language test.

**Anchors / evidence:**
- Python: `components.py:107` `_COLORMAP_ALIASES = {"viridis": "turbo"}` (applied `:114`, `:135`).
- TS copy 1: `colormaps/lut.ts:175-177` `aliasColormap` (`name === "viridis" ? "turbo" : name`).
- TS copy 2: `image/encodings/registry.ts:401` `getEncoding` inline `id === "viridis" ? "turbo" : id` — its comment (`:399-400`) explicitly justifies the copy: "kept a bare literal here so the core-safe registry pulls no extra import."

**Risk:** Adding/renaming a second alias (any future colormap removal) must touch all three sites; miss one and Python accepts a name the TS registry rejects (or vice-versa), with no CI signal — the same wrong-axis gap as M5/M6 (the colormap *set* is contract-tested, the *alias* is not).

**Adversarial self-check:** Not layering — three literals of one mapping; the `registry.ts` comment is a self-admitted deliberate copy. Low severity (single fixed entry today), but a real drift seam.

### Swept and cleared (consolidated — no finding)
Recorded so the negative space is explicit: **colormap/LUT sampling** is a single stack (`COLORMAP_STOPS` → `getColormapLUT`/`colormapFloatLUT`/`applyColormap`, one canonical table, `aliasColormap` the only fork → D3); **f16/float conversion** is centralized in `image/half.ts` (`halfToFloat`/`f16BitsToFloat32`), and the per-sample `isF16 ? halfToFloat(raw) : raw` accessor idiom (`gpu-image-samplers.ts:72`, `image-histogram-source.ts:78`, `CpuImagePane.tsx:1356`) all delegate to that one primitive — a 1-liner branch, not a drift-prone algorithm; **diff colormap index mode** is one place (`engine/diff-cmap-mode.ts`'s `resolveColormapMode`, shared GPU/CPU); **pixel-value formatting** funnels through `formatChannelValue`→`formatNum`; **reduce-to-scalar / data-index** math is single-sourced with byte-parallel WGSL twins (`encodings/registry.ts`); **npy/exr parsing** is not duplicated worker↔main — the worker (`exr-worker.ts`) and the main-thread path both call the one `decodeExrPreferWasm` core; **menu builders** derive from single option lists (`COLORMAP_OPTIONS`, `REDUCE_MENU_OPTIONS`). Channel-name derivation (`floatChannelNames` Y/RGB/RGBA/Cn vs `channel-slice.ts`'s `RGBA.slice`) uses different rules for different purposes and is not the same algorithm.
---

## M2 — DONE: ONE authoritative diff-kernel store (owner-derived) + ephemeral kernel sync

**Design.** The diff KERNEL (which error metric) had TWO stores kept convergent by
hand: the hoisted `useCompareControl.kernelOverride` (`plot-node.tsx`) and
`GpuImagePane`'s pane-local `diffKernel` `useResettableState` (seeded from
`compareSource.opId`, reseeded by a `useLayoutEffect`). M2 makes the hoisted owner
AUTHORITATIVE and the pane DERIVE:
- `GpuImagePane` now computes `diffKernel = compareSource.opId` directly whenever an
  owner is present (`hasKernelOwner = !!compareSource.onDiffKernelChange`) — no
  parallel pane-local seed/reseed. A cross-type consumer with NO owner (the live-3D
  snapshot compare `OffscreenComparePanes`, which threads no `onDiffKernelChange`)
  keeps a local fallback store so its own menu still works.
- ONE write path: `setDiffKernel` routes to `compareSource.onDiffKernelChange` when
  present (the owner re-derives `opId` back into the pane), else the local fallback.
- ONE HOME path: unchanged — `compareSource.onCompareReset()` when owner present,
  else the local fallback's default.
- `applyRemoteSettings` no longer writes the kernel when an owner is present (the
  owner carries the group's kernel subscription itself); only the no-owner pane
  adopts a live kernel patch into its fallback store.

**The multi-select collapse fix (viewport-owned model).** The diff kernel is a
per-VIEWPORT content-op choice: distinct diffs in one selection legitimately hold
DISTINCT kernels (FLIP/SSIM/absolute → magma/magma/turbo). `changeDiffKernel`
published `{diffKernel}` which `publishImageSettings` accumulated into the replayable
`lastStates` snapshot — so a pane joining / a selection re-forming read a stale
`diffKernel` off `getLast` and COLLAPSED every peer onto the anchor's metric.
`diffKernel` is now an EPHEMERAL bus key (`image-settings-sync.ts` `EPHEMERAL_KEYS`):
broadcast LIVE to already-selected peers (an explicit pick still MIRRORS) but stripped
from the accumulated snapshot (formation / late-join / re-form never inherit it).
`compareMode`/`splitPosition`/`blendAlpha` stay persisted (a split/blend joiner must
align to the group's mode + divider/alpha) — only the kernel is ephemeral.

**Deleted code.** `GpuImagePane`'s parallel kernel store: the `diffKernel`
`useResettableState` reseed-from-`compareSource.opId` semantics (the pane-local store
is now only a no-owner fallback, `localKernel`, not a hand-synced twin of the owner);
`setDiffKernelState` as the applyRemoteSettings write in the owned path; the diffKernel
entry in the accumulated `lastStates` merge.

**Evidence.**
- Unit: `image-settings-sync.test.ts` +1 test "diffKernel is EPHEMERAL: live-broadcast
  to peers but NOT persisted into the snapshot"; the prior "merges compare-only AND
  shared keys" test updated to the viewport-owned model (mode/split/blend persist,
  kernel does not). 629 node tests green (was 628).
- Harness: `stacked-diff-flip-realstack-gpu` gains PHASE K (real PlotApp GPU tree):
  multi-selecting two DISTINCT-kernel diffs (FLIP + absolute) does NOT collapse them on
  formation, and an explicit kernel pick still MIRRORS to the selected peer. ALL 31
  parity harnesses green (hardware WebGPU), incl. `compare-settings-sync` (live KERNEL
  mirror step) and `page-wide-selection`.
- typecheck 0; 243 pytest; core + gpu-image bundles rebuilt (gpu-image → 380.35 KB) +
  synced + committed. `uv.lock` untouched.

---

## M3 — DONE: mode-aware snapshot merge (the compareMode FACE tag travels with the scoped display keys)

**Design.** The bus accumulated every patch with a flat spread, so a stale
`compareMode:"diff"` tag rode over a LATER image colormap: a diff seeds
`{colormap:magma, compareMode:"diff"}`, an image publishes `{colormap:turbo}` (no
tag) → the flat merge yields `{colormap:turbo, compareMode:"diff"}`. A LATE-joining
light pane read that poisoned snapshot and either refused the group's real image
colormap or adopted the diff's magma onto light content (the orange-frame class) —
a replay a LIVE listener never saw (live, the untagged image patch adopts fine).

`compareMode` is the FACE tag for exactly the SCOPED display keys the receiver's
`adoptDisplayEncoding` gate reads (`encoding`/`colormap`/`tonemap`). `publishImageSettings`
now reconciles it mode-aware (`SCOPED_DISPLAY_KEYS`):
- a patch that WRITES a scoped key re-tags the snapshot to THAT patch's face (its
  `compareMode`, or CLEARED when it carries none — an image write erases a prior
  diff tag), so the replay equals what a live listener applied;
- a BARE `compareMode` patch (a mode switch, no display key) broadcasts LIVE (peers'
  `useCompareControl` adopt the mode) but does NOT re-tag stale display keys.

**Publisher coherence (the other half of the anchor's fix — "carry compareMode on
every field … and clear it").** Diff-face SCOPED-display publishes now carry the tag
so an untagged live write can't erase it: `GpuImagePane.changeEncoding` (tags `"diff"`
when `diffMode`) + `changeDiffColormap` (always `"diff"`); the CPU SDR pane's
`changeEncoding` + `settingsSnapshot` gained the same `diffMode !== "none"` tag (its
snapshot never tagged its scalar-error face before — a latent CPU orange leak, now
closed). The CPU HDR pane can never be a diff, so it stays untagged. Image / split /
blend publishes stay untagged-or-mode-tagged (a light peer adopts them — only the
scalar-error `"diff"` face scopes out).

**Deleted code.** The flat `{...prev, ...patch}` snapshot accumulation (replaced by
the mode-aware reconcile); the CPU SDR diff's silently-untagged scalar-error snapshot.

**Evidence.** +4 unit tests in `image-settings-sync.test.ts`: image colormap CLEARS a
prior diff tag (no poisoned replay); a bare mode switch does NOT re-tag stale keys; a
diff tag PERSISTS across a non-scoped (exposure) update; a split face tags the light
curve `split` (a light peer still adopts it). 633 node tests green (was 629). ALL 31
parity harnesses green (compare-settings-sync / page-wide-selection / cpu-compare-
fallback / realstack). typecheck 0; 243 pytest; core + gpu-image bundles rebuilt +
synced. `uv.lock` untouched.

---

## M4 — DONE: ONE shared content-kind display-encoding sync rule (three panes, one source)

**Design.** The "don't adopt a diff peer's scalar-error colormap onto a light pane"
rule (orange-frame fix) lived as THREE hand-copies whose predicate diverged AND gated
on three different notions of "diff": GpuImagePane's boolean `diffMode`, the CPU SDR
pane's legacy `DiffMode` string enum (`diffMode !== "none"`), the CPU HDR pane's
unconditional `patch.compareMode !== "diff"` (correct only by accident). A sync fix
added to one silently missed the other two. New module
`renderers/image-display-encoding-sync.ts` single-sources:
- `shouldAdoptDisplayEncoding(patch, isDiffFace)` — the ONE scoping predicate;
- `adoptRemoteDisplayEncoding(setEncoding, patch, isDiffFace)` — the scoped
  encoding/colormap/tonemap adoption (identical across all three panes);
- `diffFaceTag(isDiffFace)` — the M3 publisher FACE tag.
All parameterized by ONE boolean capability, `isDiffFace`, supplied explicitly per
pane: GpuImagePane `diffMode`; CPU SDR `diffMode !== "none"`; CPU HDR constant `false`
(it can never be a diff face — now an explicit parameter, not an accidental predicate).

**Scope (deliberate).** The genuinely per-capability STATE stays pane-local — the CPU
SDR pane has no exposure/offset/peak/bounds sliders; only GpuImagePane has the diff
kernel + compositor params — so relocating all `useState` into a mega-hook would
encode differences as branches, not remove duplication. What was TRIPLICATED-AND-
DIVERGENT was the scoping RULE + scoped-encoding adoption + the face tag; those now
exist once. The unconditional display keys (gamma/EV/offset/reduce/bounds) remain each
pane's own `applyRemoteSettings` tail (a flat list of independent setters, not a
drift-prone rule).

**Deleted code.** Three copies of the `adoptDisplayEncoding` predicate + the
encoding/colormap/tonemap adoption block (GpuImagePane, CPU SDR, CPU HDR); the three
inline `compareMode:"diff"` tag literals (folded into `diffFaceTag`).

**Evidence.** New `image-display-encoding-sync.test.ts` (+6 tests: diff-tag refused by
a light face / adopted by a diff face; untagged image encoding adopted by every face;
split/blend adopted by a light face; encoding-primary back-compat fallbacks; a
diff-tag never reaches a light store; the tag). 639 node tests green (was 633). ALL 31
parity harnesses green (compare-settings-sync / cpu-compare-fallback / page-wide-
selection / realstack). typecheck 0; 243 pytest; core + gpu-image bundles rebuilt +
synced. `uv.lock` untouched.
