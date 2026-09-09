# Compare Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** On a comparison page with many runs, zooming, changing the comparison operation and moving the iteration slider never leaves a pane blank, stale or frozen, and never freezes the tab.

**Evidence:** traced 2026-09-09 (file:line below refer to cairn-plot main 62aa862 and cairn main cb3225a9).

## Global Constraints
- No main-thread replay of a decode a worker timed out on or that was aborted (`DecodePoolError` codes `timeout`/`aborted`/`disposed`/`affinity` are terminal at every layer).
- A resolve failure never blocks a retry forever; a pane can always recover after the next node change or after a short backoff.
- A compare pane keeps showing its previous frame while the next resolves; it never shows "Loading…" between steps once it has painted once.
- Grid cells are keyed by node identity (run), never by index.
- Every fix ships with a unit test or a harness assertion that failed before the fix.
- Trailers: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_018R6F9Ys9R5Htmq6K7oL6gf`. Named files only.

## cairn-plot tasks (sequential)

### CP1 — Decode pool and decoder terminal errors
Files: `ui/src/plots/image/resources/decoders/decode-pool-core.ts` (+test), `exr-decode.ts`, `npy-decode.ts` (+tests).
- H10a `decode-pool-core.ts:233` abort-after-dispatch: also `dispatched.delete(id)`, `clearTimeout(d.timer)`, detach the abort listener, `markIdle(worker)`, `pump()`; the late reply is then ignored by id. Test: abort a dispatched job → the worker is idle immediately, the next queued job dispatches, the stale timer never fires, the late reply is dropped.
- H10b `terminate()` (`:248-250`): reject every `dispatched` job for `worker` BEFORE the `if (!w) return` early return (a null slot can still have dispatched jobs after `dispose`). Test: `dispose()` with a job dispatched to a slot whose worker was already nulled → the job rejects with `disposed`.
- H11 `exr-decode.ts:274-287`: in `decodeExr`, if `fullErr instanceof DecodePoolError && !isRetryableInline(fullErr)` rethrow immediately — never fall into `decodeExrPure`. `npy-decode.ts:57-58`: same guard is already there for the pool; also ensure a `worker-error` that happened AFTER the job started (worker crashed mid-decode) is NOT replayed inline for buffers > 8 MB (ruling: large inputs surface the error). Tests via `setDecodePoolForTests` with a fake pool that rejects with each code.

### CP2 — Resolution cache, scheduler, lazy gate, grid keys
Files: `ui/src/resources/resolution-cache.ts` (+test), `ui/src/resources/scheduler.ts` (+test), `ui/src/host/PlotNodeView.tsx`, `ui/src/plots/image/runtime/host-adapter.tsx`, `ui/src/layout/GridLayout.tsx` (+test).
- H2 errors: `errors` entries carry a timestamp; `peekResolveError(key)` returns undefined once the entry is older than `RESOLVE_ERROR_TTL_MS = 2000` and deletes it; both guards (`host-adapter.tsx:200`, `PlotNodeView.tsx:437`) therefore retry after the TTL; a node change (different key) is unaffected by another key's error. Test: fail once, advance the clock, resolve again succeeds.
- H12 lease handoff: `resolveCached` keeps the entry leased until the consumer's `acquireResolved` runs or `RESOLVE_HANDOFF_MS = 5000` elapses (a grace lease released by timer), so `evictToBudget` cannot evict a just-resolved entry before the pane acquires it. Test with a tiny budget.
- H1 scheduler: a task slot is freed if the task has not settled within `TASK_WATCHDOG_MS = 60000` (the promise is left to settle on its own; the slot is released and a `console.warn` names the key); fairness: tasks are ordered by priority, then by `visible` (a new optional boolean supplied by the caller from the lazy gate), then FIFO. Tests.
- H13 LazyGate (`PlotNodeView.tsx:343-344`): if the placeholder ref is null, retry on the next animation frame (bounded, 10 tries); when the observer reports zero-size/hidden, re-observe on `ResizeObserver` size change. Test in `lazy-mount` unit tests if the module is pure; otherwise the harness covers it.
- H6 keys `GridLayout.tsx:175`: key cells by `child.id ?? child.key ?? index` where the node carries an id; scalar/compare nodes from cairn carry `id: runId`. Test: reordering children keeps component identity.

### CP3 — WebGPU view and pool
Files: `ui/src/plots/image/webgpu/view.tsx`, `ui/src/plots/image/webgpu/pool.ts` (+tests where pure), `ui/src/plots/image/components/use-image-viewport.ts`.
- H8 `view.tsx:1348-1360`: `.catch` on the B-operand lease promise → `setOperandError(message)` and stamp `appliedBIdRef` so the present gate never waits forever; the pane shows `PaneUnavailable` with the error and retries on the next node change.
- H7 `pool.ts:1071` failed entries: `failed` is cleared when the entry is re-activated by a new content generation or visibility change (bounded retries: 3, then error state surfaced to the view). Admission after a step change (`:937-940`): when every visible pane needs presentation, choose the least-recently-presented visible pane as victim so rotation continues; add a test on the pure victim-selection helper (extract it if inline).
- H14 `view.tsx:1055-1059, 1173`: create the source lease only when the pane handle exists; otherwise defer to `paneReady`.
- H9 `use-image-viewport.ts:39-40, 82`: when the element is missing at effect time, retry on the next frame; re-measure on `ResizeObserver`.

### CP4 — Harness
File: `ui/src/plots/image/compare/__tests__/compare-grid-interactions.browser.{ts,html}` (self-driving).
18 panes of split/difference compares over the committed EXR fixtures (registered as distinct hashes with per-"step" variants), driven through: 20 step changes (spec updates via `update({spec})`), operation changes split→difference→flip→split, 10 wheel zooms and pans, settings-panel-style remount (unmount+mount the host). After each action wait for settle (≤ 3 s) and assert: no pane shows "Loading…" or `PaneUnavailable`; every pane canvas has a non-transparent centre; the presented generation equals the requested one (expose via a test-only `data-presented-step` attribute set by the view when a frame is presented); no long task > 200 ms. Both backends (cpu, gpu when available).

## cairn task (parallel with CP1)

### C1 — CairnPlotCard
Files: `cairn/ui/src/components/CairnPlotCard.tsx`, `cairn/ui/src/components/card-kit/resolve-at-step.ts` (+tests), `cairn/ui/src/components/card-kit/*` as needed.
- H3 `:414-417`: set `holdPreviousWhileLoading: true` in the comparison branch too.
- H6 `resolve-at-step.ts:15-22` + `:382-398`: `resolveAtStep` returns the nearest point (prefer ≤ step, else the first point above) so a pane is never dropped; a run with no artifact at all renders an explicit "no data for this step" pane node (`kind:"message"` if the spec supports it, else an image node with `data: null` that cairn-plot shows as unavailable) — never `return []`. Children carry `id: runId`.
- H5 `:340`: never `return null` for the whole card while some queries load; build the spec from the runs whose data is present and mark the others as loading panes; the host stays mounted.
- H4 `:784-790`: the plot host must not move in the tree when the settings panel opens: render `plotContent` in one stable position and overlay the settings panel (portal/absolute) instead of swapping `modalContent`/`plotContent`.
- Tests: `resolve-at-step.test.ts` (nearest semantics), a component test (if the UI has a test runner for tsx: `node --experimental-strip-types` cannot import tsx — if no tsx test runner exists, extract the pure spec-building logic (`buildComparisonSpec(points, step, settings)`) into `card-kit/build-plot-spec.ts` and test that).
