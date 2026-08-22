# Structure Refactor — Execution Report

**Date:** 2026-08-23
**Branch:** `structure-refactor` (forked from `diff_unification` @ `cea027e`)
**Spec:** [`2026-08-22-structure-proposal.md`](./2026-08-22-structure-proposal.md)
**Baseline (`diff_unification`):** UNTOUCHED, still `cea027e`.

Behavior-preserving throughout. Full gate suite green at every commit
(typecheck 0 · unit 661 · harness 33, byte-pins + WebGPU parity + paint-atomic
flip incl. · pytest 260 · bundles rebuilt & in sync).

---

## Phases landed

| Commit | Phase | What it made unrepresentable |
|---|---|---|
| `7147262` | **P0 — boundary normalization** | three duplicated derivations → one owner each |
| `199713d` | **P1a — pool owns teardown** | `parked`/`surface` twin state |
| `719cb54` | **P1b — Device reduction required** | the dead "device without GPU reduction" capability |

Each deletion below is traced to *why* it became unnecessary (owner
established / state unrepresentable), never merely relocated.

### P0 — `7147262`
- **scalarMode ternary ×2 → 1.** `scalarModeFor(params)` (image-engine.ts) is the
  single resolver of the 4-way analytic/grayNone/turbo path. The render pass and
  the pool's display fingerprint call it; they can no longer disagree.
- **compare-mapping default ×5 → 1.** `resolveMapping(a,b,mapping?)`
  (compare-align.ts) owns the legacy `top-left/crop/b` default the four
  diff-engine sites + one image-engine metric site copy-pasted. The
  content-keyed diff cache only coheres while they agree byte-for-byte — now
  structural, not convention.
- **viridis→turbo alias ×3 → 1.** The inline `=== "viridis" ? "turbo"` at
  display-encoding.ts (2) + GpuImagePane.tsx (1) now call the single
  `aliasColormap` owner (the same `COLORMAP_ALIASES` table the LUT lookups use).

### P1a — `199713d`
- **Deleted the `parked` field.** A pane is parked **exactly when
  `entry.surface === null`** — one owner, derived at every read. `isParked` and
  all internal guards read `surface`.
- **`parkEntry` → `freeGpuResources`,** idempotent by construction (every field
  nulled after release; `untrack` no-ops when absent) ⇒ its `if (entry.parked)
  return` guard is gone ⇒ the **four `entry.parked = false` catch-handler pokes**
  that existed only to defeat that guard are deleted.
- **Five `if (!entry.parked && entry.surface)` → `if (entry.surface)`** (the
  `!parked` conjunct was always implied by a non-null surface); the deep-window
  guard drops its redundant `!parked`.

### P1b — `719cb54`
- **`Device.reduceDiffSumSquaredAbs` / `reduceTextureChannelMean` are now
  REQUIRED.** The one concrete Device (webgpu) implements both; `reduce.browser`
  *fails* a device lacking them; the one test double is `{} as unknown as Device`
  (cast-bypassed). The optional-ness was a type-level fiction.
- **diff-engine `reduceSsimMean`:** the `else { readback + CPU loop }` was pure
  dead capability fallback (no mapping fork) — collapsed to the GPU path.
  `meanSsimFromErrorMap` stays exported as the harness parity reference.
- **image-engine `computeMetrics`:** `if (isDefault && device.reduceDiffSumSquaredAbs)`
  → `if (isDefault)`. Only the capability conjunct was dead; the else arm is the
  **legitimate** non-default-mapping (offset/fill) CPU path and is preserved —
  the "fused with the one legitimate fork" case the proposal flagged.

---

## Accounting (grep counts, 12 spec-touched files)

| metric | baseline | final | Δ |
|---|---|---|---|
| `if` | 429 | 426 | **−3** |
| ternary (approx `?`) | 336 | 330 | **−6** |
| LOC | 10116 | 10111 | **−5** |

The raw `if` delta understates the change: the load-bearing wins are a **deleted
state field** (`parked`), **four deleted pokes**, a deleted idempotency guard,
**two de-optionalized capabilities** with their dead branches, and **three
N-copy derivations reduced to one owner**. LOC is near-flat because each
consolidation adds a small documented owner in exchange for deleting scattered
duplicates. Module count unchanged (no new files except this report + the
`scripts/refactor-metrics.sh` accounting helper) — indirection was treated as a
cost.

---

## Human-readability summary — what a reader now finds where

- **"Is this pane live or parked?"** — one answer: `entry.surface`. There is no
  second boolean to consult or keep in sync, and no teardown path that can leave
  the two disagreeing. `freeGpuResources` is the one idempotent teardown.
- **"What's the scalar color path / the compare mapping / the colormap alias?"**
  — one function each (`scalarModeFor`, `resolveMapping`, `aliasColormap`),
  named at the definition, called at the use. No reader re-derives its own copy.
- **"Does the engine handle a device without GPU reduction?"** — no; it *can't*
  have one. The reduction methods are required, so the metrics/SSIM code reads
  as a straight-line GPU path with exactly one honest fork (default vs. mapped),
  not a capability maze.
- The **`render-snapshot.ts` template is untouched**, as instructed — it remains
  the model the rest of the tree is being pulled toward.

---

## Stopped-on items (each needs a decision I was instructed not to make)

