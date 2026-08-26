/**
 * VIEWPORT SETTINGS — the one flat registry + group fan-out bus (the NOSTACK
 * model, user rulings 2026-08-26; supersedes the settings STACK of 2026-08-25).
 *
 * ## The model
 * - Every viewport owns ONE settings entry in a flat registry
 *   (`viewportId → ImageSyncSettings`). Entries hold ONLY explicitly-set
 *   values; per-content DEFAULTS are derived at render and never stored.
 *   Entries outlive the renderer components (a pane remount, a GPU→CPU
 *   fallback, park/restore — the viewport persists, its entry with it).
 * - GROUPS are explicit memberships (`groupId → member viewport ids`),
 *   joined/left by the UI scopes that own them (the selection episode, the
 *   enlarge stage, an authored grid sync). A group may be KEY-SCOPED: an
 *   authored `sync.viewport` grid group fans ONLY the `view` key (today's
 *   semantics preserved); the selection/stage groups fan everything.
 * - `publishViewportSettings(id, patch)` is THE write path (gesture, HOME,
 *   formation seed, host API — all of it): the patch merges into the writer's
 *   entry AND into every member of the TRANSITIVE closure of the writer's
 *   groups (union ruling; per-group key scopes applied per hop-target).
 *   Writes are PERSISTENT — leaving a group changes nothing (ruling reversal
 *   2026-08-26: group edits stay).
 * - Subscribers are notified per-VIEWPORT ("your entry changed — re-read"),
 *   NOT handed patches. There is no adoption step and therefore no echo
 *   guard: the pre-stack mirror/adoption/one-commit-lag bug class has no
 *   code path to live in. The publisher's own entry is written by the same
 *   fan-out code as everyone else's (publish path == apply path).
 * - Formation converges: the anchor publishes its full EFFECTIVE snapshot
 *   (display keys + `view`) when a group forms (pane-side, it owns the
 *   snapshot — `useSeedGroupOnFormation`); a LATE JOINER adopts by copying an
 *   existing member's entry on join. HOME = an ordinary publish of the
 *   clicked pane's content-derived defaults (fans out like any edit).
 *
 * ## Cross-bundle singleton
 * Bundled into BOTH the core chunk and the gpu-image addon chunk (the addon
 * carries its own copy of this file). The registry is anchored on
 * `globalThis` so both copies share ONE set of entries/groups/listeners —
 * without this, an addon-side publish would never reach a core-side
 * subscriber (the historical kernel-not-mirroring bug).
 */

/** An image viewport's VIEW transform — zoom/pan, folded into the settings
 *  vocabulary (transforms are settings; they sync on the same bus). */
export interface ViewportView {
  zoom: number;
  pan: { x: number; y: number };
}

/** The settings vocabulary — every key a viewport can explicitly own. All
 *  fields optional: an entry holds only what was explicitly set; a publish
 *  carries only what changed. Applicability is a RENDER decision (ruling 5):
 *  a key that doesn't apply to a viewport's current content is stored and
 *  simply doesn't alter that render. */
export interface ImageSyncSettings {
  /** The unified DISPLAY-ENCODING id (a curve/remap operator id or a colormap
   *  LUT id) — the ONE display-look key. */
  encoding?: string;
  /** @deprecated pre-registry wire format (split colormap+tonemap). Accepted
   *  inert so an external publisher's patch still merges. */
  colormap?: string;
  /** @deprecated see {@link ImageSyncSettings.colormap}. */
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
   *  HOME clears it back to auto (explicit `undefined` masks — see merge). */
  infoPanel?: boolean;
  /** The viewport's zoom/pan (see {@link ViewportView}). Folded into the
   *  settings so view transforms ride the SAME registry + fan-out as display
   *  keys (one bus). Absent = the pane's own HOME/fit view. */
  view?: ViewportView;
}

/** Keys a group may be scoped to (see {@link joinSettingsGroup}). */
export type SettingsKey = keyof ImageSyncSettings;

interface GroupInfo {
  members: Set<string>;
  /** Undefined = all keys fan through this group; else only these keys. */
  keys?: ReadonlySet<SettingsKey>;
}

// CROSS-BUNDLE SINGLETON (see module doc). The `??=` keeps an older registry
// object working if bundles of mixed vintage share a page.
interface SettingsRegistry {
  entries: Map<string, ImageSyncSettings>;
  groups: Map<string, GroupInfo>;
  listeners: Map<string, Set<() => void>>;
}
const REGISTRY_KEY = "__cairnPlotViewportSettings__";
const registry: SettingsRegistry =
  ((globalThis as unknown as Record<string, SettingsRegistry | undefined>)[REGISTRY_KEY] ??= {
    entries: new Map(),
    groups: new Map(),
    listeners: new Map(),
  });

function notify(viewportId: string): void {
  const subs = registry.listeners.get(viewportId);
  if (subs) for (const cb of [...subs]) cb();
}

/** The viewport's explicitly-set settings, or `null` if none yet. The returned
 *  object is IDENTITY-STABLE until the entry is next written (pure read —
 *  memo-friendly). Callers must not mutate it. */
export function getViewportSettings(viewportId: string): ImageSyncSettings | null {
  return registry.entries.get(viewportId) ?? null;
}

/** Subscribe to "this viewport's entry changed — re-read it". Returns an
 *  unsubscribe. There are no patch payloads and no echo filtering: consumers
 *  re-read {@link getViewportSettings} (read is pure; no adoption step). */
export function subscribeViewportSettings(viewportId: string, cb: () => void): () => void {
  let subs = registry.listeners.get(viewportId);
  if (!subs) {
    subs = new Set();
    registry.listeners.set(viewportId, subs);
  }
  subs.add(cb);
  return () => {
    subs!.delete(cb);
  };
}

