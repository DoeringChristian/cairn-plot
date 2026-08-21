# Flicker post-mortem — stacked image↔diff flips

**Date:** 2026-08-21
**Branch:** `diff_unification`
**Scope:** honest engineering audit of the commit chain that ended with the user
confirming "no flickering" on stacked image↔diff tab flips.
**Method:** every verdict below is read from the *actual diff* of the named
commit (`ui/src/**` sources, not the minified `*.iife.js` bundles, not the
commit message alone).

---

## 0. The symptom, stated precisely

In a **stacked** grid a single reused pane shows one child at a time; the tab
strip flips which child is active. When one child is a plain image and another is
a diff/compare, a fast flip painted **one wrong frame**:

- the diff tab briefly showed its **reference operand** as a plain image
  ("image inside the diff tab"), and/or
- an authored-**magma** scalar slot briefly painted **raw gray** (no colormap),
  and (a separate report) a plain image briefly flashed **orange**.

All three are the same shape: **the state feeding a render lagged the flip by one
React commit**, so the first painted frame after a flip was assembled from a
half-updated input set. The fixes each chased one lagging input (resolve,
uploads, op params, encoding, sync-adopted colormap) into the flip commit.

The deeper precondition that *created* this failure mode: the content-op
unification epic collapsed `[image, diff]` into a **homogeneous** stack served by
**one reused `GpuImagePane`** (source-swap, no remount). Before that, a cross-kind
flip **remounted** a fresh pane (`341c577`), which has no stale-state window but
loses the camera and is heavier. Unification bought a real architectural win and,
in exchange, turned "flip" into "swap the inputs of a live component" — an
async-coherency problem.

---

## 1 & 2. Per-commit: what it changed + classification

Legend for classification:
**(a) REQUIRED** — load-bearing in the final fix chain for the flicker the user saw.
**(b) INDEPENDENT** — fixes a real, *distinct* defect / perf / UX win (names it).
**(c) NOT REQUIRED** — revertable without an observable regression (names the cost).
**(d) INSTRUMENTATION** — tripwire/harness; keep/strip called out.

### `341c577` — mixed-stack mount-swap
Enabled the normal⇄stacked toggle for a *mixed* (image-leaf + compare-pane) grid
by threading the fullscreen stage's two sync groups (viewport + settings) so a
cross-kind flip **remounts** the pane as a non-anchor that re-adopts the group's
zoom/pan + display settings. A mixed stack can't share one renderer instance, so
it mount-swaps; the camera survives via the sync group.
**Verdict: (c) NOT REQUIRED — superseded/dead.** `a96ab54` explicitly retired the
`mixedImageStack` + `stackPaneSync` machinery this added, once homogeneous
routing covered every image-compatible child. Nothing in the shipped tree reaches
it for `[image, diff]`. It was a genuine interim (it's how the FLIP validation
grid first got a toggle), but it carries no residual value now.

### `8e960ab` — ContentOp registry + identity op (epic Phase 1)
Introduced the content-stage registry (mirroring the image/encodings registries):
a content op declares how a texel's k-channel value is produced from 1–2 source
slots. Phase 1 registers only IDENTITY (passthrough); the shader assembles
`cairnContent(sampled)` from the registry, byte-identical downstream.
**Verdict: (b) INDEPENDENT — architectural foundation.** Zero behavior change, not
flicker-related. Its value is the single declaration point that the whole
unification (and the ~3.5k-LOC deletion) rests on.

### `a83553d` — diff content ops + 2-slot content stage (Phase 2)
Added the six pointwise diff ops (direct, arity-2, WGSL expression + CPU twin) and
FLIP/HDR-FLIP/SSIM (cached, delegating to the diff engine), plus a second source
texture (`t_bind11`) and a `contentOpId` uniform so a diff renders through the
*same* shader as a single image. Single-image path byte-identical (placeholder
slot + opId 0).
**Verdict: (b) INDEPENDENT — architectural foundation.** The unification's engine
half; not flicker.

