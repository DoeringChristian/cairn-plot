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

---

# Shift 2 — P1 remainder + P2 down-payment

**Forked from** `f3114ea` (shift 1 HEAD). Behavior-preserving throughout; full
gate green at every commit (typecheck 0 · node 661 · **harness 33** — byte-pins +
WebGPU parity + paint-atomic flip incl., run headlessly on Apple Metal · pytest
260 · boundary OK · bundles rebuilt + synced + committed).

**Rule lens applied (coordinator clarification):** "STOP on semantics" = *user-
visible* only (pixels / presentation timing / UI semantics / descriptor
contracts). INTERNAL design contracts were decided here. Under that lens most of
shift 1's 9 stop-items unlocked; the one genuinely user-visible item stayed
stopped.

## Phases landed

| Commit | Phase | Stop-item | What it made unrepresentable |
|---|---|---|---|
| `0a8068d` | **P1c — pool owns applied binding identity** | 1 | the pane's `appliedPrimaryIdRef`/`appliedBIdRef` twin + its 6 stamps |
| `164d2b3` | **P1d — one `engineFailed` transition** | 5 | the three dead render `try/catch` blocks |
| `fcfbcd3` | **P1e — pool owns decoded-upload retention** | 3 | the pane's hand-rolled `uploadCacheRef` LRU |
| `6853ade` | **P2a — name the controlled/owned policy** | — | 6 hand-copied `if (controlledSurface) setX` reseed effects |

### The applied-id namespace (the naming contract I was asked to pick)

**Chosen:** the pane-authored logical-source token that `render-snapshot.ts`
*already* uses for the EXPECTED side — `A:<keyA>` / `B:<keyB>` (compare), `deep`,
`hdr`, `img:<url>` (single). The pool stores it **opaquely** (never parses or
branches on it) as `PaneEntry.appliedPrimaryId`/`appliedBId`, echoed via
`PaneHandle` getters; the applied id is now an ARGUMENT of the bind call, written
once, co-located with the GPU bind it describes.

**Why this, not "re-express `primaryId` in the pool's bind keys"** (shift 1's open
question): the pool's own retention keys are LOSSY for the present gate — the
single / HDR / deep paths all bind UNKEYED (`contentKey === undefined`), so the
pool cannot tell `hdr` from `img:<url>` from `deep` by its bind keys alone, yet
the gate must (an HDR→SDR flip has to hold until the SDR primary lands). So the
canonical id must be the pane's logical token (a superset carrying mode + url +
key). One namespace, one owner each side (`render-snapshot` = expected, pool =
applied), gate = `expected === applied`, and the paint-atomic gate's BEHAVIOR is
unchanged (still pinned by the flip-paint harness).

### Other internal contracts decided

