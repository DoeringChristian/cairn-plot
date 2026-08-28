/**
 * Framework-free MULTI-VIEWPORT SELECTION store — ONE page-wide selection set.
 *
 * Every image/compare/chart pane on the page — a STANDALONE `PlotApp` mount OR a
 * grid cell — obtains the SAME document-scoped store (`getGlobalSelectionStore`
 * below) and registers a process-unique `paneId` (`nextSelectionPaneId`). A
 * click selects a pane; a selection can span independent React roots (the
 * gallery renders each plot as a separate mount), which a per-grid or per-root
 * React context could never do — a module singleton can. Selection is the
 * switch that decides WHICH panes are in a live sync group: while ≥2 panes are
 * selected, the React layer threads a shared view-sync group id
 * (`viewport-settings.ts`) and settings-sync group id
 * (`viewport-settings.ts`) into every selected pane, so zoom/pan and
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
 * mirroring `viewport-settings.ts`'s framework-free bus. The React binding
 * (a context + `useSyncExternalStore`) lives in `plot-node.tsx`.
 */

import { __resetSettingsChannelsForTest } from "../settings/settings-channels.ts";

export type SelectionListener = () => void;

/**
 * The REFERENCE indicator colour — a distinct ORANGE, deliberately different
 * from the blue `--color-accent` a regular SELECTED pane rings with, so the one
 * pane every comparison is taken AGAINST reads as special at a glance. Used by
 * BOTH the in-page `PaneSelectionFrame` (the reference pane among a ≥2
 * selection) and the fullscreen stage's reference cell/chip. A literal (not a
 * CSS token) so it resolves identically inside the body-portaled overlays,
 * whose themed scope defines `--color-accent` but not a reference token.
 */
export const REFERENCE_COLOR = "#f59e0b";
export const REFERENCE_COLOR_RGB = "245 158 11";

/** How a click modifies the selection — derived from the pointer event's
 *  modifier keys by the React layer (`shift || ctrl || meta`). */
export type SelectionMode = "replace" | "toggle";

/** Which page-level "selection stage" a pane's action requested — the multi
 *  ENLARGE grid or the multi COMPARE grid. Emitted through the store's stage
 *  channel ({@link SelectionStore.requestStage}) so a per-pane enlarge button
 *  (in the React-free-ignorant `ImagePaneShell`, via the enlarge-intercept
 *  context) can open the page-level stage the overlay host owns, without either
 *  side importing the other. */
export type StageMode = "enlarge" | "compare";

/** A combined, stable-until-change snapshot of the selection: the ordered set
 *  PLUS the current reference (last-selected / re-picked). A single object so a
 *  `useSyncExternalStore` reader re-renders when EITHER the set or the reference
 *  changes (the plain `getSelected()` array stays reference-stable when only the
 *  reference moves, so a reference-only change would otherwise be missed). */
export interface SelectionSnapshot {
  readonly selected: readonly string[];
  readonly reference: string | null;
}

export type StageRequestListener = (mode: StageMode) => void;

export class SelectionStore {
  /** Ordered selected pane ids; `selected[0]` is the ANCHOR. */
  private selected: readonly string[] = [];
  /** The explicitly-designated REFERENCE pane (last-selected by default, or one
   *  re-picked via {@link setReference}). `null` means "derive it" — the getter
   *  {@link reference} then falls back to the last-selected pane. Kept as an id
   *  (not an index) so it survives set mutations that don't touch it. */
  private referenceId: string | null = null;
  private listeners = new Set<SelectionListener>();
  private stageListeners = new Set<StageRequestListener>();
  /** Rebuilt on every mutation so {@link getSnapshot} hands a NEW object identity
   *  whenever the set OR the reference changes (drives the stage + REF badge). */
  private snapshot: SelectionSnapshot = { selected: [], reference: null };

  /** The current ordered selection (stable reference between mutations, so it
   *  is safe as a `useSyncExternalStore` snapshot). */
  getSelected(): readonly string[] {
    return this.selected;
  }