1. **Pool-owned applied binding identity (spec §2.1) — the pane's
   `appliedPrimaryIdRef`/`appliedBIdRef` twin + its 6 stamps.**
   The pane stores *synthetic* expected-vs-applied tags (`"hdr"`, `"deep"`,
   `img:${url}`, `A:${contentKey}`, `B:${key}`) that must equal
   `snapshot.primaryId`. A pool-owned `appliedPrimaryId` only replaces this if it
   lives in the **same id namespace** as `render-snapshot`'s expected side.
   **Open question:** what is that shared namespace — does the pool learn the
   pane's tag scheme (leaks pane concepts into the pool), or does
   `render-snapshot` re-express `primaryId` in terms of the pool's bind keys?
   This is a design decision governing the paint-atomic present gate (user-visible
   flash if wrong); it must be made before the refs can move. *Net:* NOT a
   mechanical extraction; deferred whole.

2. **The 5 `*Version` counters → one `poolRevision` (spec §2.1).** Depends on
   (1)'s pool-revision owner and is woven into the render-effect dependency
   arrays. **Open question:** which of the five bumps are semantically distinct
   (do any consumers need to distinguish "upload landed" from "overlay landed"),
   or is a single monotonic revision truly equivalent for every reader?

3. **`uploadCacheRef` hand-rolled LRU → `pool.getRetainedUpload(key)` (§2.1).**
   Needs the pool to expose retained decoded uploads. **Open question:** the
   pane's LRU cap and the pool's `MAX_RETAINED_SOURCE_TEXTURES` are currently
   independent numbers kept "bounded to the pool's cap" by hand — are they meant
   to be the *same* budget (one cap) or two?

4. **Backing-size floor `backingWidth || source.width || deep.width || 1` →
   required precondition (§2.8).** The proposal wants render to be a **no-op
   until first `resize()`**. That is a **user-visible behavior change** (today a
   render requested before the container is measured falls back to source dims
   and paints). STOP rule applies. **Open question:** is a blank frame before
   first measure acceptable, or must the source-dims fallback stay?

5. **The four pane `try/catch → setEngineFailed(true)` → `pool.submit(): boolean`
   (§2.8).** The pool's render methods already never throw (return `false`), so
   the pane catches are largely defensive. **Open question:** which of the pane's
   wrapped calls can *actually* throw (e.g. `acquirePane` rejection vs. a render
   call) — the unification is only safe once that set is enumerated, so the
   `false`-return and the `throw` truly fold into one transition.

6. **`normalizeSettingsPatch` at the bus boundary (§2.2, P2).** Deliberately NOT
   introduced in P0: wiring it at 0 sites would violate the "≥2 patches" rule.
   It is the correct P2 entry point (the `encoding ?? colormap ?? tonemap`
   cascade is already single-source in `image-display-encoding-sync.ts`, so P0
   had nothing to collapse there).

7. **One shared test-hooks runtime chunk → kills the longest-ring heuristic
   (§0/P0).** Requires a **Vite chunk-splitting change** so the three inlined
   bundles share one `test-hooks` instance. Risky against the byte-pinned harness
   bundles; deferred. **Open question:** can a shared chunk be introduced without
   changing the committed bundle bytes the harness pins?

8. **`NONE_GRAY_CURVES` hardcoded set / `hasKernelOwner` dual store (§2.4/§2.1).**
   Both need the P2/P3 registry + kernel-owner ownership introduced first
   (`NONE_GRAY_CURVES` should be read off the active encoding registry entry;
   `hasKernelOwner` should always resolve to an owner, defaulting one for the
   ownerless caller). Not safe as isolated edits.

9. **`isIdentityTransfer` into the registry / `KERNEL_DEFAULTS` fixture (§2.4/P0).**
   Already absorbed in this baseline: `isIdentityTransfer` does not exist in the
   tree, and the kernel→default-colormap table is already *derived*
   (`registry-drift` proves it) with only one literal pin remaining — below the
   ≥2-patch threshold for a new fixture module.

---

## Remaining phases (not started)

- **P1 (remainder)** — items 1–5 above (pool-owned applied id, `poolRevision`,
  `getRetainedUpload`, backing precondition, `submit()`).
- **P2 — settings ownership** — one `PaneSettings` value with scoped
  (de)serializer; tagged `encoding {id,face}`; `EncodingState` sum;
  `useSurfaceSettings(Controlled|Owned)`. Deletes the per-field `controlledSurface`
  forks ×(5–7)×3, the publish/adopt mirroring, `EPHEMERAL_KEYS`, the `compareMode`
  reconcile, `overridden ∥ encodingModified`, `hasKernelOwner`. Entry point:
  `normalizeSettingsPatch` (item 6).
- **P3 — render dispatch & scheduler** — one `(renderKey, phase)` scheduler;
  exhaustive `mode` dispatch; `contentOpId → null` (kills the `opId===0` IDENTITY
  collision); branded kernel id. Deletes the two-effect race + dedupe refs and
  the `hasCompare`/`refDims`/`absolute` floors.
- **P4 — stack & LeafView ownership** — `ResolvedLeaf` union + subscribable
  resolve-cache; stack-owned chrome skeleton + `CompareControl` map + aspect
  reducer. Deletes `reserveOnly` ×7, `StackHasCompareContext`, `__diffB`
  sentinel, LeafView lag cell, `leafResolveStats`.
- **P5 — dtype split & oracle retirement** — HDR/SDR pane bodies; `notifyPresent`
  observer seam; move all bug-signature oracles + `paneId`/`deepSampleTex` to the
  harness; delete the `__cairnDisable*` toggles.

Per the oracle-retirement rule, the tripwires named in P3–P5 (`isPipelineMismatch`,
`isOrangeSuspect`, `leafResolveStats`, the paint-phase `contentEpoch` refs) remain
as assert-zero guards until the phase that makes their target state
unrepresentable — none were removed in this session.

---

*Anthropic Cairn — structure-refactor execution report.*
