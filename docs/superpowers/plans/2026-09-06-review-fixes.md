# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the parity runner honest, replace vacuous guard tests with behavioural ones, unify the comparison-selection logic behind one pure helper used by both the host adapter and the compositor, fix `compareModified` and the compare defaults, and re-home the live `compare-pass` cases.

**Architecture:** Runner policy narrows to genuine device loss with causality and explicit opt-in; harness pages with a DPR attribute get their own browser; two pure modules (`runtime/comparison-selection.ts`, `components/pane-encoding.ts`) hold the decisions the views make, tested with node:test; the compositor loses its private projection.

**Tech Stack:** TypeScript/React, node:test (`--experimental-strip-types`), the parity runner (`node scripts/test-harness.mjs`), all from `ui/`.

**Spec:** `docs/superpowers/specs/2026-09-06-review-fixes-design.md`

## Global Constraints

- No change to comparison operations, catalogue, capability shape, kernels, or the CPU paint path.
- Projection is read-time only; the settings store is never rewritten by a projection; HOME restores authored settings.
- `operationId` in `ImageComparisonInput` must be a member of `operationOptions`.
- Run from `ui/`: `npm run typecheck && npm test && npm run check:plot-boundary` after every task; the named harnesses per task.
- Commit trailers on every commit:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_018R6F9Ys9R5Htmq6K7oL6gf`.

---

### Task 1: Runner honesty

**Files:**
- Modify: `ui/scripts/test-harness.mjs` (`withPage` poll, `deviceLossEvents`, `downgradeIfDeviceLost`, `runHarness`, main loop filters, attribute parsing, summary)
- Modify: `ui/scripts/test-harness-selftest.mjs`
- Modify: `.github/workflows/ci.yml` (harness job env)

**Interfaces:** Produces `downgradeIfDeviceLost(r, { softwareAdapter, allowSkips, losses })` and `parseHarnessAttributes(html)` exported for the selftest (the runner may `export` them and guard `main()` with `if (import.meta.url === pathToFileURL(process.argv[1]).href)`).

- [ ] **Step 1: Selftest cases first.** Add to `test-harness-selftest.mjs` cases that import the two functions and assert: (a) `{verdict:"fail", verdictAt: 1000}` with `losses=[{reason:"unknown", t: 500}]`, software, allowSkips → `verdict:"pass"`, `deviceLost:true`, result starts with `SKIPPED — WebGPU device lost`; (b) same with `reason:"destroyed"` → unchanged; (c) `losses` containing only a `webgpu-backend-fallback` event (the function must ignore kinds other than `webgpu-device-lost`) → unchanged; (d) `allowSkips:false` → unchanged; (e) `t: 1500` (after the verdict) → unchanged; (f) `parseHarnessAttributes('<!-- data-cairn-harness="quarantined" --><html lang="en" data-cairn-harness-dpr="2"><body>')` → `{quarantined:false, dpr:2, ...}`; (g) the runner run with `--only zzz-nomatch` exits non-zero and prints `no harness selected`.
- [ ] **Step 2: Run the selftest, expect failures.** `npm run test:harness:selftest`.
- [ ] **Step 3: Implement.** Poll snapshot adds `now: performance.now()`; `runHarness` records `verdictAt: snap.now`. `deviceLossEvents` returns `(window.__cairnContextLossEvents||[]).filter(e => e.kind === 'webgpu-device-lost').map(e => ({kind: e.kind, reason: e.detail && e.detail.reason, message: e.detail && e.detail.message, t: e.t}))`. `downgradeIfDeviceLost` per spec §3.1 (kind filter again inside the function so the selftest can pass mixed arrays). `allowSkips` from `HARNESS_ALLOW_DEVICE_LOSS_SKIPS === "1"`; when a software adapter is detected and skips are not allowed, print a yellow line saying device loss will FAIL. Attribute parsing from the first `/<html\b[^>]*>/i` match. After the quarantine/interaction/`HARNESS_SKIP` filters: `if (harnesses.length === 0) die("no harness selected after filters")`; in a default run (`!ONLY && !RUN_ALL && !process.env.HARNESS_SKIP`) `if (parityCount < Number(process.env.HARNESS_MIN_PARITY ?? 10)) die(...)`. Summary line: `N page(s) downgraded to SKIP (device lost on the software adapter)` when N > 0. In `.github/workflows/ci.yml`, on the harness job's run step add `env: HARNESS_ALLOW_DEVICE_LOSS_SKIPS: "1"` with a comment: `# ubuntu runners have no GPU; SwiftShader loses the device under load. A loss is reported as a loud SKIP, never a backend fallback or an ordinary destroy.`
- [ ] **Step 4: Verify.** `npm run test:harness:selftest`; `node scripts/test-harness.mjs --only cpu-gesture-cost`; `HARNESS_FORCE_STRATEGY=swiftshader HARNESS_ALLOW_DEVICE_LOSS_SKIPS=1 node scripts/test-harness.mjs --only enlarge-channel` (expected: FAIL now, since no genuine loss is recorded locally; report the outcome, do not force it to pass).
- [ ] **Step 5: Commit** `Narrow the harness device-loss skip to genuine losses with explicit opt-in`.

