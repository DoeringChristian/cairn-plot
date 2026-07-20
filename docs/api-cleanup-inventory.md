# API cleanup inventory (0.1)

Full simplification pass over the standalone `cairn-plot` repo. Backwards
compatibility is **waived** — the deliverable is a clean, well-defined public
API. This document is the sweep of every legacy/compat construct found, with a
REMOVE / RENAME / KEEP verdict for each. Execution follows in later commits;
the defined surface is written up in `docs/API.md`.

## Baseline gates (before any change — all green)

| Gate | Result |
| --- | --- |
| `tsc -b --noEmit` | 0 errors |
| `node --test **/*.test.ts` | 76 pass / 0 fail |
| `check:plot-boundary` | OK (178 surface files) |
| `check:plot-schema` | OK |
| `check:plot-assets` | OK (5 files in sync) |
| `pytest tests/` | 83 passed |
| `smoke:plot` | 22/22 |
| examples (3) | all render |

---

## REMOVE

### TS-1 — `renderers/ImagePane.tsx` (thin compatibility shim)
Header literally reads `THIN COMPATIBILITY SHIM over CpuImagePane`. It is a
`(props) => <CpuImagePane {...props} toolbar={false} />` forwarder plus a
`ImagePaneProps` interface duplicating the SDR backend prop shape.
- **Consumers:** `media-compare/compositor.tsx` (default import); `renderers/index.ts`
  barrel; `lib/cairn-plot/index.ts` barrel. No test imports it as a module (only
  comment references).
- **Action:** delete the file. Migrate `compositor.tsx` to `CpuImagePane` with an
  explicit `toolbar={false}` at each of the 3 call sites (preserving the exact
  pre-unification chrome the shim provided). Drop the barrel re-exports.

### TS-2 — `renderers/HdrImagePane.tsx` (thin compatibility shim)
Header reads `THIN COMPATIBILITY SHIM over CpuImagePane`. Forwards
`<CpuImagePane {...props} toolbar={false} />`; re-exports `tonemapToImageData`
(which actually lives in `CpuImagePane.tsx`) and the `HdrData` type (which lives
in `image-backend.ts`), plus a `HdrImagePaneProps` interface.
- **Consumers:** `renderers/index.ts` + `lib/cairn-plot/index.ts` barrels only
  (`plot-renderers.tsx` already imports `CpuImagePane` directly).
- **Action:** delete the file. `tonemapToImageData` stays in its real functional
  home (`CpuImagePane.tsx`, the only pane that uses it) and is re-exported from the
  barrel from there. `HdrData` is re-exported from its canonical home
  (`image-backend.ts`). Drop `HdrImagePaneProps` (unused public alias of the
  backend HDR prop shape).

### TS-3 — `renderers/GpuImagePane.tsx` "historical name" re-exports + aliases
```
export type { HdrData, HdrGpuImagePaneProps, SdrGpuImagePaneProps };  // "historical names"
export type GpuImagePaneProps = ImageBackendProps;                     // alias
export type ImageRenderProps = GpuImagePaneProps;                      // alias-of-alias
```
The canonical names already live in `renderers/image-backend.ts`.
- **Action:** delete all four re-exports/aliases. `GpuImagePane` uses
  `ImageBackendProps` (the canonical union) internally; every prop cast switches to
  the renamed canonical prop types (see RENAME-1). No file imports
  `GpuImagePaneProps` / `ImageRenderProps` (grep-verified — only self-references).

### TS-4 — `plot-bootstrap.tsx` `normalizeDescriptor` legacy-flat shim
Lifts a pre-G1 flat descriptor `{renderer,props,data,…}` → the G1 tree
`{root:{kind:"plot",…}}`. The standalone library has **no** pre-tree emitter:
Python always emits `PlotDescriptorSpec(root=…)` (verified in
`components.py`/`report.py`/`spec.py`; schema requires `root`).
- **Action:** delete `normalizeDescriptor`; the 3 call sites parse the descriptor
  directly. Tree root form is the only accepted descriptor. Update the stale
  "legacy-flat shim" comment in `plot-node.tsx`.

