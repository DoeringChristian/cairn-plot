# Review fixes: CI honesty and comparison-seam correctness

Status: v1 (2026-09-06). Implemented on branch `review-fixes` off main
(431b5df). Source: the six-reviewer adversarial review of be4600c..431b5df
(consolidated findings C1, H1–H4, H9–H11, caps M2/M5, webgpu M2).
Owner: cairn-plot.

## 1. Problem

The review found that the parity-harness runner can report a real failure as
a pass, that a green run does not imply a run, that two guard tests are
vacuous, that the DPR-2 alignment page proves nothing beyond the DPR-1 page,
that the `compare-pass` quarantine reason is false and removed the only
metrics parity proof, and that the comparison seam has three correctness
gaps: `compareModified` never reaches the CPU pane, the compare defaults read
props the builders move into settings, and the compositor carries its own
diverging copy of the fallback projection.

## 2. Goals and non-goals

Goals:

- A harness FAIL on CI is a FAIL unless the WebGPU device was genuinely lost
  (reason other than `destroyed`) before the verdict, on a software adapter,
  and the workflow has opted into that downgrade explicitly. A backend
  fallback never downgrades.
- The runner refuses to pass an empty or implausibly small default run, and
  reads page attributes from the opening `<html>` tag only.
- Pages declaring `data-cairn-harness-dpr` run in a browser launched with
  that device scale factor, and fail loudly if the measured ratio differs.
- The read-time-only split and the raw-versus-effective distinction are
  tested behaviourally through pure functions; source-regex tests are either
  removed or made comment-safe and quote-agnostic with a pinned scan root.
- One comparison-selection helper serves the host adapter and the
  compositor; `operationId` is always a member of `operationOptions`;
  `operationOptions` is required on `ImageComparisonInput`; the mode-menu
  guard and the settings patch reason about the effective operation.
- `compareModified` reaches both panes; compare defaults come from the cell
  defaults the adapter already computes.
- `compare-pass` is split: dead `renderCompose`/blend cases deleted with the
  dead export if it has no product caller, live metrics and diff-display
  cases re-homed into a passing harness, quarantine removed.

