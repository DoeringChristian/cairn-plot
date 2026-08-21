/**
 * Framework-free live DISPLAY-SETTINGS sync bus for image panes — the settings
 * mirror of `image-viewport-sync.ts`'s zoom/pan bus. One `EventTarget` per
 * `groupId`. A pane publishes a PARTIAL settings patch whenever the user changes
 * one of its display controls (colormap, tonemap operator, tonemap gamma, HDR
 * peak, exposure EV, offset); every other pane in the same group
 * applies the incoming fields to its own view-local override state.
 *
 * Unlike the viewport bus (whose payload is the FULL `{zoom,pan}` each time),
 * settings arrive as sparse patches (one control at a time) but a pane that
 * JOINS a group late needs the group's FULL current settings to align — so the
 * bus ACCUMULATES a merged snapshot per group in `lastStates`, and
 * `getLastImageSettings` returns that merge. The group anchor publishes its full
 * snapshot when a multi-selection forms (see `GpuImagePane`/`CpuImagePane`'s
 * anchor-publish effect), seeding the merge so joiners adopt a complete state.
 *
 * A single echo guard suffices (same reasoning as the viewport bus): each
 * publish carries the publisher's `sourceId`; a subscriber ignores events whose
 * `sourceId` matches its own. Callers publish only from genuine local control
 * changes (a menu pick / slider drag), never from an effect watching the
 * override state itself, so a remote-applied patch is never re-published.
 *
 * Reuses `makeImageViewportSyncSourceId` for the per-pane echo token (no need
 * for a second id generator). Intentionally React-free and dependency-free so
 * it stays in the CORE bundle (image panes are core) without tripping the
 * bundle guard, and is unit-testable without a DOM/React harness.
 */

/** The subset of display settings that sync across a selected group. All fields
 *  optional — a publish carries only the control(s) that changed; the bus merges
 *  them into the group's accumulated snapshot.
 *
 *  The payload is a SUPERSET spanning BOTH pane types that share the one bus:
 *  the IMAGE fields (colormap/tonemap/…/offset) are consumed by image panes AND
 *  compare panes (shared display look), while the COMPARE-ONLY fields
 *  (`compareMode`/`diffKernel`/`splitPosition`/`blendAlpha`) are consumed ONLY by
 *  compare panes. This is PARTIAL-APPLY by construction: a subscriber applies
 *  only the keys it owns (an image pane's apply reads no `compareMode`, so a
 *  compare-mode patch is a no-op for it; a compare pane reads both sets), so
 *  cross-type selections sync the shared look while compare-only keys stay
 *  effective only where they mean something. */
export interface ImageSyncSettings {
  // Shared display fields — applied by image AND compare panes.
  /** The unified DISPLAY-ENCODING id (a curve/remap operator id or a colormap
   *  LUT id) — the ONE key the display-encoding registry (Phase 3) syncs. Image
   *  panes publish + apply this; they ALSO publish the derived `colormap`/
   *  `tonemap` below so a pre-registry peer (a compare pane) still follows the
   *  shared look, and apply `colormap`/`tonemap` for the reverse direction. */
  encoding?: string;
  colormap?: string;
  tonemap?: string;
  tonemapGamma?: number;
  peak?: number;
  exposureEV?: number;
  offset?: number;
  /** DATA-encoding norm (Phase 4) — the nonlinear reshape of a colormap LUT's
   *  index (`linear`/`log`/`power`). Only meaningful while a lut encoding is
   *  active; ignored otherwise. */
  norm?: string;
  /** DATA-encoding multi-channel REDUCE (the multi-channel-colormap follow-up) —
   *  how a k>1 colormap source collapses to a scalar (`luminance`/`mean`). Only
   *  meaningful while a lut encoding is active on a k>1 source; ignored otherwise. */
  reduce?: string;
  /** DATA-encoding BOUNDS (Phase 4) — the min/max colorRange skin, synced so a
   *  selection group shares one data window. Both set = the bounds affine is
   *  engaged (else the exposure/offset skin). */
  colorMin?: number;
  colorMax?: number;
  // Compare-only fields — applied ONLY by compare panes (image panes ignore
  // them; their apply function reads none of these keys).
  /** Composited compare mode: "split" | "blend" | "diff". */
  compareMode?: string;
  /** Selected diff kernel id (e.g. "absolute"/"hdr-flip"/"ssim"). */
  diffKernel?: string;
  /** Split-divider position in [0,1]. */
  splitPosition?: number;
  /** Blend-mode alpha in [0,1]. */
  blendAlpha?: number;
  /** EXR channel-strip selection ({part, layer} or null = the node default) —
   *  applied by image LEAVES (LeafView), ignored by compare panes. Synced BY
   *  NAME so a group flips every pane to the same part/layer. */
  channelSelect?: { part?: number | string; layer?: string | string[] } | null;
}

interface SettingsStateDetail {
  patch: ImageSyncSettings;
  sourceId: string;
}

const EVENT_TYPE = "image-settings-state";

const buses = new Map<string, EventTarget>();
const lastStates = new Map<string, ImageSyncSettings>();