- **`getRetainedUpload` / one budget (stop-item 3, open Q).** The decoded CPU
  bytes and the GPU texture for a key are the SAME retained entry → ONE cap (the
  pool's `MAX_RETAINED_SOURCE_TEXTURES`). Lifecycle matched to the deleted pane
  ref EXACTLY: `retainedUploads` survives park (re-decoding on a post-restore
  flip-back is the exact stale-frame gap it closes) and clears on dispose — so
  the flip-back-after-park path is byte-preserved.
- **`submit()` ownership (stop-item 5, open Q "which calls can throw").** None of
  the synchronous render calls can — `render`/`renderDiffCached` carry the
  documented NEVER-THROWS contract; only async `acquirePane` rejects (its
  `.catch` untouched). So the three `try/catch` throw-arms were unreachable dead
  code; collapsed to one local `submit(ok)`.

## Accounting (vs shift-1 HEAD `f3114ea`)

| file | if | loc | note |
|---|---|---|---|
| GpuImagePane.tsx | 114 → **108** | 2919 → 2894 | −2 refs, −3 try/catch, −1 LRU cb, −3 reseed effects |
| CpuImagePane.tsx | 61 → **60** | 1654 → 1664 | −3 reseed effects → hook calls |
| pool.ts | 68 → 72 | 1021 → 1108 | +2 owner fields, +1 map, +`getRetainedUpload`, +`retainUpload`; mostly owner docs |
| use-surface-settings.ts | — | +50 | new seam (mostly doc) |

`if`/LOC understate the change (as in shift 1): the load-bearing wins are
**3 deleted state cells** (`appliedPrimaryIdRef`, `appliedBIdRef`,
`uploadCacheRef`) + a deleted LRU callback, **6 hand-sync stamps** folded into 4
bind calls, **3 dead `try/catch`**, and **6 hand-copied reseed effects** → 1
named hook — each traded for a small documented OWNER in the pool / the seam.

## Human-readability summary

- **"Which source is bound in each slot?"** — one answer, the pool
  (`handle.appliedPrimaryId`/`appliedBId`), in the same namespace the frame's
  expected id uses. No pane-side twin to hand-sync; the present gate reads
  `expected === applied`.
- **"Where are decoded reference bytes retained?"** — the pool, under the same
  key + cap as the GPU texture. The pane no longer keeps a second LRU.
- **"Does a pool render call need a `try/catch`?"** — no; it can't throw. A falsy
  return is the whole failure signal, folded into one `submit`.
- **"Does this pane follow host props or own its settings?"** — asked once, at
  `useControlledReseed`; every field flows through it instead of re-deciding.

## Stopped / deferred (with reasons)

- **Stop-item 4 — backing-size floor → required precondition. STILL STOPPED
  (the one genuinely user-visible item).** Making render a no-op until first
  `resize()` risks a blank frame before the container is measured. Untouched.
- **Stop-item 2 — 5 `*Version` counters → one `poolRevision`. DEFERRED to P3
  (dependency-ordering, not a stop).** Verified in-tree: `uploadVersion` /
  `containerTick` are the exact inputs to the TWO racing render effects and their
  shared `lastRenderedRef` dedupe — the P3 scheduler target. The five bumps are
  also *semantically distinct* (open Q 2): `pixelDataVersion` drives the
  histogram, `diffOverlayVersion`/`refUploadVersion` the overlay/diff effects — a
  naive single revision over-fires them. The collapse is structural only once the
  single scheduler is rewritten (P3); doing it now would re-wire dep arrays P3
  immediately redoes. Left intact.
- **P2 remainder (the encoding seam).** `initialEncSeedRef`, the `EncodingState`
  sum (`overridden → kind:'picked'`), the `display-encoding.ts` render-time
  reseed + its two tracking refs, `NONE_GRAY_CURVES`, `hasKernelOwner`, and the
  `PaneSettings`/`normalizeSettingsPatch` serializer remain. These carry
  UI-semantics risk (per-field seed CONDITIONS differ) and want their own
  gate-heavy shift; P2a is the low-risk down-payment that names the policy.

## Remaining (unchanged from shift 1's plan, minus what landed)

- **P2 (remainder)** — encoding seam above; `PaneSettings` scoped (de)serializer;
  tagged `encoding {id,face}`; `hasKernelOwner` dual store.
- **P3 — render dispatch & scheduler** — one `(renderKey, phase)` scheduler
  (folds in stop-item 2's `poolRevision`); exhaustive `mode` dispatch;
  `contentOpId → null` (the `opId === 0` floor preserved verbatim in P1d awaits
  it); branded kernel id. Deletes the two racing effects + `lastRenderedRef`.
- **P4 / P5** — as shift 1's plan (stack/LeafView ownership; dtype split + oracle
  retirement). No oracles removed this shift (their target states are not yet
  unrepresentable).

---

# Shift 3 — P2 remainder: the encoding seam

**Forked from** `6758ebc` (shift-2 HEAD). Behavior-preserving throughout; full
gate green at every commit (typecheck 0 · node 661 · harness 36/40 via `--all` —
the same 4 gesture-only interaction harnesses fail HEADLESSLY at the untouched
baseline `6758ebc` and are held harmless; every parity + interaction harness that
settles headlessly, incl. flip-paint/stress/chrome/resolve, realstack-gpu,
compare-settings-sync, grid-stacked-persist, is PASS · pytest 260 · schema +
boundary OK · bundles rebuilt + synced + committed).

## Phases landed

| Commit | Phase | Stop-item | What it made unrepresentable |
|---|---|---|---|
| `99f7d56` | **P2f-1 — EncodingState sum** | P2 §2.4 | the `encodingId` ∥ `overridden` hand-synced twin cell |
| `a3dc024` | **P2f-2 — fold `initialEncSeedRef`** | P2 §2.3 | the pane-side once-only encoding-seed ref (a 2nd home for the owned-seed policy) |

### P2f-1 — `99f7d56` (EncodingState sum)
`usePaneEncoding` held the active id and the picked-vs-default bit as TWO
`useState`s set together by hand — a Class-1 twin that drifts if a writer touches
one and not the other. Replaced by ONE `EncodingState = { id, kind:
"default"|"picked" }` cell; `encodingId`/`overridden` are derived read-views
(`overridden = kind === "picked"`). The three writers (controlled reseed,
`setEncoding`, `resetEncoding`) each move the whole struct; the arity-flip
functional update preserves `kind` (an override survives a channel flip, exactly
as before). Behavior-identical. `encodingModified` (value ≠ seed) stays the
distinct derived boolean it always was. **Finding:** `overridden` has NO in-tree
consumer left — a shift-1/2-era decision (`effectiveDiffColormap = enc.colormap`)
retired it; it is kept as a derived output per the spec's diff-face contract
(cheap, and P4/P5 diff-face work may re-consume it) rather than sum-typed then
read by no one.

### P2f-2 — `a3dc024` (fold `initialEncSeedRef`)
The owned viewport's seed COLORMAP was frozen by a pane-side ref in
`GpuImagePane` and fed back into the hook — a second home for the "Owned seeds
once" policy (spec §2.3). The freeze moved INTO the hook as a `freezeSeedColormap`
config byte: it captures the aliased seed colormap once and reuses it for every
`seedFor` (initial state, HOME, `encodingModified`). GpuImagePane now passes the
LIVE initially-visible-face expression and lets the hook own the freeze
(behavior-identical — same first-render capture). The `if
(initialEncSeedRef.current == null)` guard did not vanish; it RELOCATED into the
hook's `if (config.freezeSeedColormap && seedColormapRef.current === null)` — one
owner (traced if-move, pane −1 / hook +1).

## Accounting (vs shift-2 HEAD `6758ebc`)

| file | if | loc | note |
|---|---|---|---|
| display-encoding.ts | 13 → **14** | 434 → 476 | +1 owned-freeze capture; +42 LOC = the `EncodingState` type + doc |
| GpuImagePane.tsx | 108 → **107** | 2894 → 2894 | −1 (`initialEncSeedRef` guard); LOC flat |

Net `if` across the shift: **0** (one guard relocated pane→hook). LOC **+42**, all
type declaration + documentation. As in shifts 1–2 the counts understate: the
load-bearing wins are **−1 state cell** (`overridden` `useState`), **−3
hand-synced setter pairs → 3 single struct moves**, and **−1 pane-side ref**
(`initialEncSeedRef`) with its policy centralized in the hook.

## Human-readability summary
- **"Has the user picked this encoding, or is it the default?"** — one cell
  answers: `EncodingState.kind`. There is no separate boolean to keep in sync;
  every writer moves the whole value.
- **"Where is the owned viewport's seed frozen?"** — the hook (`usePaneEncoding`),
  once, via `freezeSeedColormap`. No pane keeps its own seed ref.

## Stopped / deferred (with reasons)

- **Render-time reseed → `useControlledReseed` — PER-FIELD STOP (timing).** The
  encoding's controlled reseed runs DURING RENDER (the supported adjust-state-in-
  render pattern) so the committed frame carries it with no one-frame lag;
  `useControlledReseed` is a post-commit `useEffect` (peak/γ/bounds tolerate the
  lag, encoding does not — documented at the reseed site). Folding it in would
  either flash the encoding or force render-time timing on peak/γ/bounds — a
  user-visible change the guardrail forbids. It also structurally belongs to the
  state OWNER (`usePaneEncoding` owns `encState`), not the call-site seam. Left in
  the hook.