### `5244fc4` — pool 2nd source slot + `renderDiffCached` (Phase 2b)
Gave the pane pool a second retained/uploaded source slot (`sourceB`/`srcTextureB`
with park/restore lifecycle) and a `renderDiffCached` path (`ensureDiff` → blit the
scalar-error result through the unified image path).
**Verdict: (b) INDEPENDENT — foundation.** Note: this second-slot pool ownership is
a *precondition* the later residency/coherency work builds on, but on its own it's
plumbing, not a flicker fix.

### `09c4731` — diff-capable `GpuImagePane` (Phase 2c Landing 1)
Grew the unified pane an optional `compareSource` (operand `b` + diff mode) that
turns it into a diff pane through the pool, with all diff chrome (mode menu,
metrics chip, TEV readout, settings-sync). Dormant — no routing points at it yet,
so the single-image path stays byte-identical.
**Verdict: (b) INDEPENDENT — foundation.** The pane capability; not yet flicker.

### `785385e` — route diff compares to the unified pane (Phase 2c Landing 2)
**The pivot.** Collapsed the image↔diff dispatch *inside* `PlotNodeView`: a
diff-mode compare now lowers to the same `LeafView → image → GpuImagePane` family
an image leaf uses (with a resolved `compareSource`), and `stackKindKey` maps a
diff compare to the image-leaf key — so `[image, diff]` is **homogeneous** and the
flip is a **source-swap on one reused instance**, no remount.
**Verdict: REQUIRED precondition — and the birthplace of the bug class.** This is
what makes the final fix chain *necessary*: by removing the remount it removed the
natural coherency boundary, so every subsequent per-field lag became visible. The
commit subject calls itself "the flicker fix" — evidence contradicts that: it
*eliminated the remount flicker* but introduced the reused-pane stale-frame class
that took eight more commits to close. Independently valuable as the epic's
routing spine.

### `9f70506` — split/blend as direct compositor ops (Phase 3 engine)
Registered `split`/`blend` as arity-2 direct ops (`select`/`mix` in the shader
dispatch) with a compositor-param uniform driven live (no recompile) and a CPU
twin. Byte-parity-pinned, no routing.
**Verdict: (b) INDEPENDENT — foundation.** Not on the image↔diff flicker path
(split/blend are light composites, not the reference-flash class).

### `04a5e64` — unified pane renders split/blend + chrome (Phase 3 pane)
Gave the pane the compositor render + ported chrome (SplitDivider, flip-keys, ref
badge, per-side captions), and **fixed task #88** (per-side pixel-number
misalignment) by giving each split-clipped readout its own `sourceDims`.
**Verdict: (b) INDEPENDENT — fixes #88, a real distinct defect** (numbers drift
proportional to texel index on a mismatched-resolution side). Not flicker.

### `a96ab54` — route split/blend + retire mixed-stack machinery (Phase 3 routing)
Every compare node (diff AND split/blend) now lowers to the one unified pane;
`stackKindKey` keys every compare `plot:image` so all stacks are homogeneous; the
`341c577` `mixedImageStack`/`stackPaneSync` machinery is deleted.
**Verdict: (b) INDEPENDENT — the unification's completion + dead-code retirement.**
Extends `785385e`'s homogeneity to split/blend. Not itself a flicker fix, but it's
what makes `341c577` classify as (c).

### `df8c5b8` — migrate #88 proof onto the unified pane + Phase 3 note
Re-pointed the #88 split-numbers harness at the unified pane; design-doc note.
**Verdict: (b) INDEPENDENT — test migration + docs.**

### `d821875` — migrate cross-type compare consumers (Phase 4)
Pointed the last two `GpuComparePane` consumers (image card, live-3D snapshot
compare) at the unified pane — after the offscreen snapshot both sides are plain
decoded sources, so the unified pane serves them.
**Verdict: (b) INDEPENDENT — consumer migration** enabling the deletion below.