/** EPHEMERAL keys — broadcast LIVE to already-selected peers but NOT accumulated
 *  into the replayable group snapshot (`lastStates`).
 *
 *  The diff KERNEL (which error metric) is a per-VIEWPORT content-op choice, like
 *  the compare mode: distinct diffs in one selection legitimately hold DISTINCT
 *  kernels (a FLIP/SSIM/absolute grid — magma/magma/turbo per kernel). An explicit
 *  kernel PICK still MIRRORS to selected peers (it rides the live event below like
 *  any change), but it must NOT persist into the snapshot — otherwise a pane
 *  JOINING or a selection RE-FORMING reads a stale `diffKernel` off `getLast` and
 *  COLLAPSES every peer onto the anchor's metric. Selection FORMATION publishes the
 *  anchor's snapshot, which already omits `diffKernel`; keeping it out of the
 *  accumulated merge closes the join/re-form path too. (This is the bus half of the
 *  M2 "one authoritative kernel store" fix — the owner is `useCompareControl`.) */
const EPHEMERAL_KEYS: ReadonlyArray<keyof ImageSyncSettings> = ["diffKernel"];

/** The SCOPED display-encoding keys — the ones a receiver's `adoptDisplayEncoding`
 *  gate accepts/refuses by the `compareMode` FACE tag (`GpuImagePane`/`CpuImagePane`
 *  `applyRemoteSettings`). `compareMode` qualifies EXACTLY these keys: a diff's
 *  scalar-error colormap is tagged `"diff"` so a light pane scopes it out; an image's
 *  colormap carries no tag so every peer adopts it. (The unconditional display keys —
 *  exposureEV/offset/peak/gamma/reduce/bounds — are applied regardless of face, so
 *  they do NOT participate in the tag.) */
const SCOPED_DISPLAY_KEYS: ReadonlyArray<keyof ImageSyncSettings> = [
  "encoding",
  "colormap",
  "tonemap",
];

function busFor(groupId: string): EventTarget {
  let bus = buses.get(groupId);
  if (!bus) {
    bus = new EventTarget();
    buses.set(groupId, bus);
  }
  return bus;
}

/** Broadcasts a settings `patch` to every other subscriber of `groupId`, and
 *  merges it into the group's accumulated snapshot (for late joiners). The full
 *  `patch` is delivered LIVE (peers mirror every key); only the accumulated
 *  snapshot drops the {@link EPHEMERAL_KEYS} so a late joiner never inherits them. */
export function publishImageSettings(
  groupId: string,
  sourceId: string,
  patch: ImageSyncSettings,
): void {
  const prev = lastStates.get(groupId) ?? {};
  // Merge every key EXCEPT `compareMode` by spread; `compareMode` is the FACE TAG
  // for the SCOPED display keys and is reconciled specially below.
  const merged: ImageSyncSettings = { ...prev, ...patch };

  // MODE-AWARE TAG RECONCILE (M3). A flat spread let a stale `compareMode:"diff"`
  // ride over a LATER image colormap: a diff seeds `{colormap:magma, compareMode:
  // "diff"}`, then an image publishes `{colormap:turbo}` (no tag) → the flat merge
  // yields `{colormap:turbo, compareMode:"diff"}`, so a LATE-joining light pane reads
  // a poisoned snapshot and either refuses the group's real image colormap or adopts
  // the diff's magma onto light content (the orange-frame class) — a replay a LIVE
  // listener never saw (live, the untagged image patch adopts fine). The `compareMode`
  // tag now travels WITH the scoped display keys it qualifies:
  //   • a patch that WRITES a scoped key re-tags the snapshot to THAT patch's face
  //     (its `compareMode`, or CLEARED when the patch carries none — an image write
  //     erases a prior diff's tag), so replay == what a live listener applied.
  //   • a BARE `compareMode` patch (a mode switch with no display key) is broadcast
  //     LIVE (peers' `useCompareControl` adopt the mode) but must NOT re-tag the
  //     stale display keys already in the snapshot — so it leaves the tag untouched.
  const writesScopedDisplay = SCOPED_DISPLAY_KEYS.some((k) => patch[k] !== undefined);
  if (writesScopedDisplay) {
    if (patch.compareMode === undefined) delete merged.compareMode;
    else merged.compareMode = patch.compareMode;
  } else if (!("compareMode" in patch)) {
    // no scoped write AND the patch didn't mention compareMode → keep the prior tag
    merged.compareMode = prev.compareMode;
    if (merged.compareMode === undefined) delete merged.compareMode;
  } else {
    // BARE compareMode patch (mode switch): keep the snapshot's EXISTING display tag,
    // not this mode value — the tag qualifies display keys, which this patch doesn't touch.
    if (prev.compareMode === undefined) delete merged.compareMode;
    else merged.compareMode = prev.compareMode;
  }

  for (const k of EPHEMERAL_KEYS) delete merged[k];
  lastStates.set(groupId, merged);
  busFor(groupId).dispatchEvent(
    new CustomEvent<SettingsStateDetail>(EVENT_TYPE, { detail: { patch, sourceId } }),
  );
}

/** The accumulated merged settings published on `groupId`, or `undefined` if
 *  none yet. Lets a pane joining a group late adopt the group's current
 *  settings immediately (mirrors `getLastImageViewportState`). */
export function getLastImageSettings(groupId: string): ImageSyncSettings | undefined {
  return lastStates.get(groupId);
}

/** Subscribes to settings broadcasts on `groupId`, ignoring the caller's own
 *  publishes (matched by `sourceId`). Returns an unsubscribe function. */
export function subscribeImageSettings(
  groupId: string,
  sourceId: string,
  onPatch: (patch: ImageSyncSettings) => void,
): () => void {
  const bus = busFor(groupId);
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<SettingsStateDetail>).detail;
    if (detail.sourceId === sourceId) return;
    onPatch(detail.patch);
  };
  bus.addEventListener(EVENT_TYPE, handler);
  return () => bus.removeEventListener(EVENT_TYPE, handler);
}
