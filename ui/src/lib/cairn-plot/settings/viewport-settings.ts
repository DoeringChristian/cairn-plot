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

/** An image viewport's VIEW transform — zoom/pan, a settings value like any
 *  other (an ATOMIC object: zoom and pan move together in one gesture). */
export interface ViewportView {
  zoom: number;
  pan: { x: number; y: number };
}

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
export interface ViewportSettings {
  /** The unified DISPLAY-ENCODING id (a curve/remap operator id or a colormap
   *  LUT id) — the ONE display-look key. */
  "image.encoding"?: string;
  "image.tonemapGamma"?: number;
  "image.peak"?: number;
  "image.exposureEV"?: number;
  "image.offset"?: number;
  /** Multi-channel REDUCE for k>1 colormap sources (`luminance`/`mean`). */
  "image.reduce"?: string;
  /** DATA-encoding BOUNDS (the min/max colorRange skin) — ATOMIC pair;
   *  `null` = the bounds affine disengaged (exposure/offset skin). */
  "image.colorRange"?: { min: number; max: number } | null;
  /** The viewport's zoom/pan. Absent = the pane's own HOME/fit view. */
  "image.view"?: ViewportView;
  /** EXR channel-strip selection ({part, layer} or null = the node default).
   *  Synced BY NAME so a group flips every pane to the same part/layer. */
  "image.channelSelect"?: { part?: number | string; layer?: string | string[] } | null;
  /** Semantic comparison operation: `split`, `signed`, `absolute`, `flip`, … .
   *  GPU kernel selection is a renderer implementation detail. */
  "compare.operation"?: string;
  /** Read-only migration inputs for old saved workspaces. New code never writes
   *  these split representations. */
  "compare.mode"?: string;
  "compare.kernel"?: string;
  /** Split-divider position in [0,1]. */
  "compare.split"?: number;
  /** INFO-PANEL visibility: true/false = explicit choice; ABSENT = auto;
   *  `null` = explicit back-to-auto (HOME). */
  "panel.info"?: boolean | null;
  /** A 2D chart's data-space window, ONE KEY PER AXIS (Plotly matched-axes
   *  semantics: peers adopt the RANGES, not a pixel transform; separate keys
   *  so the flat per-key merge lets an axis move alone). `null` = that axis
   *  follows its own live home/autoscale (the mask convention); a box-zoom
   *  writes both keys in one atomic patch. */
  "chart.domainX"?: [number, number] | null;
  "chart.domainY"?: [number, number] | null;
  /** A 3D viewer's camera pose — ATOMIC (position/target/zoom move together
   *  in one orbit gesture). */
  "scene3d.camera"?: {
    position: [number, number, number];
    target: [number, number, number];
    zoom: number;
  };
}

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
export function __resetSettingsChannelsForTest(): void {
  channels.clear();
}