### `28e4275` — delete `GpuComparePane` + dead satellites (Phase 4)
Deleted `GpuComparePane.tsx` (~1990 LOC), 3 human-run harnesses (~1470 LOC), and
dead exports; folded their coverage into the self-driving parity set.
**Verdict: (b) INDEPENDENT — ~3.5k-LOC net deletion, one-pipeline consolidation.**
The epic's payoff. Not flicker.

### `69c827c` — Phase 4 sweep / epic-complete note / #87 closure
Docs; closed task #87 (compare settings-sync duplication) "by construction — one
settings path now"; recorded the deferred CPU-composite gap.
**Verdict: (b) INDEPENDENT — docs + #87 closure.**

> **Epic sub-total (`8e960ab`…`69c827c`):** a coherent, independently valuable
> refactor — one content-stage registry, one pane, ~3.5k LOC deleted, #87 + #88
> fixed. Only **`785385e`** (and, transitively, the homogeneous-stack routing) is
> load-bearing for the flicker. The epic did not fix the flicker; it *set the
> stage on which the flicker had to be fixed*.

---

Now the residual-flicker chain proper.

### `0bb636e` — content-keyed source retention + synchronous rebind
Root-caused the residual flip flicker as **re-decode + re-upload of both source
textures on every flip**, with the cached diff result's present deferred behind
that async re-upload. Fix: the pool retains keyed uploads in a small per-pane LRU
(`MAX_RETAINED_SOURCE_TEXTURES=6`), and the pane caches decoded `SourceUpload`s
keyed by content key and **binds synchronously on flip-back**.
**Verdict: REQUIRED precondition.** This is the **residency** the later
paint-atomic render (`874800e`) *requires* — a pre-paint render is only legal when
the target's textures are already resident. On its own it closed the re-upload gap
but not the between-presents window.

### `9368ee2` — present-coherency guard (source-identity gating)
Introduced `appliedPrimaryIdRef`/`appliedBIdRef` (stamped at every upload site) and
the rule: `renderPass` presents **only when applied == expected** for both source
slots, else **hold the previous frame** until the pending async upload lands. Op
and encoding are treated as pure synchronous prop derivations (assumed already
coherent). Added the per-present render log (`recordPaneRender`) — ground-truth
bound keys per GPU present.
**Verdict: REQUIRED foundation** (the `applied*`/`expected*` machinery that
`874800e` and `a790e34` both build on) **+ (d) INSTRUMENTATION** (the render log —
keep; zero-cost unarmed). Honest caveat: its own present-gate proved every
*present* coherent yet the user still saw a flash, because the artefact lives
*between* presents — a gap this commit's model did not yet cover.

### `368795e` — sharpen the present-coherency oracle *(not in the audit list; noted)*
Widened the oracle to a full source⊗encode fingerprint; **could not reproduce** the
reported orange flash at the pane.
**Verdict: (d) INSTRUMENTATION.** Value: it correctly *ruled the pane out*, which
redirected the hunt to the descriptor/settings-bus path (`0758207`). Keep.

### `c459c34` — chrome stability (reserved slots, chip persistence) + stale-resolve hold
Two things. (1) **Chrome stability:** a flip within a stacked viewport may change
*pixels, never layout* — but each flip was mounting/unmounting the mode button,
channels/histogram buttons, and caption/metrics chips (160 add/remove events over
40 flips = visible popping + toolbar reflow). Fix: a `StackHasCompareContext`
reserves the compare chrome skeleton on the image slot (persistent hidden chips, a
*disabled* reserved mode menu), so only text/content swaps. (2) **Stale-resolve
hold (Finding 2):** `LeafView` now holds the previous single-image frame instead
of emitting a `compareSource` with an undefined `b`.
**Verdict: chrome part → (b) INDEPENDENT** — fixes a real distinct defect
(toolbar/chip churn, a layout flicker, not the pixel flash). **Hold part →
REQUIRED (early form)** — the same "hold rather than present an incoherent frame"
principle `a790e34` generalizes. The commit conflates two defects; only the hold
is on the pixel-flash chain.

