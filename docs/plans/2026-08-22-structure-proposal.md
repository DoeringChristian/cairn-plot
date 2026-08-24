# Structural Proposal: Retiring the Hot-Patch Layers

**Date:** 2026-08-22
**Branch:** `diff_unification` (content baseline `cdebfe4` — the *one-concrete-viewport-value* ruling)
**Status:** PROPOSAL — for user sign-off. Implements nothing.
**Scope:** `ui/src/lib/cairn-plot/{renderers,engine,viewport}` + `ui/src/plot-node.tsx`

---

## 0. The thesis

After two unification epics and ~15 fix waves, the code is not wrong — it is *over-owned*. Almost every hot-patch in the inventory below is a second (or third) representation of a fact that already has a home somewhere else, kept in sync by hand at the fix's own site. The disease is **duplicated ownership**, and its symptoms are always the same four shapes:

1. **Twin state** — one fact held in two cells, synced by hand (`hdrEngaged` ∥ `useHdrRef`; `appliedPrimaryIdRef` ∥ what the pool bound; publish-snapshot ∥ adopt-copy).
2. **A policy applied N times by hand** — `if (controlledSurface) setX(...)` re-implemented per display field across three panes.
3. **Mode encoded as branches, not data** — long `if (mode) {…return}` fall-throughs with defensive floors at the bottom; sentinel values (`opId===0`, `__diffB===undefined`) that collide "unknown" with a real state.
4. **Test scaffolding braided into the hot path** — `window.__cairn*` toggles read *inside* render, bug-signature oracles shipped as library code, instrumentation interleaved line-by-line with the present.

The counter-example already lives in the tree: [`renderers/render-snapshot.ts`](../../ui/src/lib/cairn-plot/renderers/render-snapshot.ts) is a single pure struct that centralizes `mode / primaryId / bId / kernelId / contentKey / sourcesApplied / resident`, read by the present gate, the pre-paint effect, the flip detector, and the paint-phase log — *no downstream reader re-derives its own view*. **Every proposal below is "make the rest of the codebase look like `render-snapshot.ts`."**