### PY-1 — `Scalar = Line` deprecated alias
`components.py` defines `Scalar = Line` ("deprecated pre-G2 name"); `__init__.py`
imports/exports it (`__all__` comment: `# deprecated alias == Line`) and the
`scalar()` builder calls `Scalar(...)`.
- **Action:** remove the `Scalar` alias, the import, and the `__all__` entry. Point
  the `scalar()` lowercase builder at `Line(...)`. (The lowercase `cp.scalar`
  builder itself is a real, documented builder — KEPT, just retargeted.) Update
  docstrings that name `cp.Scalar`.

### PY-2 — error strings naming the wrong package
Two `ImportError` messages tell the user to `pip install cairn-track[media]` for
optional Pillow/Plotly. The optional deps belong to **this** library's own `media`
extra (present in `pyproject.toml`).
- `shapers.py:491` — raw PIL/ndarray image needs Pillow.
- `recipes.py:45` — figure recipes need Plotly.
- **Action:** normalize both to `pip install cairn-plot[media]` and correct the
  `cairn.plot.*` API prefixes to `cairn_plot.*`. Update the one test that asserts
  the old string (`tests/test_plot_helpers.py:365`).

### TS-5 / PY-3 — barrel pruning
- `renderers/index.ts`: drop `ImagePane`/`ImagePaneProps` + `HdrImagePane`/
  `HdrImagePaneProps` exports; export the renamed backend prop types
  (`HdrImageProps`/`SdrImageProps`); keep `tonemapToImageData` sourced from
  `CpuImagePane`.
- `lib/cairn-plot/index.ts`: drop `ImagePane`/`HdrImagePane`/`HdrImagePaneProps`;
  expose the intentional image surface instead — `CpuImagePane` + the backend
  contract (`isHdrProps`, `resolveRenderMode`, types `ImageBackend`,
  `ImageBackendProps`, `RenderMode`, `HdrImageProps`, `SdrImageProps`, `HdrData`)
  and `tonemapToImageData`.
- Other barrels (`primitives/index.ts`, `hooks/index.ts`): every entry has a live
  consumer (grep-verified) — no dead entries to prune.

---

## RENAME

### RENAME-1 — honest canonical prop names in `image-backend.ts`
The shared backend prop shapes are misnamed after `GpuImagePane` even though both
the CPU and GPU backends (and the seam) share them:
- `HdrGpuImagePaneProps` → **`HdrImageProps`**
- `SdrGpuImagePaneProps` → **`SdrImageProps`**

One name each, applied everywhere (`image-backend.ts` definition, `CpuImagePane.tsx`,
`GpuImagePane.tsx`, barrels). `HdrData`, `ImageBackendProps`, `ImageBackend`,
`isHdrProps`, `RenderMode`, `resolveRenderMode` already have honest names — kept.

---

## KEEP (judged load-bearing, not legacy workarounds)

- **`media-compare/migrate-legacy-mode.ts`** (`migrateLegacyMode`,
  `LEGACY_MODE_MIGRATION_TABLE`, `LegacyModeInputs`) — a real, table-driven
  **settings-migration-on-read feature** for end-user saved compare-mode configs,
  not a code-level compat shim over a newer API. Deleting it removes functionality.
  Kept and exported as an intentional part of the media-compare surface.
- **CPU `MediaComparePane` / compositor compare path** — the genuine no-WebGPU
  fallback for split/blend/diff. Not legacy.
- **Pure-TS EXR reader** (`image/decoders/exr-full.ts`) — the genuine no-worker
  fallback. Not legacy.
- **`GpuImagePane` engine-failed → `CpuImagePane` self-heal** — real
  defense-in-depth (blank-card avoidance), not compat.
- **`components.py` `_resolver` "needs the full cairn-track install" message** —
  an *accurate* reference to the real separate `cairn-track` package that owns the
  `run[tag]` tracking resolvers; standalone `cairn-plot` genuinely does not ship
  them. Kept (wording is correct).
- **`Report` / `PlotReport`** — `Report` is the ergonomic public name, `PlotReport`
  the class. An intentional alias, not a legacy workaround. Both kept.