### `0758207` — sync-adoption scoping (diff colormap not applied to image peers)
Reproduced the **orange flash** on the *real descriptor GPU stack* (prior harnesses
fell back to CPU headlessly): a diff-anchored page-wide selection published its
scalar-error `encoding:"magma"` (`compareMode:"diff"`) and `applyRemoteSettings`
**adopted it onto plain light image peers**, false-coloring a near-white image
through magma's upper ramp = 97/97 image presents orange. Fix: a diff's
scalar-error display encoding is **diff-only** — a non-diff pane ignores a
`compareMode:"diff"` patch (landed in `GpuImagePane` + both CPU receivers).
**Verdict: (b) INDEPENDENT — a genuinely distinct defect** (a settings-**bus**
cross-kind leak, only visible with a page-wide selection anchored on a diff). It is
**not** the user's stacked-flip reference-flash and would not be fixed by any of
the paint-atomic work. Real orange bug, real fix, own axis.

### `8104cbd` — oracle false-positive fix + deep hue detector + context-loss instrumentation
(1) The armed orange oracle spammed false positives on the legitimate k=1
authored-magma scalar pane — `isOrangeSuspect` now requires `channelCount > 1`
(only a *multi*-channel light image collapsed through a scalar colormap is the real
class). (2) A `paneRenderLog=2` deep detector renders an extra 8×8 pass into an
offscreen texture and flags a settled slot presenting a color far from its own
fingerprint — the flash caught **by its color, cause-agnostically**. (3)
WebGPU/THREE context-loss events timestamped. Investigation on real Metal: orange
**not reproduced** (0 suspects, 0 hue anomalies over a 197-present storm); the
THREE context loss is the benign auto-recovered 3D-viewer kind.
**Verdict: (a-adjacent oracle correctness) + (d) INSTRUMENTATION.** The k=1
exemption is a real oracle-correctness fix (keep). The deep detector is the most
*general* catcher and is zero-cost unarmed — **keep**. Context-loss instrumentation:
keep opt-in, low value now (no device-lost recovery was warranted by evidence);
strippable if it's noise. This commit did **not** fix the user's flicker — it
proved several *candidate* causes were absent, which is what forced the correct
diagnosis (`874800e`).

### `874800e` — paint-atomic pane renders (uploads/render moved to layout effects, dedupe)
**The mechanism breakthrough.** Named the real artefact: a **paint window
containing no present**. The flip commits (tab strip updates), but the pane's
engine render for the new slot ran in a *post-paint passive effect*, so the first
painted frame held the previous slot (WebGPU keeps the last present). Every prior
oracle passed *by construction* — they inspect presents, and no present is torn.
Fix: when the flip target is **fully resident** (retained textures + synchronous
decode + cached diff result via a new non-mutating `DiffCache.has`/`hasDiff`/
`isDiffResultCached` peek), render **pre-paint in a `useLayoutEffect`**; move the
SDR/HDR/`setSourceB` upload effects to `useLayoutEffect` (bind + stamp `applied*`
in-commit); broaden the synchronous flip-back fast path to every non-colormapped
image (so diff→image is atomic too); dedupe the pre-paint vs post-paint render
(`renderPass` now returns `submitted?`, both effects share one key); and an
**anti-churn** fix so the diff kernel/colormap re-seed effects no-op when
`!compareSource` (an image slot no longer resets diff params and re-applies them
post-paint). New paint-phase log oracle times submits against real paint
boundaries.
**Verdict: (a) REQUIRED — the enabler.** Without pre-paint rendering, the
synchronous resolve `a790e34` adds would still not *paint* in time. This is the
structural half of the final fix. **+ (d) INSTRUMENTATION** (paint-phase log — keep;
it's the only reliable signal for the between-presents artefact).

### `a790e34` — LeafView synchronous resolve-cache hits + diff-pair prefetch + reference-leak guard + identity-never-presentable-in-diff-mode
**The final reference-flash fix.** Two hops could put the reference on the surface;
both closed. (1) **`LeafView` resolved `dataProps` a commit late** — even on cache
hits it went through an async `setState`, so a flip commit painted the previous
slot, and a diff→image flip's stale `state` (whose `source` *is the diff's
reference*) got spread as a plain image. Fix: **synchronous derive-from-cache
during render** (`peekResolved(resolveKey)`, reference-stable), **diff-pair
prefetch** (`resolveDiffPair` warms the `|diffpair` key on stack entry so the first
flip is a cache hit), and a **reference-leak guard** (`staleDiffFallback`: on the
single-image path reject a `state` fallback that still carries `__diffB`, hold
instead). (2) The pane's direct-op branch rendered `contentOpId 0 = IDENTITY`
(`return a` = the reference) for any unrecognized kernel id; and the plain-image
blit was reachable while a compare was intended. Fix: **in diff mode a primary-
identity render is never presentable (hold); the plain-image branch holds when
`hasCompare`.** Tripwire `compareIntended` + `isPipelineMismatch`.
**Verdict: (a) REQUIRED — this is THE fix for the reference-image flash.** **+ (d)
INSTRUMENTATION** (`isPipelineMismatch` — keep; would have caught the bug from day
one). The `__cairnDisableSyncResolve` toggle exists purely so one harness measures
pre- vs post-fix on the identical driver.

