# Image info panel — tev-style histograms, auto-show, GPU compute

Design agreed 2026-08-25 (user-ruled choices marked ✓).

## Goals

1. The in-pane histogram becomes an **info panel**: a sectioned floating
   overlay (✓ option B — same corner placement as today) that can carry more
   than the value histogram.
2. **Auto-show** (✓ rule A): shown by default iff its natural width ≤ 25% of
   the pane's width, evaluated live. The FIRST manual toggle takes over
   permanently for that viewport — an explicit choice outranks the heuristic,
   including "open anyway" on a too-small pane.
3. **Higher resolution**: 400 bins (tev parity), up from 96.
4. **Deep-Z sources** additionally show a **depth histogram** (✓ option B —
   alpha-weighted over sample z, symmetric-log axis).
5. Histograms are computed by **GPU kernels** (WebGPU panes), CPU fallback
   keeps bin-for-bin parity.

## The tev port (verified against Tom94/tev `src/ImageCanvas.cpp`)

- 400 bins; symmetric-log₂ mapping with regularization `a = 0.001`:
  `symlog(v) = sign(v) · (log₂(|v| + a) − log₂(a))`, over the data's actual
  min→max (shared across channels).
- Binned over RAW channel values (not exposure/display-adjusted) → content-
  keyed cacheable; recompute only on source change.
- Per-channel series (R/G/B separate; alpha excluded from defaults).
- Display normalization: counts → density (÷ bin width in value space), then a
  percentile cap — the top `(1 + bins/128) · nSeries` density values are
  excluded from the max; scale = `1 / (max(next, 0.1) · 1.3)` — so a single
  spike cannot flatten the plot.
- tev reads every pixel (CPU threads); we do the same on the GPU.

## Architecture

- **`image/histogram-binning.ts`** — the pure tev-port math (mapping, bin
  edges, normalization, stats). DOM-free, unit-tested against the formulas
  above. Single source of truth for CPU and GPU paths.
- **Panel** (`primitives/ImageInfoPanel.tsx`, evolving `ImageHistogramOverlay`)
  — sections: per-channel min/mean/max stats row; value histogram; depth
  histogram (deep only); per-pixel deep sample readout (existing). Harness
  data-attributes are preserved.
- **Visibility = a viewport setting** `infoPanel?: boolean` in
  `ImageSyncSettings`. Absent = auto (25% rule, measured by the shell);
  explicit toggle writes `true`/`false` through the settings stack — syncs
  across a selection, transient per layer, HOME clears back to auto.
- **GPU compute** (M2): two WGSL passes on the pool-owned texture — min/max/
  mean reduction, then atomic binning into 400×k bins — content-keyed cached in
  the pool (like the diff cache), exposed as a kernel-agnostic
  `PaneHandle.computeHistogram()`; tiny readback; final display normalization
  on CPU. Deep depth histogram: a kernel over the deep CSR z+alpha buffers
  (alpha-weighted, fixed-point atomics).
- **CPU fallback** — the existing reader loop, switched to the shared binning
  module.

## Milestones

- **M1**: pure module + panel sections + stats row + 400 bins + auto-show
  setting; CPU compute upgraded to tev math (subsample budget retained).
- **M2**: GPU kernels + pool cache + full-pixel coverage + deep depth
  histogram.