---

### Task 2: Per-DPR browser and a loud DPR gate

**Files:**
- Modify: `ui/scripts/test-harness.mjs` (`launchChrome`, main loop grouping, `withPage` opts)
- Modify: `ui/src/plots/image/cpu/__tests__/cpu-label-alignment.browser.ts` (`dprSituation`, its call site)

- [ ] **Step 1:** Group `harnesses` by `dpr` (`null` first). For each non-null dpr launch a second Chromium via `launchChrome(chrome, [...gpuFlags, `--force-device-scale-factor=${dpr}`])`, run that group's pages through the same `runHarness`, then kill it. Remove the `Emulation.setDeviceMetricsOverride` path and the `{dpr}` option of `withPage`. Print `• launching Chromium at device scale factor 2 for N page(s)`.
- [ ] **Step 2:** In the alignment harness, `dprSituation(measuredRatio)` returns `{ok: Math.abs(measuredRatio - window.devicePixelRatio) <= 0.01, text}` and the call site reports `report(ok, "BENCH: ...")` (currently `report(true, …)`). The HTML comment in `cpu-label-alignment.browser.html` describing the old mismatch case is rewritten to describe the forced scale factor.
- [ ] **Step 3: Verify.** `node scripts/test-harness.mjs --only cpu-label-alignment`: the dpr-2 page prints `effective ratio 2` and its cases pass with label-vs-texel ≤ 1 px at DPR 2; the dpr1 page unchanged. Full `npm run test:harness` still 35/35 (compare-pass quarantined until Task 5).
- [ ] **Step 4: Commit** `Run DPR harness pages in a browser at that device scale factor`.

---

### Task 3: One comparison-selection helper; compareModified on CPU; defaults from cell defaults

**Files:**
- Create: `ui/src/plots/image/runtime/comparison-selection.ts`, `comparison-selection.test.ts`
- Modify: `ui/src/plots/image/runtime/view.tsx`, `compare-compositor.tsx`, `host-presentation.ts`, `contracts.ts` (`ImageComparisonInput.operationOptions` required; `compareModified` doc), `operation-display-defaults.ts` (no signature change)
- Modify: `ui/src/plots/image/cpu/view.tsx` (`CpuPaneSyncProps.compareModified`, both `extraModified`), `ui/src/plots/image/webgpu/view.tsx` (drop the `?? []` default for `kernelOptions`)
- Modify: `ui/src/testing/browser/renderers/gpu-image-diff.browser.ts` (pass `operationOptions`)
- Modify: `docs/API.md` (one line: `operationOptions` required on `ImageComparisonInput`)