### `cf92620` — encoding reseed during render + encoding-generation tripwire
**The sibling class, one layer up.** After the reference flash was gone, an
authored-magma scalar slot occasionally painted one frame with **no magma**:
`usePaneEncoding` reseeded `encodingId` from descriptor props in a `useEffect` —
**one commit late** — so the paint-atomic flip render read the previous slot's
encoding generation. Fix: move the descriptor reseed into the **render body**
(React's supported adjust-state-during-render, guarded on a `propsKey` change so it
fires once), so the committed flip frame already carries the authored encoding; the
pure arity-flip reseed stays in an effect. Tripwire `authoredColormap` +
`isEncodingGenerationMismatch`.
**Verdict: (a) REQUIRED — closes the last lagging input** (encoding generation) for
the complete "no flickering". **+ (d) INSTRUMENTATION** (keep the tripwire).

---

## 3. The final fix — precisely which changes constitute it

The prompt's working theory is **correct**, with two refinements. The flicker =
**state feeding the render updating one commit late**, and the visible surface
being a **paint window with no fresh present**. The complete fix chain, in
dependency order:

| Layer | Commit | What it guarantees |
|---|---|---|
| Routing precondition | `785385e` (+`a96ab54`) | the flip is a source-swap on one reused pane (creates the class) |
| Residency precondition | `0bb636e` | both source textures resident on flip-back, sync rebind (no re-upload gap) |
| Coherency machinery | `9368ee2` | `applied*`/`expected*` source-identity model + hold-previous-frame; the render log |
| **Paint-atomicity (enabler)** | **`874800e`** | resident flips render **pre-paint** (`useLayoutEffect`); uploads stamp `applied*` in-commit; anti-churn on the diff re-seed effects |
| **Resolve/pipeline fix (THE fix)** | **`a790e34`** | `LeafView` resolves **synchronously during render** on cache hits + diff-pair prefetch + reference-leak guard; identity-never-presentable-in-diff-mode |
| **Encoding fix (sibling class)** | **`cf92620`** | encoding reseed **during render**, so the committed flip frame carries the authored colormap |

So: **the final fix is `a790e34` + `cf92620`, enabled by `874800e`'s
paint-atomicity, made possible by `0bb636e`'s residency and `9368ee2`'s
coherency machinery, on the reused-pane substrate `785385e` created.**

Refinement 1: `9368ee2` belongs in the required chain, not merely "context" — its
`appliedPrimaryIdRef`/`expectedPrimaryId` model is the exact machinery `874800e`'s
`targetResident` check and `a790e34`'s hoisted expectations read. Refinement 2:
`c459c34`'s *stale-resolve hold* (not its chrome work) is the early, narrower form
of `a790e34`'s reference-leak guard; the chrome work is an independent defect.