  /** The combined {selected, reference} snapshot (new identity on any change) —
   *  the `useSyncExternalStore` snapshot for readers that also track the
   *  reference (the action bar + the fullscreen stage + the REF badge). */
  getSnapshot(): SelectionSnapshot {
    return this.snapshot;
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
   * The REFERENCE pane — the pane every comparison is taken AGAINST and the one
   * the stage badges. It is the LAST-selected pane by default (so adding a pane
   * makes it the reference), unless a specific selected pane was pinned via
   * {@link setReference}. A pinned id that is no longer selected is ignored (we
   * fall back to the last-selected), so the reference can never dangle.
   */
  reference(): string | null {
    if (this.referenceId && this.selected.includes(this.referenceId)) {
      return this.referenceId;
    }
    return this.selected.length ? this.selected[this.selected.length - 1] : null;
  }

  /**
   * Pin `id` as the reference (the in-stage "re-pick" gesture). No-op when `id`
   * isn't selected. When `id` is ALREADY the effective reference (e.g. it is the
   * last-selected pane) the pin is recorded WITHOUT an emit — nothing observable
   * changed. Otherwise the reference moves and listeners fire.
   */
  setReference(id: string): void {
    if (!this.selected.includes(id)) return;
    if (this.reference() === id) {
      this.referenceId = id;
      return;
    }
    this.referenceId = id;
    this.emit();
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
      if (this.selected.includes(id)) {
        next = this.selected.filter((x) => x !== id);
        // Removing the pinned reference drops the pin (fall back to last).
        if (this.referenceId === id) this.referenceId = null;
      } else {
        next = [...this.selected, id];
        // A newly-added pane becomes the reference (last-selected).
        this.referenceId = id;
      }
    } else {
      // Plain click collapses any prior multi-selection down to just `id`.
      if (this.selected.length === 1 && this.selected[0] === id) return;
      next = [id];
      this.referenceId = id;
    }
    this.selected = next;
    this.emit();
  }

  /** Clear the whole selection (e.g. a click on empty grid background). */
  clear(): void {
    if (this.selected.length === 0) return;
    this.selected = [];
    this.referenceId = null;
    this.emit();
  }

  /**
   * Remove a single `id` (its pane is unmounting). No-op (no emit) when `id`
   * isn't selected. Distinct from `toggle`: this is a lifecycle removal, so it
   * can never ADD an id — a page-wide store must not keep a phantom member from
   * an unmounted pane inflating the group past the ≥2 sync threshold.
   */
  remove(id: string): void {
    if (!this.selected.includes(id)) return;
    this.selected = this.selected.filter((x) => x !== id);
    if (this.referenceId === id) this.referenceId = null;
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
    if (this.referenceId && !validIds.has(this.referenceId)) this.referenceId = null;
    this.emit();
  }

