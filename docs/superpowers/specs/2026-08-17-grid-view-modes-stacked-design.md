# Grid view modes — normal & stacked — Design

**Goal:** A grid gains a **view mode**: `normal` (today's uniform grid) or
`stacked` (show ONE child at a time with a tab strip to flip between them, via
click / arrows / hjkl / number / letter keys). It's a pure *view* toggle over the
same children, so it works everywhere a grid does — `cp.Grid` **and** the
compare/enlarge stage.

**Why:** A very common task is flipping between multiple images to spot
differences. Stacked mode makes that a first-class, keyboard-driven interaction
and (when the grid opts into viewport sync) a true A/B at the same zoom/region.

## Resolved decisions

- **Flip sync:** follow the grid's existing `shared.sync.viewport`. Synced ⇒
  flipping is A/B at the same zoom/pan; unsynced ⇒ each view keeps its own.
- **Set/switch:** Python `cp.Grid(..., mode="normal"|"stacked")` (default
  `"normal"`) **plus** a live UI toggle on the grid.
- **Scope:** `cp.Grid` AND the compare/enlarge stage in this build.
- **Key conflict:** in a stacked grid, arrows/hjkl switch **tabs**; a compare
  cell's slide-flip moves to **Shift+←/→** (and Shift+h/l).
- **Toggle visibility:** always present but subtle (fades in on hover), so it's
  discoverable but not clutter. Hidden when the grid has a single child (stacking
  a lone child is a no-op).

## Architecture

`stacked` is a new value of a `mode` field on the grid — nothing about the
children changes. The regular grid (`GridView`) and the stage (`StageContent`)
each render EITHER their existing normal layout OR a shared **`StackedView`**
that shows the active child + a **`StackTabStrip`**. A shared
**`useStackNavigation`** hook owns the active index and the keyboard/number/letter
navigation; a shared **`GridModeToggle`** renders the `normal | stacked` control.

```
GridNode.mode: "normal" | "stacked"      (default "normal")
        │
        ├── normal  → existing GridView / stage layout (unchanged)
        └── stacked → <StackedView>
                        <StackTabStrip active=i onSelect=… labels=[…]/>
                        <div>  child[i] visible; child[≠i] display:none  </div>
                      + useStackNavigation() keyboard
```

### Files

- `ui/src/lib/cairn-plot/plot-descriptor.ts` (or `plot-descriptor` types file):
  `GridNode` gains `mode?: "normal" | "stacked"`.
- `src/cairn_plot/components.py`: `Grid(..., mode: str = "normal")` → emits
  `node["mode"]` when not `"normal"`. Validate against `{"normal","stacked"}`.
- `schema/cairn-plot-contracts.json`: add `mode` to the grid node contract.
- **New** `ui/src/lib/cairn-plot/stack/use-stack-navigation.ts`: active-index
  state + a `window` keydown handler (scoped like `use-split-flip-keys`: hover/
  focus inline, or the fullscreen overlay). Returns `{active, setActive, count}`.
- **New** `ui/src/lib/cairn-plot/stack/StackTabStrip.tsx`: the tab strip — one
  tab per child (`<letter-badge> <label>`), active highlighted, click-to-select,
  horizontally scrollable. Labels come from a `labels: string[]` prop.
- **New** `ui/src/lib/cairn-plot/stack/GridModeToggle.tsx`: the `▦ | ▭`
  segmented control (grid / stacked).
- **New** `ui/src/lib/cairn-plot/stack/StackedView.tsx`: renders the strip +
  keeps every child mounted, only the active one visible; wires the hook.
- `ui/src/plot-node.tsx` `GridView`: branch on `node.mode` → normal grid OR
  `StackedView` wrapping the same `PlotNodeView` children; render `GridModeToggle`
  (hover-reveal, top-right) when `children.length > 1`; hold the live mode in
  view-local state seeded from `node.mode`.
- `ui/src/plot-selection-stage.tsx`: same branch for the stage; add the toggle to
  the existing `StageModeToggle` bar; the stage's cells become the stacked
  children.
- `ui/src/lib/cairn-plot/media-compare/use-split-flip-keys.ts`: (a) add `h`/`l`
  aliases; (b) accept a `requireShift` flag so a stacked grid can move the
  slide-flip onto Shift+←/→.

### Child labels

Per tab label = the child's own caption if present (`props.label` on an image /
compare leaf; a grid's own label), else `"View N"`. A small helper reads a label
off a `PlotNode` (leaf `props.label`, compare `props.label`/side labels, else
positional).

### Keyboard (in `useStackNavigation`)

Active only when the grid is the keyboard target (hover/focus inline, or the
fullscreen overlay via `InFullscreenOverlayContext`). Never steal keys from a
text field.

- **Prev:** `←` `h` `↑` `k`   •   **Next:** `→` `l` `↓` `j`
- **Number jump:** `1`–`9` → tab 1–9; `0` → tab 10.
- **Letter jump:** `a`–`z` → tab 1–26.
- **hjkl aliases** apply anywhere arrows are used (incl. the compare slide-flip).
- Wrapping: prev/next wrap around the ends.

### Sync

No new machinery: the active child mounts inside the SAME grid subtree, so it
inherits `shared.sync.viewport` exactly as a normal cell would. Because the
shared zoom/pan lives in a group store (not on one pane), keeping all children
mounted (inactive `display:none`) means a synced stacked grid flips as a true
A/B; an unsynced one keeps per-view state. No re-decode on flip (all mounted).

### Stage integration

`StageContent` renders `StackedView` over its cell specs when the stage mode is
stacked; the `enlarge|compare` toggle and the new `grid|stacked` toggle sit in
the same bar. Compare-in-stack honors the Shift+←/→ slide-flip rule.

## Testing

- `use-stack-navigation.test.ts` (node): prev/next/wrap, number & letter jump,
  text-field guard, hjkl aliases — with an injected keydown.
- Browser harness `grid-stacked.browser`: a `mode:"stacked"` grid shows one
  child + a tab strip; arrows/hjkl/number/letter switch the active tab; the
  live toggle flips normal⇄stacked; a synced stacked grid carries zoom across a
  flip; the toggle is hidden for a single-child grid.
- Extend `compare-settings-sync.browser` (or a stage harness) for stacked in the
  fullscreen stage + the Shift+←/→ compare-flip rule.
- Python: a test that `cp.Grid(mode="stacked")` emits `mode` and round-trips.

## Non-goals (v1)

Text-only tabs (no thumbnails); no auto-play/slideshow; letters cap at `a`–`z`
(numbers cover the rest); no per-tab close/reorder.