Everything else in the audit set — `341c577`, the epic body, `0758207`,
`8104cbd`, the chrome half of `c459c34` — is **not** part of this chain. Several
were fixes for **real defects that were not the user's flicker**: the orange
settings-bus leak (`0758207`), the toolbar churn (`c459c34` chrome), the #88
number drift (`04a5e64`), and the oracle false positive (`8104cbd`).

---

## 4. Ad-hoc vs structural — and the consolidation

### Are the fixes ad-hoc or a coherent invariant?

Read as mechanism, every fix does the **same** thing to a **different** field:
move one async hop into the flip commit.

| Lagging input | Chased into the commit by |
|---|---|
| resolved `dataProps` (sources) | `a790e34` sync `peekResolved` + prefetch |
| GPU source uploads | `874800e` upload effects → `useLayoutEffect` |
| the render itself | `874800e` pre-paint layout render |
| diff op / kernel / colormap params | `874800e` anti-churn + `a790e34` identity guard |
| display encoding generation | `cf92620` reseed-during-render |
| bus-adopted colormap | `0758207` content-kind scoping |

That is a **coherent invariant discovered field-by-field**: *a frame is
presentable only if its entire input set comes from a single commit; otherwise
hold the previous frame.* But it is **enforced ad-hoc** — by a growing pile of
**per-field guards and tripwires**: the coherency guard (source identity), the
identity-not-presentable guard + `isPipelineMismatch` (op/pipeline), the
reference-leak guard (stale `dataProps`), the render-time encoding reseed +
`isEncodingGenerationMismatch` (encoding), the anti-churn no-op effects (diff
params). Each guard defends one field. **The class is closed for the known fields,
not by construction.** A *new* field (a new content param, a new display stage, a
new sync-adopted key) would re-open it and demand a seventh guard.

### The structural consolidation

**One render-snapshot builder.** Every visible render derives its complete input
set from the **same React commit**, assembled in **one place**:

```
RenderSnapshot = {
  primaryId, bId,            // source identities (== the pool's applied* stamps)
  opId, contentParam,        // content stage
  encodingId, isScalar, mapping,  // display stage
  resident                   // are the sources + cached result already in place?
}
```

with a single **presentability rule**: *if a complete, resident snapshot exists,
present it; else hold the previous frame.* No per-field guard — the snapshot is
either whole (present) or not (hold), by construction.

**What it touches (concrete, against the current code):**

