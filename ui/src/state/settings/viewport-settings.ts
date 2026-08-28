/**
 * VIEWPORT SETTINGS — types + the stateless group CHANNELS (the final NOSTACK
 * model, user rulings 2026-08-26; supersedes the flat registry, which
 * superseded the stack).
 *
 * ## The model (in the user's words)
 * "A viewport simply stores a settings instance, that gets synced over the
 * group bus." Concretely:
 * - Each VIEWPORT OWNS a plain {@link PlotSettings} object, held in a
 *   box (`useRef`) by the frame that renders it (`useViewportSettings` in
 *   renderers/use-viewport-settings.ts). Patches REPLACE the object
 *   (`{...prev, ...patch}`) so identity checks stay valid. Nothing global
 *   stores settings — no registry, no ids, no leaked rows: the object dies
 *   with its viewport.
 * - GROUPS are stateless broadcast channels ({@link settingsChannel}): a
 *   listener set per group id, carrying patches, remembering NOTHING. A
 *   write is a publish; every subscribed member applies the patch into its
 *   OWN object (persistent — leaving a group changes nothing). Channels may
 *   be KEY-SCOPED per subscriber (an authored grid `sync.viewport`
 *   membership applies only the `view` key — today's semantics).
 * - Peer READS (formation seed, late-join converge, stage copy-on-create)
 *   are a deref of the owning frame's box, reached through the existing
 *   pane registry (`registerSelectionPane` carries the accessors) — no
 *   snapshot protocol, no accumulated group state.
 *
 * ## Cross-bundle note
 * The channel map is anchored on `globalThis` because this module is bundled
 * into BOTH the core and the gpu-image addon IIFE chunks — two module copies
 * must share ONE listener set per group. The channels are STATELESS, so this
 * carries none of the mixed-vintage-registry hazards the stored registry had.
 */

import type { PlotSettingKey, PlotSettings } from "../../settings/schema.ts";
export type { PlotSettingKey, PlotSettings } from "../../settings/schema.ts";

/**
 * THE SETTINGS TYPE (unified-viewport ruling, 2026-08-26): one flat,
 * NAMESPACED key space shared by EVERY viewport kind (image, chart, 3D — one
 * class of settings object, OWNED by each viewport); merging is a shallow spread (flat
 * keys make per-key merge across namespaces trivial); groups may mix kinds
 * freely — each viewport APPLIES the namespaces its content understands and
 * carries the rest inert (applicability is a RENDER decision, ruling 5).
 *
 * Namespaces track APPLICABILITY DOMAINS, not renderer names:
 *   - `image.*`   — the image display look + transform + channel selection.
 *   - `compare.*` — compare/diff keys (any comparable kind; 3D native diff
 *                   joins this namespace when 3D enters the vocabulary).
 *   - `panel.*`   — pane chrome (info panel).
 *   - `chart.*`   — 2D chart data-space window (matched-axes sync), NATIVE:
 *     `use-chart-viewport.ts` projects the frame-owned settings object, the
 *     image pattern exactly.
 *   - `scene3d.*` — 3D camera pose, NATIVE: each 3D viewer owns a settings
 *     object and joins its group as a peer (`three/camera-settings.ts`);
 *     late-join converges by PEER DEREF (`settings-peers.ts`), the frame
 *     registry's twin for frameless viewports.
 *
 * MASKS are `null`, never `undefined` (JSON-round-trippable by construction):
 * `"panel.info": null` = back-to-auto; `"image.colorRange": null` = bounds
 * skin off. Values that must move together are OBJECTS (view, colorRange).
 */
/** Restrict `patch` to `keys` (undefined = the whole patch). Returns null when
 *  nothing survives, so scoped subscribers can skip empty applies. */
export function scopeSettingsPatch(
  patch: PlotSettings,
  keys: readonly PlotSettingKey[] | undefined,
): PlotSettings | null {
  if (!keys) return patch;
  const out: Record<string, unknown> = {};
  let any = false;
  for (const k of keys) {
    if (k in patch) {
      out[k] = (patch as Record<string, unknown>)[k];
      any = true;
    }
  }
  return any ? (out as PlotSettings) : null;
}

export type SettingsChange =
  | { type: "patch"; settings: PlotSettings }
  | { type: "replace"; settings: PlotSettings };

type ChangeListener = (change: SettingsChange) => void;
type PatchListener = (patch: PlotSettings) => void;

// CROSS-BUNDLE stateless channel map (see module doc).
const CHANNELS_KEY = "__cairnPlotSettingsChannels__";
const channels: Map<string, Set<ChangeListener>> = ((globalThis as unknown as Record<
  string,
  Map<string, Set<ChangeListener>> | undefined
>)[CHANNELS_KEY] ??= new Map());

/** Broadcast `patch` to every subscriber of `groupId` (including, by design,
 *  the publisher's own subscription if it has one — appliers dedupe by patch
 *  object identity). Stateless: nothing is remembered. */
export function publishSettingsPatch(groupId: string, patch: PlotSettings): void {
  const subs = channels.get(groupId);
  if (subs) for (const cb of [...subs]) cb({ type: "patch", settings: patch });
}

/** Broadcast a complete settings replacement. Unlike a patch, receivers remove
 * values absent from `settings`; HOME relies on this distinction. */
export function publishSettingsReplacement(
  groupId: string,
  settings: PlotSettings,
): void {
  const subs = channels.get(groupId);
  if (subs) for (const cb of [...subs]) cb({ type: "replace", settings });
}

export function subscribeSettingsChanges(
  groupId: string,
  cb: ChangeListener,
): () => void {
  let subs = channels.get(groupId);
  if (!subs) {
    subs = new Set();
    channels.set(groupId, subs);
  }
  subs.add(cb);
  return () => {
    subs!.delete(cb);
    if (subs!.size === 0) channels.delete(groupId);
  };
}

/** Subscribe to `groupId`'s patches. Returns unsubscribe. Membership IS the
 *  subscription — there is no separate join/leave. */
export function subscribeSettingsPatches(groupId: string, cb: PatchListener): () => void {
  return subscribeSettingsChanges(groupId, (change) => cb(change.settings));
}

/** TESTS ONLY: drop every channel (a reset page has no subscribers). */
export function __resetSettingsChannelsForTest(): void {
  channels.clear();
}