- **CpuImagePane's owned seed stays LIVE while GpuImagePane's freezes — preserved
  as DATA, not unified.** CpuImagePane omits `freezeSeedColormap`; its
  `encodingModified`/HOME intentionally track the live descriptor colormap. The
  divergence is encoded as the policy byte per the guardrail ("encode them as
  data, don't unify their timing"), not forced to one timing.
- **`PaneSettings`/`normalizeSettingsPatch` (§2.2) — NOT a boring win right now.**
  The incoming legacy normalization is ALREADY single-source
  (`image-display-encoding-sync.ts`: the `encoding ?? colormap ?? tonemap`
  cascade + the orange-frame `isDiffFace` scoping + the face tag), and
  `viridis→turbo` is already the one `aliasColormap` owner. A `normalizeSettingsPatch`
  wrapper over already-single-source code would add indirection without deleting
  duplication (violating the ≥2-patch / boring-code rule). The remaining
  unification — a per-pane field-SCOPE `PaneSettings` (de)serializer over the
  UNCONDITIONAL fields — is a genuine design shift (the panes have different
  capability sets: Gpu has exposure/peak, Cpu-SDR does not), with the
  UI-semantics risk shift-2 flagged. Its own shift.
- **`NONE_GRAY_CURVES` off the registry / `hasKernelOwner` dual store.** Unchanged
  from shift-2's assessment: `NONE_GRAY_CURVES` has ONE consumer (below the
  ≥2-patch threshold for a new registry flag); `hasKernelOwner` needs the
  kernel-owner ownership P3 introduces. Neither is a safe isolated edit.

