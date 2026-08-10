/**
 * Framework-free MULTI-VIEWPORT SELECTION store — one selection set per grid.
 *
 * A grid (`plot-node.tsx`'s `GridView`) owns a `SelectionStore` keyed by its
 * stable grid id. Each sibling pane registers a stable `paneId` and can be
 * selected by a click. Selection is the switch that decides WHICH panes are in
 * a live sync group: while ≥2 panes are selected, the React layer threads a
 * shared viewport-sync group id (`image-viewport-sync.ts`) and settings-sync
 * group id (`image-settings-sync.ts`) into every selected pane, so zoom/pan and
 * display-setting changes broadcast across the whole selected group.
 *
 * Selection semantics (locked design):
 *   - a PLAIN click selects ONLY that pane (replaces any prior selection);
 *   - a SHIFT / CTRL / META (cmd) click ADDS / TOGGLES the pane in the set;
 *   - the FIRST element of the ordered set is the ANCHOR — the pane whose
 *     current view + settings a newly-added member adopts (so the group visibly
 *     aligns on add). Order is insertion order; a plain click makes the clicked
 *     pane the sole (and therefore anchor) member.
 *
 * Intentionally React-free (a plain object + listener set) so it is
 * unit-testable without a DOM/React harness and reusable by any viewport type,
 * mirroring `image-viewport-sync.ts`'s framework-free bus. The React binding
 * (a context + `useSyncExternalStore`) lives in `plot-node.tsx`.
 */

export type SelectionListener = () => void;

/** How a click modifies the selection — derived from the pointer event's
 *  modifier keys by the React layer (`shift || ctrl || meta`). */
export type SelectionMode = "replace" | "toggle";

export class SelectionStore {
  /** Ordered selected pane ids; `selected[0]` is the ANCHOR. */
  private selected: readonly string[] = [];
  private listeners = new Set<SelectionListener>();

  /** The current ordered selection (stable reference between mutations, so it
   *  is safe as a `useSyncExternalStore` snapshot). */
  getSelected(): readonly string[] {
    return this.selected;
  }

  isSelected(id: string): boolean {
    return this.selected.includes(id);
  }

  count(): number {
    return this.selected.length;
  }

  /** The anchor pane (first selected), or `null` when nothing is selected. */
  anchor(): string | null {
    return this.selected[0] ?? null;
  }

  /**
   * Apply a click to `id`:
   *   - `"replace"` (plain click): the selection becomes exactly `[id]`.
   *   - `"toggle"` (shift/ctrl/meta click): `id` is removed if present, else
   *     appended (kept in insertion order so the anchor is stable).
   * A no-op mutation (replace onto the identical sole selection, or toggling
   * with no observable change) still short-circuits so no listener fires.
   */
  select(id: string, mode: SelectionMode): void {
    let next: readonly string[];
    if (mode === "toggle") {
      next = this.selected.includes(id)
        ? this.selected.filter((x) => x !== id)
        : [...this.selected, id];
    } else {
      // Plain click collapses any prior multi-selection down to just `id`.
      if (this.selected.length === 1 && this.selected[0] === id) return;
      next = [id];
    }
    this.selected = next;
    this.emit();
  }

  /** Clear the whole selection (e.g. a click on empty grid background). */
  clear(): void {
    if (this.selected.length === 0) return;
    this.selected = [];
    this.emit();
  }

  /**
   * Drop any selected ids not in `validIds` — called when panes unmount so a
   * stale id can never keep a phantom member in the group. No-op (no emit)
   * when every selected id is still present.
   */
  prune(validIds: ReadonlySet<string>): void {
    const next = this.selected.filter((id) => validIds.has(id));
    if (next.length === this.selected.length) return;
    this.selected = next;
    this.emit();
  }

  subscribe(fn: SelectionListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

const stores = new Map<string, SelectionStore>();

/** The `SelectionStore` for a grid id, created on first use. One store per
 *  grid keeps selection scoped to a single grid's sibling panes (the design's
 *  explicit scope — cross-grid selection is a later extension). */
export function getSelectionStore(gridId: string): SelectionStore {
  let s = stores.get(gridId);
  if (!s) {
    s = new SelectionStore();
    stores.set(gridId, s);
  }
  return s;
}

/** Forget a grid's store (grid unmount) so it can't leak across a remount. */
export function disposeSelectionStore(gridId: string): void {
  stores.delete(gridId);
}