  subscribe(fn: SelectionListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Request the page-level {@link StageMode} stage (multi enlarge / compare).
   * The overlay host subscribes via {@link onStageRequest}; a per-pane enlarge
   * button routes through here (through the enlarge-intercept context) so the
   * library pane and the app-level stage stay decoupled.
   */
  requestStage(mode: StageMode): void {
    for (const l of [...this.stageListeners]) l(mode);
  }

  onStageRequest(fn: StageRequestListener): () => void {
    this.stageListeners.add(fn);
    return () => {
      this.stageListeners.delete(fn);
    };
  }

  /** Reset ONLY the selection state (tests) while keeping the instance — and
   *  thus every live `subscribe`/`onStageRequest` binding (e.g. the overlay
   *  host) — intact, so a test that resets between phases doesn't orphan it. */
  __resetForTest(): void {
    this.selected = [];
    this.referenceId = null;
    this.emit();
  }

  private emit(): void {
    // A ≥2 selection EPISODE id: bumps each time a group FORMS (crossing from
    // <2 to ≥2). Keys the per-episode sync-group ids so a fresh selection can
    // NEVER read a previous selection's accumulated settings — a store that was
    // never written is empty by construction, regardless of seed timing.
    const isGroup = this.selected.length >= 2;
    if (isGroup && !this.wasGroup) this.episode++;
    this.wasGroup = isGroup;
    this.snapshot = { selected: this.selected, reference: this.reference() };
    for (const l of this.listeners) l();
  }

  private episode = 0;
  private wasGroup = false;

  /** The CURRENT selection episode (see `emit`). Stable while a group lives;
   *  a new value = a new formation = fresh sync-group stores. */
  selectionEpisode(): number {
    return this.episode;
  }
}

/** The selection-derived sync groups a pane joins. `null` when the pane is not
 *  part of a ≥2 selection (a lone selection is a highlight, not a sync group). */
export interface PaneSyncGroups {
  /** Shared viewport-settings group id, including view transforms. */
  settingsGroupId: string;
  /** Whether this pane is the group ANCHOR (first-selected) — it seeds the
   *  group's view + settings so newly-added members adopt them. */
  isAnchor: boolean;
}

/**
 * The single source of truth (shared by `plot-node.tsx`'s `PaneSelectionFrame`
 * and the sync integration test) for a pane's selection-driven sync groups: a
 * pane syncs iff it is one of ≥2 selected panes; the whole active group shares
 * one `${base}-st` group id, and the first-selected member is
 * the anchor. `base` is the page-wide {@link GLOBAL_SELECTION_BASE} (a per-grid
 * base is no longer used — selection is page-wide, so there is one base).
 */
export function paneSyncGroups(
  store: SelectionStore,
  paneId: string,
  base: string,
): PaneSyncGroups | null {
  const selected = store.getSelected();
  if (selected.length < 2 || !selected.includes(paneId)) return null;
  // Group ids are PER-EPISODE (`selectionEpisode`): every formation gets fresh,
  // never-written stores, so stale settings/zoom from a past selection cannot
  // leak in — and the per-episode id CHANGES the anchor's formation-seed effect
  // deps, so re-forming a group around the same anchor re-seeds (a static id
  // left the old episode's store shadowing the new members).
  const ep = store.selectionEpisode();
  return {
    settingsGroupId: `${base}-st-${ep}`,
    isAnchor: selected[0] === paneId,
  };
}

// ---------------------------------------------------------------------------
// DOCUMENT-scoped (page-wide) obtain path. The gallery mounts each plot as a
// SEPARATE React root / `PlotApp`, so a per-grid or per-root React context
// cannot span them — a MODULE singleton shared by every pane wrapper on the
// page can, which is what makes a click in one mount and a shift-click in
// another build ONE cross-mount selection.
// ---------------------------------------------------------------------------

/** The one base for the page-wide selection's sync groups (`${base}-vp` /
 *  `${base}-st`). There is only ever ONE active selection set document-wide, so
 *  a single base is correct — every ≥2-selected pane shares these two ids. */
export const GLOBAL_SELECTION_BASE = "cp-global-sel";

let globalStore: SelectionStore | null = null;

/** The ONE page-wide selection store, created on first use and returned to
 *  every pane wrapper regardless of which React root it mounted in. */
export function getGlobalSelectionStore(): SelectionStore {
  if (!globalStore) globalStore = new SelectionStore();
  return globalStore;
}

/** Reset the page-wide store (tests only) so cases don't leak selection into
 *  one another. Clears state IN PLACE (rather than nulling the singleton) so a
 *  long-lived subscriber wired once per page — the selection overlay host —
 *  keeps its live binding across a mid-page reset. Not used by product code. */
export function __resetGlobalSelectionStoreForTest(): void {
  globalStore?.__resetForTest();
  paneSeq = 0;
  // Pane ids restart from 0 → the per-viewport settings stores (`vp-st-<paneId>`)
  // would collide across test cases; a reset page starts with EMPTY stores.
  __resetSettingsChannelsForTest();
}

// Monotonic pane-id source. React's `useId()` RESTARTS its counter per root
// (`:r0:`, `:r1:`, …), so two independent gallery mounts would mint COLLIDING
// pane ids and cross-contaminate the one global store. A process-wide counter
// namespaces every pane uniquely across all mounts on the page.
let paneSeq = 0;

/** A process-unique, stable pane id (`cp-pane-N`). Call once per pane wrapper
 *  (memoized in the component) so it survives re-renders. */
export function nextSelectionPaneId(): string {
  return `cp-pane-${paneSeq++}`;
}