## P3 — assessed, NOT attempted this shift (design + why)

**Scheduler design (two sentences).** Compute `(renderKey, phase)` once —
`phase = snapshot.resident && isFlip ? "layout" : "post"` — keep both hook slots
(a `useLayoutEffect` and a `useEffect`, since React cannot pick the effect type at
runtime) but drive BOTH from one owner that dedupes on `renderKey` internally,
replacing the two effects' shared `lastRenderedRef`/`alreadyRendered`/
`markRendered` dance; `renderPass` then dispatches on the exhaustive `mode` enum
(`image | diff | compositor`) with no shared floor tail, and the 5 `*Version`
counters collapse to named `poolRevision`-style revision sources (distinct
triggers, one mechanism). **Why deferred:** this is one coherent unit — the
`*Version` fold is "structural only once the scheduler is rewritten" (shift-2's
own finding, re-verified), and `contentOpId → null` (killing the `opId === 0`
IDENTITY collision) is entangled with the WGSL contract where `0 = identity` is
the shader's load-bearing fallthrough (pool.ts / image-engine.ts feed it straight
into the uniform), so splitting unknown→null must touch the shader boundary. It is
the single most delicate, arbiter-pinned code in the tree (flip-paint +
flip-stress are the arbiters); a partial extraction would add an abstraction
without the deletions that justify it. Correct as its own focused, gate-heavy
shift — not a rushed end-of-shift slice under the land-green-or-revert rule.

## Oracles retired this shift
**None.** Per the retirement rule, no phase this shift made a tripwire's target
state unrepresentable (the scheduler/LeafView oracles await P3/P4). `overridden`
is not an oracle — it is a derived output, retained per the spec's diff-face
contract.

## Remaining (unchanged from shift-2's plan, minus what landed)
- **P2** — render-time-reseed timing STOP (above); `PaneSettings` per-pane
  field-scope serializer (its own shift); `NONE_GRAY_CURVES`; `hasKernelOwner`.
- **P3** — the scheduler unit above (folds shift-2's stop-item 2 `poolRevision`).
- **P4 / P5** — as shift-1's plan (stack/LeafView ownership; dtype split + oracle
  retirement).

---

# Shift 4 — P3: the render scheduler, as ONE unit

