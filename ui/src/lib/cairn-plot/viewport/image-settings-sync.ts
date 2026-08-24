/**
 * Framework-free live DISPLAY-SETTINGS sync bus for image panes — the settings
 * mirror of `image-viewport-sync.ts`'s zoom/pan bus. One `EventTarget` per
 * `groupId`.
 *
 * The model is deliberately flat (the settings-model simplification): each
 * viewport owns ONE concrete settings set and applies incoming values BY VALUE.
 * A pane publishes a settings patch whenever the user changes one of its display
 * controls (colormap / tonemap / gamma / peak / exposure / offset / bounds /
 * reduce / diff kernel / compare mode / split / blend / channel select); every
 * other pane in the group applies the incoming fields to its own settings
 * (MIRRORING, ruling 4). Applicability is decided at RENDER, not here (ruling 5):
 * a value that doesn't apply to a pane's current content (e.g. a colormap LUT on
 * a light RGB face) is stored and simply doesn't alter that render — there is no
 * face tag, no scoping, no per-key gating at the bus.
 *
 * A publish carries only the control(s) that changed; the bus merges them into
 * the group's accumulated snapshot (`lastStates`) with a plain flat spread, so a
 * pane JOINING a group late (`getLastImageSettings`) or the anchor SEEDING the
 * group on FORMATION (an explicit publish of its CURRENT values — ruling 3) both
 * align to the group's current settings. No key is ephemeral; no key is
 * reconciled specially.
 *
 * A single echo guard suffices (same reasoning as the viewport bus): each
 * publish carries the publisher's `sourceId`; a subscriber ignores events whose
 * `sourceId` matches its own. Callers publish only from genuine local control
 * changes (a menu pick / slider drag), never from an effect watching the
 * override state itself, so a mirrored patch is never re-published.
 *
 * Reuses `makeImageViewportSyncSourceId` for the per-pane echo token. React-free
 * and dependency-free so it stays in the CORE bundle (image panes are core) and
 * is unit-testable without a DOM/React harness.
 */

/** The settings that sync across a selected group — the viewport's full display
 *  vocabulary. All fields optional: a publish carries only the control(s) that
 *  changed and the bus flat-merges them into the group snapshot. A subscriber
 *  applies only the keys its content owns (an image pane ignores compare-only
 *  keys; a value that doesn't apply to its current content is stored and simply
 *  doesn't alter its render — applicability is a RENDER decision, not a sync one). */
export interface ImageSyncSettings {
  /** The unified DISPLAY-ENCODING id (a curve/remap operator id or a colormap
   *  LUT id) — the ONE key the display-encoding registry syncs. Image panes
   *  publish + apply this; they ALSO publish the derived `colormap`/`tonemap`
   *  below so a pre-registry peer (a compare pane) still follows the shared look,
   *  and apply `colormap`/`tonemap` for the reverse direction. */
  encoding?: string;
  colormap?: string;
  tonemap?: string;
  tonemapGamma?: number;
  peak?: number;
  exposureEV?: number;
  offset?: number;
  /** DATA-encoding norm — kept for back-compat (the norm picker is gone; the
   *  effective norm is linear). Accepted but ignored on apply. */
  norm?: string;
  /** DATA-encoding multi-channel REDUCE — how a k>1 colormap source collapses to
   *  a scalar (`luminance`/`mean`). Applies only while a lut encoding is active
   *  on a k>1 source; stored otherwise. */
  reduce?: string;
  /** DATA-encoding BOUNDS — the min/max colorRange skin. Both set = the bounds
   *  affine is engaged (else the exposure/offset skin). */
  colorMin?: number;
  colorMax?: number;
  /** Composited compare mode: "split" | "blend" | "diff". The real mode the
   *  compare owner (`useCompareControl`) mirrors; applied only by compare panes. */
  compareMode?: string;
  /** Selected diff kernel id (e.g. "absolute"/"hdr-flip"/"ssim"). A normal
   *  synced value — a selected group mirrors the first viewport's kernel. */
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
 *  flat-merges it into the group's accumulated snapshot (for late joiners /
 *  formation seed). By value: no key is scoped, tagged, or dropped. */
export function publishImageSettings(
  groupId: string,
  sourceId: string,
  patch: ImageSyncSettings,
): void {
  const prev = lastStates.get(groupId) ?? {};
  lastStates.set(groupId, { ...prev, ...patch });
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
