# Stacked viewport = one surface, many cached slots

**Goal:** A stacked grid (and the stacked compare/enlarge stage) is ONE long-lived
renderer showing the active source, not N hidden panes. Flipping tabs swaps the
source on a live surface — no `display:none`, no park/restore, no "Loading…"
flash. Settings + camera are shared *by construction* (one instance), not synced.

## Model

The viewport is the long-lived surface. It shows the **active** source out of a
set. A single image is the degenerate 1-slot case; a stack is N slots; a normal
grid is N separate 1-slot viewports side by side. The ▦/▭ toggle just regroups
the same sources: *N viewports × 1 slot* ⇄ *1 viewport × N slots*.

Per-slot state is only the **data**; everything else (colormap, tonemap,
exposure, kernel, mode, zoom/pan) lives on the viewport and is shared. So caches
are keyed by **data only** (`sourceKey`), never by settings.

Caches (two tiers, different lifetimes):
- `decoded`  — CPU/worker decode, keyed by `sourceKey`. Cheap; prefetch all slots.
- `textures` — GPU upload, small LRU. (Phase D — optimization, not required for
  flicker-free flips: a texture upload on a *live* surface is fast and blank-free;
  the old flicker was park/restore + 0-size remeasure from `display:none`.)
- `diffs`    — compare only, keyed by `(aKey,bKey,kernel)` (already exists w/ caps).

## Constraint

Stacked mode requires **homogeneous** children (all the same renderer kind). Mixed
stacks are not supported: the ▭ toggle is hidden when children aren't homogeneous.

---

## Phase A — resolution cache + prefetch  (core, low-risk)  ← THIS SLICE

- `lib/cairn-plot/resolve-cache.ts`: `sourceKey(obj)` (WeakMap → stable id),
  `peekResolved(key)`, `resolveCached(key, run)`, `prefetchResolved(entries)`.
- `LeafView` / `CompareLeafView`: key by the node, seed `state` synchronously from
  `peekResolved` (instant swap on a cached/prefetched tab); never reset to
  "loading" on a node swap (keep the old frame until the new resolves).

## Phase B — stacked = one reused renderer  (core)  ← THIS SLICE

- `GridView` stacked branch renders ONLY `children[active]` through one
  `PlotNodeView` at a **stable key** (`"stack-slot"`), wrapped in
  `InStackedGridContext`, + the existing tab strip. `paneId` is process-stable, so
  the whole chain is reused and only the source swaps.
- Homogeneity gate: `canStack = children.length > 1 && homogeneous(children)`;
  the ▭ toggle only shows then.
- Prefetch all children's data on mount.
- Keep `StackedPanes` (now the `visibility` overlay, not `display:none`) ONLY as
  the stage's path for now.

## Phase C — verify  ← THIS SLICE

- Real split-bundle browser test (JS API): flip a stacked image grid + a stacked
  compare grid; assert the renderer instance is REUSED (same canvas element), no
  "Loading…" text appears, split/settings persist.
- Harness: `grid-stacked` still green (attributes unchanged).

## Phase D — follow-ups (staged, not this slice)

- Migrate the stage stacked branch to the single-renderer coordinator; then delete
  `StackedPanes`.
- `textures` LRU keyed by `sourceKey` inside the image pane (avoid even the single
  re-upload); same win speeds up step-slider scrubbing.
- Optional `cp.Flip([...])` sugar over `grid(mode="stacked")`.