**Forked from** `2b04402` (shift-3 HEAD). Behavior-preserving throughout; full
gate green (typecheck 0 · node 661 · pytest 260 · schema + boundary OK · harness
36/40 via `--all`, IDENTICAL to the untouched base — the same 4 gesture/URL-only
interaction harnesses fail HEADLESSLY at `2b04402` and after, with byte-identical
signatures; every parity + interaction harness that settles headlessly —
flip-paint, flip-stress, flip-chrome, flip-resolve, realstack-gpu, content-ops,
compare-settings-sync, grid-stacked-persist — is PASS · bundles rebuilt + synced
+ committed).

## Phase landed

| Commit | Phase | What it made unrepresentable |
|---|---|---|
| `b858e68` | **P3 — render scheduler as one unit** | the two racing render effects + their shared `lastRenderedRef`/`lastContentIdentityRef` dance; the mode fall-through chain; the `opId === 0` IDENTITY∥unknown sentinel collision; the five separate `*Version` counter cells |

Landed as ONE commit under land-green-or-revert (the unit is coherent — the
`*Version` fold is structural only once the scheduler is rewritten, and the
sentinel split is entangled with the same dispatch). No revert needed.

### The three sub-changes (each traced)

**1. One render scheduler** — `renderers/use-render-scheduler.ts`
(`useRenderScheduler`), co-located with `render-snapshot.ts` (the template it
extends). Computes `(renderKey, phase)` ONCE per commit — `phase =
snapshot.resident && isFlip ? "layout" : "post"` — and drives BOTH hook slots (a
`useLayoutEffect` + a `useEffect`; React cannot pick the effect type at runtime,
so both slots exist, but the OWNER of a given commit's render is decided once).
A single `renderKey` = `{ id: renderId, source, container }` dedupe, owned by the
hook, guarantees a resident flip submits EXACTLY once even though both slots fire.
This replaces the two inline effects that each RE-DERIVED the flip/residency
decision and hand-synced a shared `lastRenderedRef`. The flip detector, the
dedupe ref, and the paint-phase-oracle epoch machinery (all former pane-body
refs) move INTO the hook; the pane now lists **no scheduler refs**.

*Equivalence argument (why byte-identical):* the old layout effect read the flip
detector AT EFFECT TIME; the new hook reads it at RENDER TIME to compute `phase`.
Nothing mutates the detector between a commit's render and its layout slot (the
upload effects don't touch it, and the scheduler slots are where it first could
change this commit), so the two coincide. Each slot's flip-detector write order,
the dedupe-check order, and the paint-phase record conditions (layout records
regardless of `submitted`; post only if `submitted`) are preserved verbatim.
Confirmed by the flip-paint arbiter: ZERO stale first-painted-frames on resident
image↔diff and same-kind flips, after as before.

