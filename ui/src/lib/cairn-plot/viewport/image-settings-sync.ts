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
   *  LUT id) — the ONE display-look key. Every pane publishes and applies THIS;
   *  the registry derives colormap/curve from it. */
  encoding?: string;
  /** @deprecated pre-registry wire format (the split colormap+tonemap pair).
   *  No longer published or read by cairn-plot panes — accepted inert so an
   *  external publisher's patch still merges (applicability at render). */
  colormap?: string;
  /** @deprecated see {@link ImageSyncSettings.colormap}. */
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
  /** Composited compare mode: "split" | "diff". The real mode the compare owner
   *  (`useCompareControl`) mirrors; applied only by compare panes. A legacy
   *  "blend" from an old peer is aliased to "split" on read. */
  compareMode?: string;
  /** Selected diff kernel id (e.g. "absolute"/"hdr-flip"/"ssim"). A normal
   *  synced value — a selected group mirrors the first viewport's kernel. */
  diffKernel?: string;
  /** Split-divider position in [0,1]. */
  splitPosition?: number;
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

// CROSS-BUNDLE SINGLETON. This module is bundled into BOTH the core chunk
// (`core.iife.js`, where `useCompareControl` in `plot-node.tsx` SUBSCRIBES the
// diff kernel / compare mode / split / blend) and the gpu-image addon chunk
// (`gpu-image.iife.js`, where `GpuImagePane` PUBLISHES those keys) — the addon
// externalizes only React, so it carries its own copy of this file. Two
// module-local `Map`s would therefore be TWO disjoint registries: the addon's
// publish would never reach core's subscriber, and every compare-owned key
// (kernel/mode/split/blend) would silently fail to mirror across a selection —
// the reported bug (a diff-mode change on one selected viewport not mirroring;
// in the enlarge stage the kernel drives the DERIVED default colormap, so it
// read as the colormap not mirroring either). The zoom/pan bus doesn't hit this
// because it lives core-only. Anchor the registry on `globalThis` so BOTH
// bundle copies of this module share ONE set of buses + snapshots (the same
// same-window sharing React itself uses via `window.__cairnPlotReact`).
interface SettingsBusRegistry {
  buses: Map<string, EventTarget>;
  lastStates: Map<string, ImageSyncSettings>;
}
const REGISTRY_KEY = "__cairnPlotImageSettingsBus__";
const registry: SettingsBusRegistry =
  ((globalThis as unknown as Record<string, SettingsBusRegistry | undefined>)[REGISTRY_KEY] ??= {
    buses: new Map<string, EventTarget>(),
    lastStates: new Map<string, ImageSyncSettings>(),
  });
const buses = registry.buses;
const lastStates = registry.lastStates;

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
  bumpLayerVersion(groupId);
  busFor(groupId).dispatchEvent(
    new CustomEvent<SettingsStateDetail>(EVENT_TYPE, { detail: { patch, sourceId } }),
  );
}

// ---------------------------------------------------------------------------
// THE SETTINGS STACK (user ruling, 2026-08-25). A viewport resolves its
// settings through an EXPLICIT stack of layer ids, bottom → top:
//
//     [viewport-local, selection-group?, stage-layer?, …]
//
// - `pushSettingsLayer` / `popSettingsLayer` are PURE operations on stack
//   VALUES — a scope that wants a layer (a selection episode, a stage open)
//   pushes onto its parent's stack and hands the new value down; when the
//   scope ends, its stack value stops existing, which IS the pop. There is
//   deliberately NO mutable global stack: layer lifetime stays tied to the UI
//   scope that pushed it, so pops can never be unbalanced or forgotten.
// - Reads merge the whole stack (top shadows bottom) via `resolveSettingsStack`
//   — CACHED per stack, stamped by per-layer write versions, so an unchanged
//   stack returns the IDENTICAL object (cheap, and memo-friendly across every
//   viewport sharing the stack).
// - Writes go to the TOP layer only (`publishToSettingsStack`): edits are
//   transient per layer — dropping a layer reverts everything below it.
// ---------------------------------------------------------------------------