/**
 * Join `viewportId` to `groupId`. Returns LEAVE. `keys` scopes what fans
 * THROUGH this group (an authored `sync.viewport` grid group passes
 * `["view"]`; selection/stage groups pass nothing = all keys).
 *
 * LATE-JOIN CONVERGENCE (ruling): if the group already has members, the
 * joiner adopts by COPYING an existing member's entry (members are identical
 * by the group invariant, so any member serves; scoped groups copy only the
 * scoped keys). Leaving is membership-only — the joiner keeps everything
 * (persistence ruling).
 */
export function joinSettingsGroup(
  groupId: string,
  viewportId: string,
  keys?: readonly SettingsKey[],
): () => void {
  let group = registry.groups.get(groupId);
  if (!group) {
    group = { members: new Set(), keys: keys ? new Set(keys) : undefined };
    registry.groups.set(groupId, group);
  }
  if (!group.members.has(viewportId)) {
    // Converge-on-join: adopt an existing member's entry (scoped to the
    // group's keys when scoped).
    const donor = [...group.members].find((m) => registry.entries.get(m));
    if (donor) {
      const src = registry.entries.get(donor)!;
      const adopted = group.keys
        ? Object.fromEntries(Object.entries(src).filter(([k]) => group!.keys!.has(k as SettingsKey)))
        : src;
      if (Object.keys(adopted).length > 0) {
        mergeEntry(viewportId, adopted as ImageSyncSettings);
        notify(viewportId);
      }
    }
    group.members.add(viewportId);
  }
  return () => {
    const g = registry.groups.get(groupId);
    if (!g) return;
    g.members.delete(viewportId);
    if (g.members.size === 0) registry.groups.delete(groupId);
  };
}

/** Flat-merge `patch` into `viewportId`'s entry (explicit `undefined` values
 *  are kept as present-and-undefined — the "back to auto" mask, e.g.
 *  `infoPanel: undefined`). */
function mergeEntry(viewportId: string, patch: ImageSyncSettings): void {
  const prev = registry.entries.get(viewportId) ?? {};
  registry.entries.set(viewportId, { ...prev, ...patch });
}

/** Restrict `patch` to a group's key scope (undefined scope = whole patch). */
function scopePatch(
  patch: ImageSyncSettings,
  keys: ReadonlySet<SettingsKey> | undefined,
): ImageSyncSettings {
  if (!keys) return patch;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (keys.has(k as SettingsKey)) out[k] = v;
  return out as ImageSyncSettings;
}

/**
 * THE write path. Merges `patch` into `viewportId`'s entry and fans it out to
 * the TRANSITIVE closure of its groups (union ruling): for each reachable
 * member, the patch is filtered through the key scopes of the group path that
 * reaches it (a `view`-scoped grid group only ever carries `view` across that
 * hop). Persistent: nothing here is tied to group lifetime. Notifies every
 * written viewport once.
 *
 * `opts.fanOut: false` writes ONLY the local entry — for per-pane geometry
 * adaptations (e.g. reframe-on-resize) that must not propagate.
 */
export function publishViewportSettings(
  viewportId: string,
  patch: ImageSyncSettings,
  opts?: { fanOut?: boolean },
): void {
  // Seed: the writer always takes the full patch.
  const written = new Map<string, ImageSyncSettings>();
  written.set(viewportId, patch);
  if (opts?.fanOut !== false) {
    // BFS over (viewport → groups → members), narrowing the patch by each
    // group's key scope. A member reached twice keeps the WIDEST patch seen
    // (key-union), so scope narrowing never masks a wider path.
    const queue: string[] = [viewportId];
    while (queue.length) {
      const from = queue.shift()!;
      const fromPatch = written.get(from)!;
      for (const group of registry.groups.values()) {
        if (!group.members.has(from)) continue;
        const scoped = scopePatch(fromPatch, group.keys);
        if (Object.keys(scoped).length === 0) continue;
        for (const member of group.members) {
          const prev = written.get(member);
          if (prev) {
            const widened = { ...scoped, ...prev };
            if (Object.keys(widened).length > Object.keys(prev).length) {
              written.set(member, widened);
              queue.push(member);
            }
          } else {
            written.set(member, scoped);
            queue.push(member);
          }
        }
      }
    }
  }
  for (const [id, p] of written) {
    mergeEntry(id, p);
    notify(id);
  }
}

/** Copy `fromId`'s entry onto `toId` (REPLACE, not merge) — the enlarge
 *  stage's copy-on-create seam: a stage cell starts as an exact copy of its
 *  source viewport's settings, then diverges independently. */
export function copyViewportSettings(fromId: string, toId: string): void {
  const src = registry.entries.get(fromId);
  if (src) registry.entries.set(toId, { ...src });
  else registry.entries.delete(toId);
  notify(toId);
}

/** The current members reachable from `viewportId` through its groups
 *  (transitive closure, unscoped) — introspection/tests. */
export function settingsGroupPeers(viewportId: string): Set<string> {
  const seen = new Set<string>([viewportId]);
  const queue = [viewportId];
  while (queue.length) {
    const from = queue.shift()!;
    for (const group of registry.groups.values()) {
      if (!group.members.has(from)) continue;
      for (const m of group.members) {
        if (!seen.has(m)) {
          seen.add(m);
          queue.push(m);
        }
      }
    }
  }
  seen.delete(viewportId);
  return seen;
}

/** TESTS ONLY: drop every entry, group, and listener — a reset page must have
 *  empty stores, exactly like a fresh page (pane-id counters restart from 0
 *  across harness phases and would otherwise collide). */
export function __resetImageSettingsStoresForTest(): void {
  registry.entries.clear();
  registry.groups.clear();
  registry.listeners.clear();
}
