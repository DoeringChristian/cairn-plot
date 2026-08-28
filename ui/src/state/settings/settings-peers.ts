/**
 * MEMBERSHIP registry for settings-channel peers — the late-join seam of the
 * unified-viewport model. Channels are STATELESS (they remember no values), so
 * a member joining an existing group converges by DEREFERENCING a live peer's
 * settings object (the same peer-read seam frames use via the pane registry:
 * `registerSelectionPane(...).settings.get`). This module is that seam for
 * viewports that are NOT selection panes (the 3D viewer kits, the offscreen
 * compare mirrors): a member registers a live accessor to its OWN settings
 * object; a late joiner peeks any peer's current object.
 *
 * This holds MEMBERSHIP (who is in the group right now), never settings state:
 * an accessor reads the owner's live box at call time, and dies with it. That
 * keeps the stateless-channel invariant — nothing here outlives a viewport.
 *
 * Anchored on `globalThis` for the same cross-bundle reason as the channels
 * (`viewport-settings.ts`): the three-addon and core IIFE chunks must share
 * one membership map.
 */
import type { PlotSettings } from "./viewport-settings.ts";

type PeerAccessor = () => PlotSettings | null;

const PEERS_KEY = "__cairnPlotSettingsPeers__";
const peers: Map<string, Set<PeerAccessor>> = ((globalThis as unknown as Record<
  string,
  Map<string, Set<PeerAccessor>> | undefined
>)[PEERS_KEY] ??= new Map());

/** Register a live accessor to this member's OWN settings object. Returns
 *  unregister (call on unmount/dispose). */
export function registerSettingsPeer(groupId: string, get: PeerAccessor): () => void {
  let set = peers.get(groupId);
  if (!set) {
    set = new Set();
    peers.set(groupId, set);
  }
  set.add(get);
  return () => {
    set!.delete(get);
    if (set!.size === 0) peers.delete(groupId);
  };
}

/** A live peer's current settings object (the first member with a non-null
 *  box), or null when the group has no touched member — the late-join read.
 *  Pass the caller's OWN accessor as `exclude`: a joiner's own box is
 *  usually non-null already (content initialization), and converging to
 *  yourself is a silent no-op that skips the actual peers. */
export function peekGroupSettings(
  groupId: string,
  exclude?: PeerAccessor,
): PlotSettings | null {
  for (const get of peers.get(groupId) ?? []) {
    if (get === exclude) continue;
    const s = get();
    if (s) return s;
  }
  return null;
}

/** TESTS ONLY: drop every registration. */
export function __resetSettingsPeersForTest(): void {
  peers.clear();
}