/** A viewport's settings lookup stack — layer store ids, bottom → top. */
export type SettingsLayerStack = readonly string[];

/** Push `layerId` on TOP of `stack` (pure — returns a new stack value).
 *  Null/undefined/empty ids are no-ops so callers can push optional layers. */
export function pushSettingsLayer(
  stack: SettingsLayerStack,
  layerId: string | null | undefined,
): SettingsLayerStack {
  return layerId ? [...stack, layerId] : stack;
}

/** Drop the TOP layer of `stack` (pure — returns a new stack value). */
export function popSettingsLayer(stack: SettingsLayerStack): SettingsLayerStack {
  return stack.slice(0, -1);
}

/** Merge a `patch` into the stack's TOP layer (the one write path). */
export function publishToSettingsStack(
  stack: SettingsLayerStack,
  sourceId: string,
  patch: ImageSyncSettings,
): void {
  const top = stack[stack.length - 1];
  if (top) publishImageSettings(top, sourceId, patch);
}

// Per-layer write versions stamp the merge cache. On `globalThis` beside the
// stores (both IIFE bundles must observe each other's writes); the `??=` keeps
// an older registry object working if bundles of mixed vintage share a page.
function layerVersions(): Map<string, number> {
  const reg = registry as SettingsBusRegistry & { versions?: Map<string, number> };
  return (reg.versions ??= new Map<string, number>());
}
let writeSeq = 0;
function bumpLayerVersion(id: string): void {
  layerVersions().set(id, ++writeSeq);
}

// The merge cache: stackKey → { stamp, value }. Module-local (per bundle) —
// correctness rides the SHARED version stamps, so each bundle's cache is
// independently coherent. Bounded by the number of distinct live stacks.
const mergeCache = new Map<string, { stamp: string; value: ImageSyncSettings | null }>();

/** The stack's EFFECTIVE settings: every layer flat-merged bottom → top (top
 *  shadows), or `null` while all layers are empty. Cached — an unchanged stack
 *  returns the identical object until one of its layers is written. */
export function resolveSettingsStack(stack: SettingsLayerStack): ImageSyncSettings | null {
  const key = stack.join(" ");
  const versions = layerVersions();
  const stamp = stack.map((id) => versions.get(id) ?? 0).join(".");
  const hit = mergeCache.get(key);
  if (hit && hit.stamp === stamp) return hit.value;
  const layers = stack.map((id) => lastStates.get(id));
  const value = layers.some(Boolean)
    ? (Object.assign({}, ...layers) as ImageSyncSettings)
    : null;
  mergeCache.set(key, { stamp, value });
  return value;
}

/** The accumulated merged settings published on `groupId`, or `undefined` if
 *  none yet. Lets a pane joining a group late adopt the group's current
 *  settings immediately (mirrors `getLastImageViewportState`). */
export function getLastImageSettings(groupId: string): ImageSyncSettings | undefined {
  return lastStates.get(groupId);
}

/** Drop `groupId`'s accumulated snapshot. A FORMING selection group must start
 *  EMPTY (the anchor clears, then seeds its full snapshot): the page-wide
 *  selection reuses one static group id, so without this the store accumulates
 *  keys across selection episodes and a stale value from a past selection
 *  (an old exposure, a dead compare mode) shadows every member of the next one. */
export function clearImageSettings(groupId: string): void {
  lastStates.delete(groupId);
  bumpLayerVersion(groupId);
}

/** TESTS ONLY: drop EVERY accumulated store. The page-reset helper
 *  (`__resetGlobalSelectionStoreForTest`) re-mints pane ids from 0, so the
 *  per-viewport local stores (`vp-st-<paneId>`) would collide across test
 *  cases and leak one case's settings into the next — a reset page must have
 *  empty stores, exactly like a fresh page. Live bus subscriptions are kept
 *  (mirrors the in-place selection-store reset). */
export function __resetImageSettingsStoresForTest(): void {
  lastStates.clear();
  layerVersions().clear();
  mergeCache.clear();
  writeSeq = 0;
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