- [ ] **Step 1: Tests first** (`comparison-selection.test.ts`, node:test) per spec §3.5, using `defineImageBackendCapabilities` with the full catalogue and with one lacking `flip-hdr`, and `comparisonMenuOptions(capabilities)` for `options`.
- [ ] **Step 2: Implement `resolveComparisonSelection`** per spec §3.3.
- [ ] **Step 3: Rewire `runtime/view.tsx`.** Replace `selectedComparisonOperation`, `comparisonProjection`, `effectiveComparisonOperation` and the `compareModified` expression with one `const sel = resolveComparisonSelection({...})`; `operationId: sel.operationId`, `mode: sel.mode`, `fallback: sel.fallback`, `compareModified: sel.compareModified`; callbacks use `previousOperation: sel.effective`; `onCompareModeChange`: `if (mode === sel.mode) return;` and `nextOperation: mode === "split" ? "split" : sel.authoredDefault === "split" ? sel.operationId : sel.authoredDefault`. `host-presentation.ts` stops deriving `defaultOperation`/`defaultSplit` from props (delete those two fields from `ImageComparisonSpec` or whatever the type is named; `cellDefaults` already exists).
- [ ] **Step 4: Rewire `compare-compositor.tsx`** to call the same helper (its inputs: the `operation` prop as `selected`, `cellDefaults` from the compositor's own settings seed if present else `{}`), delete `projectComparisonOperation` import and the `proj` block.
- [ ] **Step 5: `operationOptions` required.** Type change in `contracts.ts`; remove `?? []` at `webgpu/view.tsx` `kernelOptions` and the CPU equivalent; update `gpu-image-diff.browser.ts` to pass `comparisonMenuOptions(WEBGPU_CAPABILITIES)`.
- [ ] **Step 6: `compareModified` on CPU.** Add to `CpuPaneSyncProps`, set from `compare?.compareModified ?? false` where `compareFallback` is set, OR into both `extraModified` expressions.
- [ ] **Step 7: Verify.** typecheck, unit tests, boundary; harnesses `--only cpu-compare-fallback`, `--only gpu-image-diff`, `--only compare-settings-sync`, `--only grid-stacked`. In cairn (the user's checkout at /Users/doeringc/workspace/cairn) do NOT change anything.
- [ ] **Step 8: Commit** `Resolve the comparison selection once for the adapter and the compositor`.

---

### Task 4: Behavioural encoding test; repair the source-assertion tests

**Files:**
- Create: `ui/src/plots/image/components/pane-encoding.ts`, `pane-encoding.test.ts`
- Modify: `ui/src/plots/image/components/display-operation.ts` (`usePaneEncoding` calls `resolvePaneEncoding`)
- Delete: `ui/src/plots/image/runtime/read-time-projection.test.ts`
- Modify: `ui/src/plots/image/runtime/no-kernel-ids.test.ts`, `backend-capabilities.test.ts`

- [ ] **Step 1:** `pane-encoding.test.ts` per spec §3.4 (four cases). Implement `resolvePaneEncoding`; the hook computes `const { effective, fallback, modified } = resolvePaneEncoding({ rawId: rawEncodingId, seedId: seedFor(arity), capabilities })` and uses them for `displayOperationId`, `fallback`, `displayOperationModified`.
- [ ] **Step 2:** Delete `read-time-projection.test.ts` (its intent is now covered by Task 3's and this task's behavioural tests; say so in the commit message).
- [ ] **Step 3:** `no-kernel-ids.test.ts`: comment stripping = remove `/* ... */` blocks and lines whose first non-space chars are `//`; pattern `/["'`](hdr-flip|flip-sdr)["'`]/`; root = `ui/src` (`new URL("../../../", import.meta.url)`), skip any path containing `/plots/image/webgpu/` and `.test.ts`/`__tests__`; add `assert.ok(existsSync(join(root, "settings/schema.ts")), "scan root is ui/src")`.
- [ ] **Step 4:** `backend-capabilities.test.ts` "complete backend object": replace the three loose regexes with exact `id: "cpu"`/`id: "webgpu"`, `View: CpuImagePane`/`View: GpuImagePane`, `capabilities: CPU_CAPABILITIES`/`capabilities: WEBGPU_CAPABILITIES` (read the two backend files for the exact identifiers first).
- [ ] **Step 5: Verify** typecheck, unit tests, boundary. **Commit** `Test the read-time projections behaviourally`.

---

### Task 5: Split `compare-pass`

**Files:**
- Investigate: `ui/src/plots/image/webgpu/__tests__/compare-pass.browser.{html,ts}`, `ui/src/plots/image/webgpu/image-engine.ts` (`renderCompose`), `diff-engine.ts`
- Create: `ui/src/plots/image/webgpu/__tests__/diff-display.browser.{html,ts}`
- Delete: `compare-pass.browser.{html,ts}` (and `renderCompose` + its shader if no product caller)

- [ ] **Step 1: Triage.** Run `node scripts/test-harness.mjs --all --only compare-pass`. Determine why direct-op readbacks (`[diff/*]`, `[diff-display/*]`, `[unify/*]`) return `actual=0`: compare the harness's calls against the current `computeDiff`/`renderDiffDisplay` signatures and the way `gpu-image-diff.browser.ts` drives the product path. Write the finding into the report BEFORE changing anything. If the cause is a product defect (not harness drift), STOP and return status BLOCKED with the evidence.
- [ ] **Step 2:** Confirm with `grep -rn renderCompose ui/src` that `renderCompose` has no product caller; if so delete it and its compose shader/pipeline code and the split/blend/unify cases. If it has a caller, keep it and keep its cases out of the new harness but note it.
- [ ] **Step 3:** Create `diff-display.browser.ts` with the `[metrics]`, `[diff/*]`, `[diff-display/norm=*]`, `[diff-display/analytic*]`, `[diff-display/none-hdr]` cases adapted to the current API so they PASS on a hardware adapter; same page attributes as `flip.browser.html`; register nothing else (the runner auto-discovers).
- [ ] **Step 4:** Delete `compare-pass.browser.{html,ts}`. Verify `node scripts/test-harness.mjs --only diff-display` PASS, and `npm run test:harness` has no quarantined `compare-pass` and no new failures.
- [ ] **Step 5: Commit** `Re-home the live compare-pass proofs into diff-display`.
