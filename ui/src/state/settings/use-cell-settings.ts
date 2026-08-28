/**
 * THE viewport settings hook — the frame-side OWNER of a viewport's settings
 * object (final NOSTACK model; `viewport/viewport-settings.ts` carries the
 * types + the stateless group channels).
 *
 * THE CONTRACT (user rulings 2026-08-26): a viewport OWNS a plain
 * {@link PlotSettings} object (a `useRef` box in the frame that renders
 * the visible element — nothing global stores settings). Resolution at
 * render is one lookup: `explicit value > derived seed`. Groups are
 * stateless broadcast channels; membership IS the subscription:
 *
 * - `set(patch)` — THE write path (gestures, HOME, formation seeds): applies
 *   the patch to this viewport's own object, then publishes the SAME patch
 *   object to every membership channel. Every subscribed member applies it
 *   into its own object — PERSISTENTLY (leaving a group changes nothing).
 *   Appliers dedupe by patch OBJECT IDENTITY, so the writer's own
 *   subscription skipping is structural, not an echo protocol.
 * - `setLocal(patch)` — apply without publishing (per-pane geometry
 *   adaptations that must not propagate, e.g. reframe-on-resize).
 * - Scoped memberships apply only their keys (an authored grid
 *   `sync.view` membership passes `keys: ["view"]`).
 * - No adoption effects, no stored group state, no echo guards; publish
 *   path == apply path (one `applyPatch`, used by both).
 *
 * ONE hook per viewport, run by the frame that owns it (`plot-node.tsx`'s
 * `PaneSelectionFrame`, the compositor; the enlarge stage owns its cells'
 * boxes ITSELF — see `plot-selection-stage.tsx`). `settings`/`set` are
 * handed DOWN to the panes as props.
 */
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  publishSettingsPatch,
  publishSettingsReplacement,
  scopeSettingsPatch,
  subscribeSettingsChanges,
} from "./settings-channels";
import type { PlotSettingKey, PlotSettings } from "../../settings/schema.ts";
import { registerSettingsPeer } from "./settings-peers.ts";

/** A group this viewport belongs to. `keys` scopes what this MEMBER applies
 *  from the channel (authored grid view sync = `["view"]`). */
export interface SettingsMembership {
  id: string;
  keys?: readonly PlotSettingKey[];
}

/** What the owning frame gets. */
export interface CellSettingsHandle {
  /** The viewport's explicitly-set settings, or `null` while untouched.
   *  Identity-stable until the next applied patch. */
  settings: PlotSettings | null;
  /** THE write path: apply to this viewport + publish to its groups. */
  set: (patch: PlotSettings) => void;
  /** HOME: replace this viewport's settings with the active content defaults,
   *  then publish those values to linked peers. */
  replace: (settings: PlotSettings) => void;
  /** Apply locally only (no publish). */
  setLocal: (patch: PlotSettings) => void;
  /** Replace locally without publishing or reporting a user change (session restore). */
  replaceLocal: (settings: PlotSettings) => void;
  /** Live accessors for the pane registry (peer reads / external writes). */
  get: () => PlotSettings | null;
  /** Apply as if received from a group (external-write seam). */
  apply: (patch: PlotSettings) => void;
}

export function useCellSettings(
  memberships?: readonly SettingsMembership[],
  initialSettings: PlotSettings | null = null,
  onChange?: (settings: PlotSettings) => void,
): CellSettingsHandle {
  // The owner materializes authored/default settings BEFORE its renderer mounts.
  // This is deliberately a useRef initializer: later descriptor/source changes
  // (notably a stacked tab flip) cannot reseed the viewport.
  const box = useRef<PlotSettings | null>(initialSettings);
  const [, bump] = useReducer((c: number) => c + 1, 0);
  // Patch-identity dedupe: `set` applies the patch directly AND publishes the
  // same object; the writer's own (unscoped) subscription then skips it.
  const lastAppliedRef = useRef<PlotSettings | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const getBox = useCallback(() => box.current, []);
  const applyPatch = useCallback((patch: PlotSettings) => {
    if (lastAppliedRef.current === patch) return;
    lastAppliedRef.current = patch;
    box.current = { ...(box.current ?? {}), ...patch };
    bump();
    onChangeRef.current?.(box.current);
  }, []);
  const applyReplacement = useCallback((settings: PlotSettings) => {
    if (lastAppliedRef.current === settings) return;
    lastAppliedRef.current = settings;
    box.current = { ...settings };
    bump();
    onChangeRef.current?.(box.current);
  }, []);

  // Memberships: subscribe each channel; scoped members apply only their keys.
  const membershipsKey = (memberships ?? [])
    .map((m) => `${m.id}:${(m.keys ?? []).join(",")}`)
    .join(" ");
  const membershipsRef = useRef(memberships);
  membershipsRef.current = memberships;
  useEffect(() => {
    const unsubs = (membershipsRef.current ?? []).flatMap((m) => [
      subscribeSettingsChanges(m.id, (change) => {
        const scoped = scopeSettingsPatch(change.settings, m.keys);
        if (!scoped) return;
        if (change.type === "patch") {
          applyPatch(scoped);
          return;
        }
        if (!m.keys) {
          applyReplacement(scoped);
          return;
        }
        const next = { ...(box.current ?? {}) };
        for (const key of m.keys) delete next[key];
        Object.assign(next, scoped);
        applyReplacement(next);
      }),
      // Membership also REGISTERS this viewport as a peer, so late joiners of
      // any kind converge by deref (`peekGroupSettings`) — the one converge
      // seam (frames and frameless cells alike).
      registerSettingsPeer(m.id, getBox),
    ]);
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipsKey, applyPatch, applyReplacement]);

  const set = useCallback(
    (patch: PlotSettings) => {
      applyPatch(patch);
      for (const m of membershipsRef.current ?? []) publishSettingsPatch(m.id, patch);
    },
    [applyPatch],
  );
  const replace = useCallback(
    (settings: PlotSettings) => {
      lastAppliedRef.current = settings;
      box.current = { ...settings };
      bump();
      onChangeRef.current?.(box.current);
      for (const m of membershipsRef.current ?? []) publishSettingsReplacement(m.id, settings);
    },
    [],
  );
  const setLocal = applyPatch;
  const replaceLocal = useCallback((settings: PlotSettings) => {
    lastAppliedRef.current = settings;
    box.current = { ...settings };
    bump();
  }, []);
  const get = getBox;

  return { settings: box.current, set, replace, setLocal, replaceLocal, get, apply: applyPatch };
}

/** Anchor formation seed, run by the PANE (it owns the snapshot of its
 *  effective values, incl. derived defaults and the current `view`): when a
 *  group forms around this viewport as the anchor, it publishes its FULL
 *  current settings, converging every member (formation-converges ruling;
 *  persistent like any edit).
 *
 *  DEFERRED one microtask: React flushes a commit's effects in TREE order —
 *  the pane-level seed (deep) fires before the frames' channel subscriptions,
 *  including (when the anchor sits later in the tree) the anchor's own; a
 *  synchronous publish would reach nobody. A microtask runs after the whole
 *  flush, when every member of the formation commit is subscribed. */
export function useSeedGroupOnFormation(
  groupId: string | null | undefined,
  isAnchor: boolean,
  set: ((patch: PlotSettings) => void) | undefined,
  snapshot: () => PlotSettings,
): void {
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => {
    if (!groupId || !isAnchor) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setRef.current?.(snapshotRef.current());
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, isAnchor]);
}