Non-goals: no change to comparison operations, catalogue, capabilities'
public shape, kernels, or the CPU paint path. The remaining review items
(bitmap cache budget, empty-source paint, overlay blit clipping, viewport
measurement space, cairn's hand-copied lists, docs) are separate work.

## 3. Design

### 3.1 Runner (`ui/scripts/test-harness.mjs`)

- The page poll snapshot returns `now: performance.now()` alongside the
  verdict. `deviceLossEvents` returns `{kind, reason, t}` for
  `webgpu-device-lost` events only. `downgradeIfDeviceLost(r, ctx)` applies
  only when `ctx.softwareAdapter && ctx.allowSkips`, `r.verdict !== "pass"`,
  and some event has `reason !== "destroyed"` and `t <= r.verdictAt`. The
  SKIPPED line names the reason and time.
- `allowSkips` = `process.env.HARNESS_ALLOW_DEVICE_LOSS_SKIPS === "1"`. The
  CI workflow sets it on the harness job with a comment stating that the
  runner has no GPU. Without it, device loss stays a FAIL.
- The summary prints the number of downgraded pages; `ghAnnotate("warning")`
  per downgraded page is kept.
- After all filters, zero selected harnesses is a `die(...)`. In a default
  run (no `--only`, no `--all`, no `HARNESS_SKIP`) fewer than
  `HARNESS_MIN_PARITY` (default 10) parity pages is also a `die(...)`.
- Page attributes are read from the opening `<html …>` tag (first match of
  `/<html\b[^>]*>/i`), never from the whole file.
- `test-harness-selftest.mjs` gains cases: downgrade accepted (software,
  opted in, reason `unknown`, before verdict); rejected for reason
  `destroyed`; rejected for `webgpu-backend-fallback`; rejected when not
  opted in; rejected when the event is after the verdict; empty set dies.

### 3.2 Per-DPR browser

Harnesses are grouped by `dpr` (`null` → default). Each distinct non-null
dpr launches its own Chromium with `--force-device-scale-factor=<dpr>` (same
strategy flags), runs its pages, and closes. The CDP metrics override is
removed. `cpu-label-alignment.browser.ts`'s `dprSituation` reports FAIL when
the effective ratio differs from `window.devicePixelRatio` by more than 0.01;
the DPR-2 page must then report ratio 2 and pass.

### 3.3 Pure comparison-selection helper (`runtime/comparison-selection.ts`)

```ts
export interface ComparisonSelectionInput {
  selected: string | undefined;          // settings["compare.operation"]
  presentation: "split" | "difference";  // authored
  cellDefaults: { "compare.operation"?: string; "compare.split"?: number };
  splitSetting: number | undefined;      // settings["compare.split"]
  options: readonly { id: string; label: string }[];  // catalogue ∩ backend, 2-input non-split
  capabilities: ImageOperationSupport;
}
export interface ComparisonSelection {
  raw: string;               // what the store/authoring says (never projected)
  effective: string;         // what renders: raw, or "split" when unsupported
  mode: "split" | "diff";
  operationId: string;       // ∈ options ids (or options[0] when effective is split / unsupported)
  fallback: CapabilityFallback | null;
  compareModified: boolean;  // raw !== authored default || split !== default split
  authoredDefault: string; defaultSplit: number;
}
export function resolveComparisonSelection(i: ComparisonSelectionInput): ComparisonSelection;
```

`authoredDefault` = `cellDefaults["compare.operation"]` ?? (presentation ===
"split" ? "split" : options[0]?.id ?? "split"); `defaultSplit` =
`cellDefaults["compare.split"]` ?? 0.5. `operationId` = effective when
effective ∈ options, else the first supported option, else `split` (and
`mode` follows). `host-presentation.ts` drops `defaultOperation`/`defaultSplit`
in favour of `cellDefaults` passthrough. `runtime/view.tsx` and
`compare-compositor.tsx` both call the helper; the compositor's own projection
is deleted. `onCompareModeChange` returns early when `mode ===
selection.mode` (effective). `comparisonOperationSettingsPatch` receives
`previousOperation: selection.effective`. `ImageComparisonInput.operationOptions`
becomes required; `compareModified` is threaded into `CpuPaneSyncProps` and
both CPU shells' `extraModified`.

### 3.4 Pure pane-encoding resolution (`components/pane-encoding.ts`)

```ts
export function resolvePaneEncoding(i: { rawId: string; seedId: string; capabilities: DisplayOperationSupport }):
  { effective: string; fallback: CapabilityFallback | null; modified: boolean };
```
`usePaneEncoding` calls it. Unit tests cover: supported id → identity, not
modified when raw equals seed; unsupported colormap → turbo with fallback
record, `modified` still compares raw to seed.

### 3.5 Tests

- `runtime/comparison-selection.test.ts`: HOME of an authored
  `flip_hdr`/split 0.3 node → `compareModified false`; user change → true;
  unsupported raw → effective split, `operationId ∈ options`, fallback
  record; empty options → `split`; presentation split with no selection →
  `raw === "split"`.
- `read-time-projection.test.ts` is deleted.
- `no-kernel-ids.test.ts`: strips `/* */` and full-line `//` only, matches
  `["'\`]hdr-flip["'\`]` and `flip-sdr`, walks `ui/src` skipping
  `plots/image/webgpu`, and asserts the scan root contains `ui/src/settings`.
- `backend-capabilities.test.ts` "complete backend object": match
  `id: "cpu"` / `id: "webgpu"`, `View: CpuImagePane` / `View: GpuImagePane`,
  `capabilities: CPU_CAPABILITIES` / `WEBGPU_CAPABILITIES` exactly.
- `compare-pass`: see goals; the re-homed harness is `webgpu/__tests__/diff-display.browser.{html,ts}`.

## 4. Compatibility

No public API change. `ImageComparisonInput.operationOptions` becoming
required affects direct embedders of a backend pane (a documented seam);
`docs/API.md` notes it. CI behaviour: device-loss skips require the explicit
env opt-in; the workflow sets it.