**2. Exhaustive `mode` dispatch.** `renderPass`'s `if (compositorMode) … if
(diffMode) … <image tail> if (hasCompare) return false` fall-through chain became
`switch (snapshot.mode) { case "compositor" | "diff" | "image"; default: const
_never: never = snapshot.mode }`. `snapshot.mode` is 1:1 with the
`compositorMode`/`diffMode` booleans (its own definition), so each arm's body is
byte-unchanged. The degenerate-compare guard (`hasCompare` with an unrecognized
`compareSource.mode`, which maps to mode "image") is now a precondition INSIDE the
image arm, not a shared tail. A NEW content mode is a compile-time TYPE error at
this boundary, never a silent plain-image blit. (−2 `if` → 2 `case`.)

**3. `contentOpId → null` at the TS boundary.** `content-ops/wgsl.ts` gains
`contentOpIdOrNull(id): number | null` — the diff direct-op floor `if (opId === 0)
return false` (0 = IDENTITY colliding with "unknown/mis-resolved kernel") becomes
`const opId = contentOpIdOrNull(kernelId); if (opId === null) return false`. No
diff kernel legitimately dispatches to identity, so this is byte-identical, but
the sentinel collision is gone: `null` is unambiguously "hold". **The WGSL
contract is untouched** — the compositor path still uses `contentOpId` (its
split/blend ids are always registered), and the shader's `0 = identity`
fallthrough / zero-filled-uniform default is unchanged (content-ops.browser
byte-parity PASS).

### The `*Version` fold (shift-2 stop-item 2)

The five separate `*Version` `useState`s → ONE `useRevisions()` cell (one state
object, a stable `bump(source)`). Five NAMED sources, kept semantically distinct
(the shift-2/3 finding that a naive single revision over-fires them stands — they
are *named* on one mechanism, not merged into one counter):

| named source | trigger | consumers |
|---|---|---|
| `source` | primary/deep source texture (re)uploaded | scheduler render + diff metrics |
| `container` | container resized OR restored from park | scheduler render |
| `pixels` | retained CPU pixel bytes changed | histogram + pixel overlay |
| `reference` | diff `b` operand (re)uploaded | scheduler render(diff) + metrics/overlay |
| `diffOverlay` | cached-diff RESULT readback landed | overlay |

The pane keeps thin named read-views (`uploadVersion = revisions.source`, …) so
every consuming dep array is byte-unchanged — the fold is in the OWNERSHIP (five
cells → one mechanism), not a churn of ~16 read sites. `container` has no read
outside the scheduler, so it has no alias (passed straight to the hook).

## Accounting (vs shift-3 HEAD `2b04402`)

| file | if | loc | note |
|---|---|---|---|
| GpuImagePane.tsx | 107 → **95** | 2894 → 2836 | −5 scheduler refs, −2 effects → 1 hook call, −5 counter cells → aliases, −2 mode `if` → `case` |
| content-ops/wgsl.ts | 7 → **8** | 94 → 112 | +`contentOpIdOrNull` (+1 `if`, +18 LOC all doc) |
| use-render-scheduler.ts | **8** (new) | 199 (new) | the scheduler + `useRevisions`, mostly module doc |

Net `if` in pre-existing files **−11**; the scheduler's 8 conditionals relocated
into the named owner. Load-bearing wins: **−5 hand-synced state cells**
(`lastContentIdentityRef`, `lastRenderedRef`, `contentEpochRef`,
`contentEpochIdentityRef`, `lastCommitEpochRef`), **−2 racing effects → 1 owner**,
**−5 counter cells → 1 mechanism**, **−1 mode fall-through → exhaustive switch**,
**−1 sentinel collision** (opId 0 = identity ∥ unknown). One new module (the
scheduler owner) — the exception the report has treated as justified for a named
owner extending `render-snapshot.ts`.

## Human-readability summary — what a reader now finds where

- **"When does the pane render, and in which paint phase?"** — one place:
  `use-render-scheduler.ts`. `phase = resident && isFlip ? "layout" : "post"`,
  computed once, one `renderKey` dedupe. There is no second effect re-deriving the
  same decision, and no module-level ref two effects hand-sync. The pane hands the
  scheduler `snapshot` + `renderPass` + the two forcing revisions and owns nothing
  of the bookkeeping.
- **"Which pipeline does this frame drive?"** — `switch (snapshot.mode)` in
  `renderPass`, exhaustive: compositor / diff / image, with a `never` default. Mode
  is data; an unhandled one does not compile. No fall-through, no defensive tail.
- **"What does an unresolved diff op do?"** — holds (`contentOpIdOrNull → null`),
  told apart from a real identity. The shader still reads `0 = identity`.
- **"What re-fires a render / a histogram / an overlay?"** — one mechanism,
  `useRevisions`, with five NAMED sources; the name says who consumes it.
- The **`render-snapshot.ts` template stays untouched** — the scheduler is the
  consumer that now finally matches it (one owner, read by all, re-derived by none).

## Oracles retired
**None.** Per the retirement rule, P3's single owner does NOT make the surviving
tripwires' target states unrepresentable: the **paint-phase log** is the flip-paint
ARBITER (it measures whether resident flips actually paint pre-paint — a real,
still-checkable property), and `isPipelineMismatch` / the `compareIntended` tag
guard the degenerate-compare image blit (still representable — an unrecognized
`compareSource.mode` still reaches the image arm). What P3 DID make
unrepresentable — the two-racing-effects dedupe — was never an *oracle*; it was the
`lastRenderedRef` dance itself, now gone by construction (internal to the one
owner). The scheduler/LeafView oracles the plan slates for retirement
(`leafResolveStats`, the resolve tripwires) belong to P4; none removed here.

## Remaining phases (P4 / P5) — unchanged from shift-1's plan, minus what landed

- **P4 — stack & LeafView ownership** — `ResolvedLeaf` discriminated union +
  subscribable resolve-cache (LeafView reads via `useSyncExternalStore`);
  stack-owned chrome skeleton + `CompareControl` map + aspect reducer + children
  reconcile; `loweredRenderer()` / `resolvableFor()` shared by GridView prefetch
  and LeafView. Deletes the LeafView lag `state` cell + `staleDiffFallback`, the
  `__diffB` sentinel + diff-HOLD branch, the `__`-side-channel + casts,
  `reserveOnly` ×7 + `StackHasCompareContext`, `useCompareControl`-everywhere,
  `stackAspectRef`, the `effectiveMode`/`clampedActive` lag clamps, the
  prefetch/read key drift, `leafResolveStats`, `__cairnDisableSyncResolve`. Its
  oracles (`leafResolveStats`, the resolve tripwires) retire IN P4, once the
  subscribable cache makes the lag-cell state unrepresentable.
- **P5 — dtype split & oracle retirement** — HDR/SDR pane bodies (or a normalized
  internal source struct up front); the `notifyPresent` observer seam (moves
  `displayFingerprint`/`sampleDeepColor`/`paneId`/`deepSampleTex` + the
  bug-signature oracles to the harness); `scalarMode` one enum field; one shared
  test-hooks runtime chunk (kills the longest-ring heuristic). Deletes the union
  `hdrMode ? … : …` dep ternaries + `as HdrImageProps` casts + 3 parallel upload
  effects; the auto-armed `isPipelineMismatch`/`isEncodingGenerationMismatch`/
  `isOrangeSuspect` predicates; the `__cairnDisable*` toggles. The paint-phase log
  and `isPipelineMismatch` retire HERE (P5), asserted-zero then deleted, once the
  observer seam + dtype split make their target flashes unrepresentable.

## Open items needing the user's ruling (carried forward — none decided here)

1. **Render-time reseed timing (P2, per-field STOP).** The encoding's controlled
   reseed runs DURING RENDER (so the committed frame carries it, no one-frame lag);
   `useControlledReseed` is a post-commit `useEffect` that peak/γ/bounds tolerate
   but encoding does not. Folding encoding into the seam would either flash the
   encoding or force render-time timing on the other fields — a user-visible change.
   **Ruling needed:** accept encoding staying render-time (divergent timing encoded
   as data), or a design that unifies without a flash?
2. **Backing-size floor → required precondition (P1 stop-item 4, the one genuinely
   user-visible STOP).** Making render a no-op until first `resize()` risks a blank
   frame before the container is measured; today it falls back to source dims and
   paints. **Ruling needed:** is a blank pre-measure frame acceptable, or must the
   source-dims fallback stay?
3. **`PaneSettings` per-pane field-SCOPE (de)serializer (P2 design question).** The
   incoming legacy normalization is already single-source, and `viridis→turbo` is
   already one `aliasColormap` owner, so a `normalizeSettingsPatch` wrapper would
   add indirection without deleting duplication. The remaining win — a scoped
   `PaneSettings` value over the UNCONDITIONAL fields — is a genuine design shift
   because the panes have DIFFERENT capability sets (Gpu has exposure/peak; Cpu-SDR
   does not), carrying the UI-semantics risk shift-2 flagged. **Ruling needed:** the
   scope-tag design (one value, per-field `shared-look`|`diff-only`|`live-only`) vs.
   keeping the per-pane explicit surfaces — its own gate-heavy shift either way.

---

*Anthropic Cairn — structure-refactor execution report.*