- **`GpuImagePane.tsx`** (the bulk). Today the pane hand-derives `expectedPrimaryId`,
  `expectedBId`, `contentIdentity`, `targetResident`, `isCachedDiff`,
  `authoredColormapIsLut`, `compareIntended`, plus **two** render effects
  (`useLayoutEffect` pre-paint + `useEffect` post-paint) with a `renderId`/
  `uploadVersion`/`containerTick` dedupe, plus the in-`renderPass` `applied* ==
  expected*` gate and the `if (hasCompare) return false` / `if (opId === 0) return
  false` guards. All of that becomes: **build one `RenderSnapshot` in the render
  body → one effect that presents iff the snapshot is complete+resident, else
  holds.** The `applied*` refs remain (they are the pool's commit-side confirmation
  the snapshot's residency reads), but the *scattered expectation derivations
  collapse into the snapshot builder*.
- **`LeafView` (`plot-node.tsx`).** Already resolves synchronously
  (`peekResolved` + prefetch) and already holds on a miss — formalize its output as
  *the source half of the snapshot* (identities + content keys), so the pane never
  re-derives them. The `staleDiffFallback` reference-leak guard becomes implicit:
  a snapshot for the single-image path simply has no `bId`, so a stale `__diffB`
  can't leak in.
- **`display-encoding.ts` / `usePaneEncoding`.** The render-time reseed stays, but
  its output (`encodingId` + `authored?`) becomes *the display half of the
  snapshot* rather than a field the pane separately tripwires.
- **`engine/pool.ts`, `image-engine.ts`, `diff-*`.** Largely untouched — the pool's
  `applied*` stamping, `hasDiff`/`isDiffResultCached` peek, and retention are
  exactly the residency primitives the snapshot's `resident` flag consumes.

**What it deletes / obsoletes:**

- the `hasCompare`/`opId===0` **identity-not-presentable** guards in `renderPass`
  (a snapshot in diff mode never has an identity op),
- the **reference-leak guard** `staleDiffFallback` (structurally impossible),
- the **encoding-generation** special-case shape as a *guarded* path (it's just the
  encoding field of the snapshot),
- the **anti-churn** `!compareSource` no-op effects (a snapshot never reads a
  half-updated diff param),
- the two-effect **pre/post-paint dedupe** machinery (one snapshot → one present
  decision),
- and, as **production** guards, the three tripwires `isPipelineMismatch`,
  `isEncodingGenerationMismatch`, and the orange oracle *predicates* — though see
  the recommendation on keeping them as **tests**.

**Scope estimate: medium.** One file does ~85% of the work
(`GpuImagePane.tsx`, the ~250-line render/effect region), plus a small shape change
in `LeafView` and `usePaneEncoding`. No engine/pool rewrite. Estimate **1–2 focused
days**, the risk concentrated in the flip path's subtlety — **but** the existing
harnesses (`stacked-diff-flip-stress`, `-paint`, `-chrome`, `-resolve`,
`-realstack-gpu` Phases A–E) already codify every invariant to 0, so a refactor has
a **strong regression net** that the original fixes did not.

### Do the tripwires suffice if the refactor is deferred?

**Yes, for now.** They are zero-cost unarmed, they drove the three flash classes to
0, and each would fire on a regression of *its* field. The user has confirmed the
symptom is gone. There is no urgency.

**But** they protect the *known* fields only, and they are a maintenance surface
(every future flip-adjacent change must remember to keep six invariants true).
The snapshot refactor converts "we guard each field we've found" into "an
incomplete frame cannot be presented" — it makes the class *impossible* rather than
*patched*.

### Recommendation

1. **Ship as-is; keep every tripwire and harness.** They are the safety net and are
   free. Do **not** strip them.
2. **Do the render-snapshot consolidation the next time `GpuImagePane`'s flip/render
   region is opened for substantial work** — not as an urgent standalone task. It's a
   medium, single-file-centred refactor with an existing regression net, and it
   retires 5–6 per-field guards for one construction-level guarantee.
3. When it lands, **demote** `isPipelineMismatch` / `isEncodingGenerationMismatch` /
   the orange oracle from "guards the shipped path" to "asserts the snapshot builder
   can't emit an incomplete frame" — same predicates, now proving a structural
   property instead of patching a field.
4. **Optionally strip** the context-loss instrumentation (`8104cbd`) if it proves
   noisy — evidence showed no device-lost recovery was warranted.

Confidence: high on the diagnosis and the final-fix identification (read from the
diffs); medium on the refactor scope (the flip path is subtle, but the harness
coverage de-risks it).

---

## RenderSnapshot consolidation — DONE (commits `0b02229`, `3d86e65`)

Landed the §4 consolidation, in two commits, behavior byte-identical: all 31
parity harnesses green (metal, native WebGPU), 628 node tests, 243 pytest, gpu-image
bundle rebuilt + synced + committed. Split into a Stage 1 (behavior-structure)
and a Stage 2 (readability) so each is independently revertable.

### Stage 1 (`0b02229`) — the snapshot

The scattered per-field derivations in `GpuImagePane`'s flip/render region are
now assembled into ONE `RenderSnapshot` per commit (`render-snapshot.ts` after
Stage 2), read by the present gate, the pre-paint effect, the flip detector, and
the paint-phase log. The consolidation:

| was (scattered local) | now (snapshot field) |
|---|---|
| `expectedPrimaryId` / `expectedBId` | `primaryId` / `bId` |
| `contentIdentity` (flip detector) | `contentKey` |
| `cachedDiffKernel` / `isCachedDiff` | `isCachedDiff` |
| `targetResident` | `resident` |
| the in-`renderPass` applied==expected floor | `sourcesApplied` (+ the call-time ref compare kept in `renderPass`) |

The invariant is stated ONCE, at the type: *a frame is presentable only when its
whole input set — both sources, the content op, the display encoding — comes from
a single commit; otherwise hold the previous frame.*

### Stage 2 (`3d86e65`) — decomposition + de-archaeologization

Module map (LOC before → after):

| file | responsibility | LOC |
|---|---|---|
| `renderers/GpuImagePane.tsx` | the pane shell + render/upload/diff/chrome orchestration | 2865 → **2691** |
| `renderers/render-snapshot.ts` (new) | `RenderSnapshot` type + `buildRenderSnapshot` pure builder + the invariant doc | **142** |
| `renderers/gpu-image-samplers.ts` (new) | `usePixelSamplers` — the 3 read-only TEV pixel-value samplers over the retained CPU buffers | **194** |

Comment cleanup: rewrote the stale module header (it still described compare as
handled by the DELETED `GpuComparePane` and claimed the pane was "not wired into
any live page yet"); replaced history-narrating markers in the render path
(Q20/Q22/Q24, "C1 fix", the reference-flash prose) with statements of the current
invariant. The tripwires (`isPipelineMismatch`, `isEncodingGenerationMismatch`,
the render/paint-phase logs) STAY — they now read as assertions that the snapshot
builder can't emit an incomplete frame (recommendation #3).

### Deletions the §4 estimate imagined — DELIBERATELY NOT made (they change behavior)

Assembling the snapshot centralizes and NAMES the decision; it does **not** make
the lagging upstream state coherent, so the per-field guards §4 hoped would "fall
out" each still defend a real transient. Removing them would fail a harness or
regress a proven invariant, against the "behavior identical" mandate:

- **`opId===0` identity-op floor** and **`hasCompare` compare-intended floor**
  (in `renderPass`): KEPT, re-expressed as snapshot invariants + tripwires. Cheap
  belt-and-suspenders floors; deleting them trades a proven guard for a structural
  argument. (This IS recommendation #3 — demote to assertion, don't delete.)
- **`LeafView.staleDiffFallback`** (reference-leak guard, `plot-node.tsx`): KEPT.
  §4's claim that it becomes "structurally impossible" because a single-image
  snapshot "has no bId" does **not hold** — the leak is that the stale `state`'s
  `source` IS the diff's reference operand, emitted as a plain-image prop with no
  `compareSource`. By the time `GpuImagePane` sees it, `hasCompare` is already
  false and `source` is wrong; the pane's snapshot cannot repair an upstream prop.
  The guard is genuinely load-bearing and stays in `LeafView`.
- **The diff-param anti-churn effects** (`if (!compareSource) return` in the
  kernel/colormap reseed effects): KEPT. They keep diff state DORMANT across
  image↔diff flips. The reseed is a `setState` in an effect, independent of the
  snapshot; removing the guard reintroduces the reset-then-reapply churn the
  paint-atomic render catches as a wrong-kernel/wrong-colormap present
  (`stacked-diff-flip-stress` fails). The snapshot reads the churned state — it
  doesn't prevent the churn.
- **The two-effect pre/post-paint structure**: KEPT (the two effects run in
  different phases by design — that IS paint-atomicity). The dedupe machinery
  (`renderId`/`lastRenderedRef`) is retained; both effects now key on
  `snapshot.contentKey`/`resident`.

Net: the class is now enforced through ONE named, assembled-in-one-place struct
with the invariant stated at its type, and the remaining floors are honest
belt-and-suspenders assertions rather than deletions that would trade correctness
for a structural story.
