/**
 * VIEWPORT SETTINGS — types + the stateless group CHANNELS (the final NOSTACK
 * model, user rulings 2026-08-26; supersedes the flat registry, which
 * superseded the stack).
 *
 * ## The model (in the user's words)
 * "A viewport simply stores a settings instance, that gets synced over the
 * group bus." Concretely:
 * - Each VIEWPORT OWNS a plain {@link ViewportSettings} object, held in a
 *   box (`useRef`) by the frame that renders it (`useViewportSettings` in
 *   renderers/use-synced-image-settings.ts). Patches REPLACE the object
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

/** An image viewport's VIEW transform — zoom/pan, folded into the settings
 *  vocabulary (transforms are settings; they sync like every other key). */
export interface ViewportView {
  zoom: number;
  pan: { x: number; y: number };
}

/** The settings vocabulary — every key a viewport can explicitly own. All
 *  fields optional: a viewport's object holds only what was explicitly set
 *  (defaults are DERIVED at render, never stored); a patch carries only what
 *  changed. Applicability is a RENDER decision (ruling 5): a key that doesn't
 *  apply to a viewport's current content is stored and simply doesn't alter
 *  that render. */
export interface ViewportSettings {
  /** The unified DISPLAY-ENCODING id (a curve/remap operator id or a colormap
   *  LUT id) — the ONE display-look key. */
  encoding?: string;
  /** @deprecated pre-registry wire format (split colormap+tonemap). Accepted
   *  inert so an external publisher's patch still merges. */
  colormap?: string;
  /** @deprecated see {@link ViewportSettings.colormap}. */
  tonemap?: string;
  tonemapGamma?: number;
  peak?: number;
  exposureEV?: number;
  offset?: number;
  /** DATA-encoding norm — back-compat; accepted but ignored on apply. */
  norm?: string;
  /** Multi-channel REDUCE for k>1 colormap sources (`luminance`/`mean`). */
  reduce?: string;
  /** DATA-encoding BOUNDS — both set = the bounds affine is engaged. */
  colorMin?: number;
  colorMax?: number;
  /** Composited compare mode: "split" | "diff" (legacy "blend" aliases to
   *  "split" on read). */
  compareMode?: string;
  /** Selected diff kernel id (e.g. "absolute"/"hdr-flip"/"ssim"). */
  diffKernel?: string;
  /** Split-divider position in [0,1]. */
  splitPosition?: number;
  /** EXR channel-strip selection ({part, layer} or null = the node default).
   *  Synced BY NAME so a group flips every pane to the same part/layer. */
  channelSelect?: { part?: number | string; layer?: string | string[] } | null;
  /** INFO-PANEL visibility: true/false = explicit choice; ABSENT = auto.
   *  HOME clears it back to auto (explicit `undefined` masks — flat merge). */
  infoPanel?: boolean;
  /** The viewport's zoom/pan (see {@link ViewportView}). Absent = the pane's
   *  own HOME/fit view. */
  view?: ViewportView;
}

/** @deprecated renamed — the type was never image-specific nor a wire format.
 *  Use {@link ViewportSettings}. */
export type ImageSyncSettings = ViewportSettings;

/** Keys a channel SUBSCRIPTION may be scoped to. */
export type SettingsKey = keyof ViewportSettings;

/** Restrict `patch` to `keys` (undefined = the whole patch). Returns null when
 *  nothing survives, so scoped subscribers can skip empty applies. */
export function scopeSettingsPatch(
  patch: ViewportSettings,
  keys: readonly SettingsKey[] | undefined,
): ViewportSettings | null {
  if (!keys) return patch;
  const out: Record<string, unknown> = {};
  let any = false;
  for (const k of keys) {
    if (k in patch) {
      out[k] = (patch as Record<string, unknown>)[k];
      any = true;
    }
  }
  return any ? (out as ViewportSettings) : null;
}

type PatchListener = (patch: ViewportSettings) => void;

// CROSS-BUNDLE stateless channel map (see module doc).
const CHANNELS_KEY = "__cairnPlotSettingsChannels__";
const channels: Map<string, Set<PatchListener>> = ((globalThis as unknown as Record<
  string,
  Map<string, Set<PatchListener>> | undefined
>)[CHANNELS_KEY] ??= new Map());

/** Broadcast `patch` to every subscriber of `groupId` (including, by design,
 *  the publisher's own subscription if it has one — appliers dedupe by patch
 *  object identity). Stateless: nothing is remembered. */
export function publishSettingsPatch(groupId: string, patch: ViewportSettings): void {
  const subs = channels.get(groupId);
  if (subs) for (const cb of [...subs]) cb(patch);
}

/** Subscribe to `groupId`'s patches. Returns unsubscribe. Membership IS the
 *  subscription — there is no separate join/leave. */
export function subscribeSettingsPatches(groupId: string, cb: PatchListener): () => void {
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

/** TESTS ONLY: drop every channel (a reset page has no subscribers). */
export function __resetImageSettingsStoresForTest(): void {
  channels.clear();
}
