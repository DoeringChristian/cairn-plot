/**
 * Framework-free live DISPLAY-SETTINGS sync bus for image panes — the settings
 * mirror of `image-viewport-sync.ts`'s zoom/pan bus. One `EventTarget` per
 * `groupId`. A pane publishes a PARTIAL settings patch whenever the user changes
 * one of its display controls (colormap, tonemap operator, tonemap gamma, HDR
 * peak, exposure EV, offset, interpolation); every other pane in the same group
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
  interpolation?: string;
  /** DATA-encoding norm (Phase 4) — the nonlinear reshape of a colormap LUT's
   *  index (`linear`/`log`/`power`). Only meaningful while a lut encoding is
   *  active; ignored otherwise. */
  norm?: string;
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

function busFor(groupId: string): EventTarget {
  let bus = buses.get(groupId);
  if (!bus) {
    bus = new EventTarget();
    buses.set(groupId, bus);
  }
  return bus;
}

/** Broadcasts a settings `patch` to every other subscriber of `groupId`, and
 *  merges it into the group's accumulated snapshot (for late joiners). */
export function publishImageSettings(
  groupId: string,
  sourceId: string,
  patch: ImageSyncSettings,
): void {
  const merged = { ...(lastStates.get(groupId) ?? {}), ...patch };
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