North star (the user's ruling, restated as invariants the architecture must make *structurally true*):
- **State flows one direction.** Owners publish; consumers derive. No consumer writes back into an owner's fact.
- **Every value has exactly one owner.** If two cells must be kept equal, one of them is a bug.
- **Mode is data, not branches.** An unhandled mode is a *type error at the boundary*, never a runtime flash caught by a floor.

---

## 1. Ranked hot-patch inventory (merged & deduped)

The 4 area inventories collapse into **five patch CLASSES**. Ranking = blast radius × drift-danger × root-cause leverage (fixing the class deletes the most patches).

### Class 1 — Shadow/twin state (hand-synced duplicates of one fact) · **HIGHEST**
The root of "a lot of fixes that are just patches": each fix added a shadow that must be re-synced at its own site.

| Representative site | The fact, and who *should* own it |
|---|---|
| `GpuImagePane.tsx:502-503` `appliedPrimaryIdRef`/`appliedBIdRef`, stamped at `1299,1324,1359,1385,1471,1486`, read at `1692`; expected-id **duplicated** in `render-snapshot.ts:116-125` | *What the pool actually bound.* Owner: **the Pool.** |
| `GpuImagePane.tsx:453-871` — 5 `*Version` counters (`uploadVersion`, `refUploadVersion`, `pixelDataVersion`, `diffOverlayVersion`, `containerTick`) | *"An async side-effect landed."* Owner: **one monotonic `poolRevision`.** |
| `GpuImagePane.tsx:881-977` — `applyRemoteSettings` (adopt-twin) ∥ `settingsSnapshot` (publish-twin), field-by-field | *One settings value.* Owner: **one `PaneSettings` (de)serializer.** |
| `GpuImagePane.tsx:435` `useHdrRef` ∥ `442` `hdrEngaged`, set together `1184-1185` | *The HDR-out decision.* Owner: **plain state (or the pool handle).** |
| `GpuImagePane.tsx:592-928` `hasKernelOwner` dual store (`compareSource.opId` vs local `useResettableState`) | *The authoritative kernel.* Owner: **always an owner** (default one for the ownerless caller). |
| `GpuImagePane.tsx:629-632` `initialEncSeedRef` (write-during-render freeze) | *The once-only encoding seed.* Owner: **the hook's lazy initializer.** |
| `GpuImagePane.tsx:1500-1536` `uploadCacheRef` (hand-rolled LRU bounded to the pool's cap) | *Retained decoded upload.* Owner: **the Pool** (`getRetainedUpload(key)`). |
| `plot-node.tsx:376-397` LeafView single `state` cell that lags `resolveKey` | *The resolution for the current key.* Owner: **the resolve-cache, subscribable.** |
| `display-encoding.ts:339-345` `overridden` ∥ `encodingModified = id !== seedFor(arity)` | *"User explicitly picked."* Owner: **an `EncodingState` sum.** |
| `image-engine.ts:348` ∥ `pool.ts:87` — `scalarMode` ternary duplicated verbatim | *The 4-way scalar path.* Owner: **one `scalarMode` enum field.** |
| `engine/test-hooks.ts:578-598` — three co-resident module copies reconciled by a "longest ring buffer wins" heuristic | *The capture state.* Owner: **one shared runtime chunk.** |

### Class 2 — The `controlledSurface` fork (derive-vs-own) re-implemented per field · **HIGH**
One decision — *"does this pane follow host props or own its settings?"* — applied by hand five to seven times, across three pane bodies. Exactly the shape that drifts when an eighth field is added.

- `GpuImagePane.tsx:661-664` `controlledSurface`, forked at `679` (encoding), `751-754` (peak), `773-775` (gamma), `817-820` (bounds).
- `CpuImagePane.tsx:466,1152,1184` — the same forks re-implemented.
- `display-encoding.ts:361-389` — a render-time reseed block with two tracking refs coordinating with a sibling `useEffect([arity])`, all to make the controlled case's *committed* frame carry the reseed.
- `initialEncSeedRef` (Class 1) exists only to defend the interactive branch of this same fork.

### Class 3 — Mode-as-branches, sentinel collisions, hand-built scheduler · **HIGH**
Control can reach a path the domain says is impossible, so a floor catches it. The floor is the tell that mode is not modeled as data.

- `GpuImagePane.tsx:1982-2004` renderPass fall-through: `if (hasCompare) return false` floor + `compareIntended` tag; `1710,1756` `refDims` floors duplicating `snapshot.resident`.
- `GpuImagePane.tsx:1819-1825` `if (opId === 0) return false` — sentinel `0` collides IDENTITY with "unknown op"; sibling `1757` `getDiffKernel(id) ? id : 'absolute'` floors an unresolved kernel.
- `GpuImagePane.tsx:2035-2113` — **two render effects** (`useLayoutEffect` pre-paint / `useEffect` post-paint) racing on a shared `lastRenderedRef` dedupe. A hand-built scheduler split across two effects that must agree via a mutable ref.
- `GpuImagePane.tsx:1287-1451` — union-shape dep ternaries (`hdrMode ? X : null`) and `(props as HdrImageProps)` casts throughout; three near-duplicate upload effects.
- `plot-node.tsx:412-462,725-732` — `__diffB === undefined` sentinel over a `Record<string,unknown>` side channel; the diff-HOLD branch emits a half-built props object rather than a `compareSource` with `b:undefined`.
- `viewport/image-settings-sync.ts:144-173` — a three-branch reconcile that pulls `compareMode` out of the spread and re-pairs it to the display key by hand (30 lines of comment reconstruct the M3 orange-frame bug).
- `GpuImagePane.tsx:168,729` `NONE_GRAY_CURVES` hardcoded set + `scalarNoneData` fork; `plot-node.tsx:1468` `'side'→'split'` legacy alias inline.

### Class 4 — Dual "kept for safety" paths & duplicated derivations · **MEDIUM**
Two implementations kept in lockstep; a default literal copy-pasted; a dead capability branch retained.

- `engine/pool.ts:672-781` — four catch handlers each poke `entry.parked = false; parkEntry(entry)` to defeat `parkEntry`'s own `if (entry.parked) return` idempotency guard (line 468) that would otherwise leak half-allocated resources on a mid-activation throw.
- `GpuImagePane.tsx:1209-2004` — four near-identical `try/catch → setEngineFailed(true)` blocks whose own comments admit they duplicate `attemptRender`'s return-false.
- `engine/diff-engine.ts:343-402`, `image-engine.ts:577-595` — GPU-reduction `else` arms that are *dead in production* (`reduceDiffSumSquaredAbs`/`reduceTextureChannelMean` are optional but the one shipping backend always provides them), fused with the *one legitimate* mapping fork.
- `engine/diff-engine.ts:121-402` (×5), `image-engine.ts:563` — the `mapping ?? computeCompareMapping(…,'top-left','crop','b')` default copy-pasted at five sites the content-keyed cache depends on agreeing.
- `engine/pool.ts:535` — `backingWidth || source.width || deep.width || 1` four-way floor over lagging backing size.
- `GpuImagePane.tsx:389-2909` — `reserveOnly`/`renderCompareChrome`: a plain image imitates the diff slot's chrome branch-by-branch at ~7 sites so a stacked flip doesn't mount/unmount menus; paralleled in `plot-node.tsx:215,468,494` + `stack-context.ts` `StackHasCompareContext`.
- `image-settings-sync.ts:42-44`, `display-encoding.ts:305,394` — legacy alias cascades (`encoding ?? colormap ?? tonemap`; `viridis→turbo` at three sites).
- `plot-node.tsx:1465-1558` `useCompareControl` runs for **every** node kind (defaulting for plot/grid) to keep hook order stable across a reused-instance flip.

### Class 5 — Test scaffolding braided into production control flow · **MEDIUM (but load-bearing for trust)**
The "atrocious" pattern in its purest form: a harness can *force* or *observe* production behavior via `window` reads and counters inside the hot path.

- Force toggles read mid-logic: `__cairnDisableStackShared` OR'd into `controlledSurface` (`GpuImagePane.tsx:664`, `CpuImagePane.tsx:430,1111`); `__cairnDisableSyncResolve` (`plot-node.tsx:371-393`); `__cairnDisableCompareHomeReset` (`2304,2877`).
- Observe counters/tripwires in render: `leafResolveStats` (`plot-node.tsx:193-200,423,537`); `authoredColormapIsLut` (`716→1997`); `isPaintPhaseLog` + the 3-ref `contentEpoch` oracle (`523-526,2036-2113`).
- Instrumentation interleaved with the present: `pool.ts:649-735` present-fns end in ~15 lines of `displayFingerprint`/`sampleDeepColor`, plus test-only entry fields `paneId` (`332`) and `deepSampleTex` (`372`, freed `481`) threaded through the real lifecycle.
- Bug-signature oracles shipped as auto-armed library code: `test-hooks.ts:116-357` `isPipelineMismatch`/`isEncodingGenerationMismatch`/`isOrangeSuspect` — three one-clause riders on the same shape (`mode==='image' && !contentOpId && !hasSrcB`), each a fossil of one already-fixed flash.
- Test-pin duplication: the kernel→default-colormap table literal-pinned in **four** places (`kernel-default-colormap.test.ts`, `content-ops/registry.test.ts:65,78`, `compare-settings.test.ts:36`) though `registry-drift.test.ts:73` already proves it is derived.

---

## 2. Target architecture

Named owners. Each makes an entire patch class **unrepresentable**. Everything builds on the three primitives the tree already has: **`RenderSnapshot`** (the pure per-commit struct), **the registries** (kernels / content-ops / display-encoding), and **the viewport-owned-settings** ruling.

### 2.1 The Pool owns *applied* binding identity and retention
`PaneHandle.setSource(key)` / `setSourceB(key)` record the key; the pool exposes `pool.appliedPrimaryId`, `pool.appliedBId`, a monotonic `pool.revision` bumped on *any* bind, and `pool.getRetainedUpload(key)`.

- `render-snapshot.ts` already owns the **expected** side (`primaryId`/`bId`). The pool now owns the **applied** side symmetrically — `sourcesApplied` is computed from `pool.appliedPrimaryId === snapshot.primaryId`, defined once each instead of expected-once / applied-six-times.
- **Kills:** `appliedPrimaryIdRef`/`appliedBIdRef` + 6 stamps; the 5 `*Version` counters (→ `poolRevision`); `uploadCacheRef` + its LRU; the `hdrEngaged` ref-twin (expose via handle or plain state).

### 2.2 One `PaneSettings` value with declared per-field SCOPE
A single typed settings value with one serialize/deserialize, and each field tagged `shared-look` | `diff-only` | `live-only`. The bus applies scope *generically*.

- Encoding becomes a **tagged value** `encoding: { id, face }` — the diff-face tag physically cannot separate from its id, so a plain `{...prev, ...patch}` spread merges correctly.
- Legacy shapes normalized **once at the bus boundary** (`normalizeSettingsPatch`: `{colormap,tonemap}→encoding`, `viridis→turbo`, `side→split`). Downstream sees only canonical `encoding`.
- **Kills:** `applyRemoteSettings`/`settingsSnapshot` field mirroring; `EPHEMERAL_KEYS` denylist + comment; the 3-branch `compareMode` reconcile; the three scoping guards (`adoptRemoteDisplayEncoding`, `patch.norm` ignore, `encoding===undefined` kernel guard); the alias cascades; the two-patch publish in `changeDiffKernel`.

### 2.3 `useSurfaceSettings(mode: Controlled | Owned)` — one seam for the derive/own fork
Seeding policy becomes a first-class object selected **once**, driving *all* display fields through one code path. `Controlled` derives from props; `Owned` seeds once via a lazy initializer and persists.

- **Kills:** every `if (controlledSurface) setX(...)` (5–7 sites × 3 panes); `display-encoding.ts` render-time reseed + both tracking refs + the render↔effect protocol; `initialEncSeedRef` (once-only lives in the initializer); `__cairnDisableStackShared` (surface mode is an injected prop, not a `window` read).

### 2.4 `EncodingState` as an explicit sum, `kind` in the registry entry
`type EncodingState = { kind: 'default' } | { kind: 'picked', id }`. `overridden` becomes `state.kind === 'picked'` — a fact the value carries, not a bit synced beside it. `isIdentityTransfer` (`kind:'clamp'`) moves into the **display-encoding registry entry**.

- **Kills:** `overridden` ∥ `encodingModified` dual booleans; `NONE_GRAY_CURVES` hardcoded set (read off the active encoding); `viridis` alias at three sites → one.

### 2.5 One render scheduler; exhaustive `mode` dispatch
Compute `(renderKey, phase)` once — `phase = snapshot.resident && isFlip ? 'layout' : 'post'` — and dispatch in a **single** effect of the matching type, deduping on `renderKey` internally. `renderPass` dispatches on the exhaustive `mode` enum (`image | diff | compositor`) with **no shared tail**.

- `contentOpId` returns `null` for unknown ids (no `0`/IDENTITY collision); `resolvedKernelId` becomes a branded/validated type that cannot be transiently invalid. `refDims` folds into `snapshot.resident`.
- **Kills:** the two racing effects + `lastRenderedRef`/`lastContentIdentityRef`; `opId===0` and `absolute`-kernel floors; `hasCompare`/`refDims` floors; `compareIntended` tag.

### 2.6 `ResolvedLeaf` discriminated union, cache as a subscribable store
The resolve-cache exposes `subscribe`; LeafView reads via `useSyncExternalStore` (or `use()` the cached promise), so the resolved value is a **pure function of `resolveKey`**. The payload is typed: `type ResolvedLeaf = { kind:'single', source } | { kind:'diff', reference, foreground, keys }`.

- One `resolvableFor(node): { key, resolve }` shared by GridView prefetch **and** LeafView, guaranteeing the warmed key equals the read key. One `loweredRenderer(node)` shared by `stackKindKey` and `NodeDispatch`.
- **Kills:** LeafView lagging `state` cell; `resolvedNow ?? … / staleDiffFallback`; `__diffB` sentinel + the diff-HOLD branch; the `__`-prefixed side channel + casts; `leafResolveStats`; `__cairnDisableSyncResolve` (the sync read is the only path, nothing to toggle); the prefetch/read key-derivation drift.

### 2.7 The stack owner (GridView) owns all cross-slot state
Because a mixed `[image, diff]` stack flips through **one reused pane**, everything the slots currently guess or imitate is really *stack-level* state:

- **Chrome shell:** decide the stack's chrome shape once as the max over children's chrome; hand each slot that fixed skeleton. Kills `reserveOnly`/`reserveCompareChrome` (7 sites) + `StackHasCompareContext` + the `!stackHasCompare` menu suppressions.
- **Compare control:** a slot-scoped `Map<compareNodeId, CompareControl>` owned by the stack; `NodeDispatch` reads it only for compare nodes. Kills `useCompareControl` running (and defaulting) for plots/grids.
- **Aspect:** committed state set once on stack entry (a reducer), not `stackAspectRef` written during render.
- **mode/active reconciliation:** a reducer keyed to `children` identity (store `active` as the child's stable id, not an index). Kills the `effectiveMode`/`clampedActive` lag clamps.

### 2.8 Pool teardown split from bookkeeping; one failure policy; observer seam
- `freeGpuResources(entry)` is idempotent and never consults `parked`; `parked` becomes a derived readout of `surface === null`. Kills the four `entry.parked = false` pokes.
- `submit(params): boolean` converts both throw and false into one `engineFailed` transition. Kills the four copy-pasted `try/catch` blocks.
- Device reduction methods become **non-optional** (default readback mixin inside the Device impl). Kills the dead capability `else` arms; leaves the *one* legitimate mapping fork. `resolveMapping(dimsA, dimsB, mapping?)` owns the `top-left/crop/b` default at one site. Backing size becomes a required precondition of `activateEntry` (render is a no-op until first `resize()`), killing the `|| source.width || …|| 1` floor.
- **Observer seam:** the pool emits one `notifyPresent(entry, boundTexture, params)` with a no-op default listener; `displayFingerprint`, record assembly, the deep-color sample pass, `paneId`, `deepSampleTex`, and the bug-signature oracles move to `test-hooks.ts`, armed only on demand. `scalarMode` becomes one enum field. A single shared test-hooks runtime chunk kills the triplication + longest-ring heuristic.

### 2.9 Split the HDR/SDR union at the boundary
`GpuImagePane` becomes a thin discriminator that renders one of two typed bodies (`HdrImagePane` / `SdrImagePane`), *or* normalizes props into one internal source struct up front. Kills the per-line `hdrMode ? … : …` dep ternaries, the `as HdrImageProps` casts, and the three parallel upload effects.

---

## 3. Phased migration plan

Ordering is **dependency-first**: owners before the consumers that shed shadows. Each phase is independently shippable and green. Effort in engineer-days.

| Phase | Scope | Owner introduced | Deletes | Est. | Protected by |
|---|---|---|---|---|---|
| **0 — Boundary normalization** (pure refactor, behavior-identical) | `normalizeSettingsPatch`, `resolveMapping()`, `scalarMode` enum, `isIdentityTransfer` into registry, one shared test-hooks chunk, `KERNEL_DEFAULTS` fixture | (helpers, no state) | alias cascades → 1; mapping default ×5 → 1; scalarMode ×2 → 1; longest-ring heuristic | **1–2 d** | `registry-drift.test.ts`, `kernel-default-colormap.test.ts`, `compare-settings.test.ts` (unchanged — pure refactor) |
| **1 — Pool owns binding & teardown** | `pool.appliedPrimaryId/appliedBId`, `pool.revision`, `getRetainedUpload`, `freeGpuResources`, `submit()`, non-optional Device reduction | **Pool** | applied refs + 6 stamps; 5 `*Version` counters; `uploadCacheRef`; 4 parked-pokes; 4 try/catch; dead else-arms; backing-size floor | **3–4 d** | `RenderSnapshot` present-gate invariant (already central), pane-render-log oracles, browser flip-storm + engine metrics tests |
| **2 — Settings ownership** | `PaneSettings` value + scoped (de)serializer; tagged `encoding {id,face}`; `EncodingState` sum; `useSurfaceSettings(Controlled\|Owned)` | **PaneSettings / encoding registry** | publish/adopt mirroring; `EPHEMERAL_KEYS`; `compareMode` reconcile; 3 scope guards; per-field forks ×(5–7)×3; render-time reseed + refs; `initialEncSeedRef`; `overridden`∥`encodingModified`; `NONE_GRAY_CURVES`; `hasKernelOwner` dual path | **4–5 d** | `compare-settings.test.ts`, orange-frame oracle (`isOrangeSuspect`), M2/M3 replay pins |
| **3 — Render dispatch & scheduler** | one scheduler `(renderKey, phase)`; exhaustive `mode` dispatch; `contentOpId → null`; branded kernel id | **RenderSnapshot (extended)** | two-effect race + dedupe refs; `opId===0` + `absolute` floors; `hasCompare`/`refDims` floors; `compareIntended` | **3–4 d** | `RenderSnapshot`, paint-phase log, `isPipelineMismatch` oracle, flip browser tests |
| **4 — Stack & LeafView ownership** | `ResolvedLeaf` union + subscribable resolve-cache; stack-owned chrome skeleton + `CompareControl` map + aspect reducer + children reconcile; `loweredRenderer()`, `resolvableFor()` | **GridView (stack owner) / resolve-cache** | LeafView `state` cell + `staleDiffFallback`; `__diffB` sentinel + hold; `__`-side-channel; `useCompareControl`-everywhere; `reserveOnly` ×7 + `StackHasCompareContext`; `stackAspectRef`; lag clamps; prefetch/read drift; `leafResolveStats`; `__cairnDisableSyncResolve` | **4–5 d** | `leafResolveStats` (kept as assert-zero until end of phase), flip-storm + chrome-stability browser tests |
| **5 — dtype split & oracle retirement** | HDR/SDR pane bodies (or normalized internal struct); `notifyPresent` observer seam; move all bug-signature oracles + `paneId`/`deepSampleTex` to harness | **(finalization)** | union dep ternaries + `as` casts + 3 parallel upload effects; instrumentation in hot path; test-only entry fields; `__cairnDisable*` toggles; auto-armed oracle predicates | **2–3 d** | whole suite green; oracles assert-zero, *then* deleted (their target states are now unrepresentable) |

**Total: ~17–23 engineer-days.**

**Harness note.** Several inventory items (`leafResolveStats`, `isPipelineMismatch`/`isOrangeSuspect`, the paint-phase `contentEpoch` refs) are *both* patch and safety net. The plan keeps each as an assert-zero regression guard *through* the phase that makes its target state unrepresentable, then deletes it in that phase's cleanup — never before. `render-snapshot.ts` is the template and stays untouched except to grow the pool-owned `applied` side (Phase 1) and the scheduler key (Phase 3).

---

## 4. What gets DELETED

Net effect: the four symptom-shapes stop being *expressible*.

**State cells / refs (Class 1):** `appliedPrimaryIdRef`, `appliedBIdRef` + 6 stamp sites · `uploadVersion`, `refUploadVersion`, `pixelDataVersion`, `diffOverlayVersion`, `containerTick` (→ one `poolRevision`) · `hdrEngaged` ref-twin · `localKernel` fallback store · `initialEncSeedRef` · `contentEpochRef`/`contentEpochIdentityRef`/`lastCommitEpochRef` · `uploadCacheRef` + LRU · LeafView `state` cell · `overridden` boolean · `stackAspectRef` · `paneId`/`deepSampleTex` entry fields.

**Branches / floors / forks (Classes 2–4):** every `if (controlledSurface) setX(...)` (encoding/peak/gamma/bounds ×3 panes) · `display-encoding` render-time reseed + 2 tracking refs · `opId===0` floor · `getDiffKernel?…:'absolute'` floor · `hasCompare` + two `refDims` floors · the two-effect scheduler + `lastRenderedRef` · `EPHEMERAL_KEYS` delete-loop · the `compareMode` 3-branch reconcile · the three `applyRemoteSettings` scope guards · `NONE_GRAY_CURVES` set · `'side'→'split'` inline alias · alias cascades collapsed to boundary normalization · four `try/catch → setEngineFailed` · four `entry.parked = false` pokes + `parkEntry`'s fast-exit · dead device-capability `else` arms · `backingWidth || … || 1` floor · `mapping ?? computeCompareMapping(…)` ×5 · `scalarMode` ternary ×2 · `hasKernelOwner` owner-vs-local branches · `reserveOnly`/`renderCompareChrome` + `|| reserveOnly` at ~7 sites + `StackHasCompareContext` · `useCompareControl` defaulting for plot/grid · `effectiveMode`/`clampedActive` lag clamps · union `hdrMode ? … : …` dep ternaries + `as HdrImageProps` casts + 3 parallel upload effects.

**Test scaffolding out of the hot path (Class 5):** `__cairnDisableStackShared`, `__cairnDisableSyncResolve`, `__cairnDisableCompareHomeReset` reads · `leafResolveStats` counters · `authoredColormapIsLut` tripwire · `isPaintPhaseLog`/`recordPaintPhase` weaving · `displayFingerprint`/`sampleDeepColor` inline present instrumentation · auto-armed `isPipelineMismatch`/`isEncodingGenerationMismatch`/`isOrangeSuspect` (→ harness, one shared `isPlainIdentityPresent` concept) · longest-ring reconciliation heuristic · the 4-way kernel→default-colormap test-pin (→ one `KERNEL_DEFAULTS` fixture).

**Kept, untouched, as the model:** `renderers/render-snapshot.ts` — the one place the scattered guards were already consolidated into a pure struct. The whole proposal is finishing that pattern everywhere else.

---

## 5. Cleanup wave (2026-08-24) — the three deferred rulings, IMPLEMENTED on `main`

The three items the structure-refactor shifts kept deferring as user-visible were RULED and implemented on `main` as staged, independently-green commits (each gated: typecheck · node 661 · harness `--all` on BOTH hardware-Metal and `HARNESS_FORCE_STRATEGY=swiftshader`, 35/39 = the same 4 known headless-gesture fails, no new; smoke:js 5/5; pytest 250; bundles synced).

- **COLD SWAP → brief loading state is acceptable — IMPLEMENTED** (`6c8a53b`). The leaf resolve-cache is now a **subscribable external store** (`subscribeResolveCache` + `resolveCacheVersion`); `LeafView` reads its resolved value via `useSyncExternalStore`, **purely from the cache keyed by the current `resolveKey`** — no component `state` cell. A warm/prefetched flip resolves synchronously in the flip commit (instant, unchanged); a cold swap renders a brief `"Loading…"` instead of holding the previous frame. RETIRES: the LeafView `state` hold cell, `staleDiffFallback`, the `__diffB===undefined` diff-HOLD branch, `staleDiffHolds` (its target is now unrepresentable), `__cairnDisableSyncResolve`. The stale-diff / reference-flash window is unrepresentable, not guarded (the leaf only builds a `compareSource` from a RESOLVED diff pair — `b` is never undefined). `placeholderMounts` stays as the warm-flip no-flash oracle.
- **RESEED TIMING → unify to post-commit — IMPLEMENTED** (`b5cafb8`). The encoding's controlled-surface reseed moved from the render body onto a post-commit `useEffect` — ONE documented adoption timing for every `toolbar={false}` controlled prop (matching peak/gamma/bounds). The one-frame trail on host-driven changes is accepted; interactive viewports are unchanged (the render-body prop-change *stamp* stays a pure record).
- **SIZE FLOOR → require `resize()` before first render — IMPLEMENTED** (`46247df`). The `backingWidth || source.width || deep.width || 1` floor is deleted; `activateEntry` defers until measured and `renderPass` holds (blank) until the container has a real box. Pane contract is measure-then-render (documented at `PaneHandle.render`/`resize`/`backingWidth`).

**No-ruling residue:** the kernel→default-colormap literal pins were consolidated into ONE table-driven test (`6ca9241`) asserting every surface (kernel `defaultColormap`, `kernelDefaultColormap`, `resolveDiffColormap(id,null)`, content-op `defaultEncoding`) against the single table; `content-ops/registry.test.ts` drops its duplicate literals. `staleDiffHolds`/`__cairnDisableSyncResolve` retired with the COLD-SWAP item (retirement rule). The vestigial `overridden` delete was **NOT applied on `main`** — unlike the structure-refactor branch, `overridden` still has live consumers here (the diff-colormap derivation `enc.overridden ? enc.colormap : diffDefaultColormap`), so it is not vestigial on `main`; it is retired only where its consumers are already gone (structure-refactor). The stacked-diff-flip harness-runtime rationalization was deferred (a runtime optimization, not a ruling).

---

## 6. Settings model — SIMPLIFIED to the user's four-sentence spec (2026-08-24)

The Class-2 "Settings ownership" machinery above was superseded by a direct
implementation of the user's spec, which is now the ENTIRE settings model:

> Each viewport has a set of settings. When we select multiple, we sync the
> settings of the FIRST viewport to the others. There should just be an interface
> on the viewport that sets the settings and applies them. When double clicking
> (HOME), we take the default settings for the image/diff and apply those to the
> viewport.

Standing rulings that shape it: (1) a viewport owns ONE concrete settings set —
the full display vocabulary (encoding/colormap, curve, EV, offset, gamma, peak,
reduce, bounds, diff kernel, compare mode, split/blend); (2) ONE interface on the
pane sets state and renders (`applyRemoteSettings` on apply, `publishSettings` on
local change — the mirror bus); (3) FORMATION-COPY: on multi-select the FIRST
(anchor) viewport's CURRENT values are published to the others; (4) MIRRORING:
while selected, any change on one applies to all others BY VALUE; (5)
APPLICABILITY is decided at RENDER (arity gating), NOT at sync — a value that
doesn't apply to a pane's current content is stored and simply doesn't alter that
render; (6) HOME applies the visible image/diff's DEFAULTS to the CLICKED viewport
only (local, never mirrors); (7) the enlarge/fullscreen stage's cells are a
selection, so formation-copy + mirroring work there identically.

**Interface (unchanged shape, simplified body).** `image-settings-sync.ts` is a
flat bus: `publishImageSettings` does a plain `{...prev, ...patch}` merge into the
per-group snapshot and broadcasts; `subscribeImageSettings` mirrors every patch to
peers (echo-guarded by `sourceId`); `getLastImageSettings` seeds a late joiner.
Each pane's `applyRemoteSettings(patch)` adopts every field it owns by value; its
`settingsSnapshot()` is the anchor's formation seed. HOME stays on the pane's own
reset chain (`assignVisibleFaceDefaultEncoding` / `useCompareControl.reset`).

**DELETED machinery (this obsoletes the Class-2 plan's `PaneSettings`/tagged-encoding design):**

- `renderers/image-display-encoding-sync.ts` — the whole shared scoping module
  (`shouldAdoptDisplayEncoding` / `adoptRemoteDisplayEncoding` / `diffFaceTag`) and
  its test. Adoption is now unconditional-by-value inlined in the three panes.
- `viewport/image-settings-sync.ts` — `EPHEMERAL_KEYS` (the diff-kernel denylist),
  `SCOPED_DISPLAY_KEYS`, and the 3-branch mode-aware `compareMode` FACE-TAG
  reconcile (~60 lines). The merge is a plain flat spread; `compareMode` is just
  the real composite mode, not a tag.
- The **dedicated-kernel-pick shape**: `changeDiffKernel` published two patches
  (`{diffKernel}` then the display keys) so the M2 guard could keep distinct
  kernels; it now publishes ONE by-value patch and the diff `settingsSnapshot`
  carries `diffKernel`, so formation mirrors the first viewport's kernel (ruling 3).
- The receiver guards `patch.encoding === undefined` (in `useCompareControl` and the
  pane's local-kernel fallback) — the kernel is adopted by value whenever present.

**Harness expectation changes (each justified against the spec):**

- `stacked-diff-flip-realstack-gpu.browser.ts` PHASE A / PHASE C(3): the
  "a diff peer's scalar colormap is NOT adopted by a plain image (orange=0)"
  oracles are RETIRED and inverted — under ruling 5 the image adopts the first
  viewport's colormap by value and the GPU path false-colors it (orange > 0).
- Same harness PHASE K / PHASE L: the "distinct-kernel diffs do NOT collapse on
  formation" / "seed OMITS diffKernel" oracles are inverted — the anchor seed now
  CARRIES the kernel and every peer adopts it (ruling 3); an explicit pick still
  mirrors (ruling 4).
- `image-settings-sync.test.ts`: the `EPHEMERAL diffKernel` and four M3
  mode-aware-tag tests are replaced by flat-merge tests (kernel persists; a later
  colormap overwrites its field but leaves other keys — incl. `compareMode` —
  intact; no scoping).

The enlarge-stage sync the user reported broken is fixed by the SAME deletion: the
stage's cells already share one settings group, and removing the scoping/ephemeral
guards restores unconditional live mirroring across them (no stage code change).

---

*Anthropic Cairn — cairn-plot structural proposal. §5 records the 2026-08-24 cleanup wave (rulings implemented on `main`). §6 records the settings-model simplification to the user's four-sentence spec.*
