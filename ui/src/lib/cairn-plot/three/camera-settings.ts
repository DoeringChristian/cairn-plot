/**
 * 3D camera on the unified-viewport model — the LAST special case, folded
 * (user ruling 2026-08-26: one viewport concept, the image viewport's
 * methods). A 3D viewer is a viewport like any other: it OWNS a plain
 * `ViewportSettings` object, its camera pose is the `"scene3d.camera"` entry,
 * writes go through the ONE set path (apply own + publish the same patch to
 * the group channel), peers dedupe by patch identity, and LATE JOIN is a peer
 * DEREF (`settings-peers.ts`) — no bus, no sourceId echo tokens, no stored
 * last-value cache.
 *
 * The one legitimately 3D-specific bit is HOW a value is applied: a camera
 * pose lands imperatively on `OrbitControls` (which fires "change" on
 * programmatic sets — callers keep their applying-remote suppression around
 * `applyPose`), and the box is a plain closure variable rather than React
 * state (viewers repaint from the imperative apply; a React re-render per
 * orbit frame would buy nothing). Both are renderer-internal choices — the
 * ownership, write path, channels, and peer reads are the image pattern
 * verbatim.
 *
 * Framework-free so the interaction controller (a bare `OrbitControls` with
 * no React tree, `OffscreenComparePanes.tsx`) uses the identical peer.
 */
import {
  publishSettingsPatch,
  subscribeSettingsPatches,
  type ViewportSettings,
} from "../viewport/image-settings-sync.ts";
import { peekGroupSettings, registerSettingsPeer } from "../viewport/settings-peers.ts";

/** A 3D camera pose — the `"scene3d.camera"` settings value (ATOMIC:
 *  position/target/zoom move together in one orbit gesture). */
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

export interface CameraSettingsPeer {
  /** THE write path: absorb into the own object + publish to the group. */
  set: (pose: CameraState) => void;
  /** Late-join converge (adding a member syncs settings over): adopt a live
   *  peer's current pose, if any member has one. Call once after creation. */
  seed: () => void;
  /** Unsubscribe + unregister. Call on unmount/dispose. */
  dispose: () => void;
}

/**
 * Join `groupId` as a camera-carrying viewport. `applyPose` is the viewer's
 * imperative applier (camera/controls mutation) — invoked for every INCOMING
 * pose (never for the peer's own `set`; the writer's camera is the source).
 */
export function createCameraSettingsPeer(
  groupId: string,
  applyPose: (pose: CameraState) => void,
): CameraSettingsPeer {
  // The viewport's OWN settings object (immutable-replace per patch) + the
  // patch-identity dedupe every applier in the model uses.
  let box: ViewportSettings | null = null;
  let lastApplied: ViewportSettings | null = null;

  const absorb = (patch: ViewportSettings) => {
    lastApplied = patch;
    box = { ...(box ?? {}), ...patch };
  };

  const unsubscribe = subscribeSettingsPatches(groupId, (patch) => {
    if (lastApplied === patch) return; // own publish — already absorbed
    absorb(patch); // inert keys ride along, per the applicability ruling
    const pose = patch["scene3d.camera"];
    if (pose) applyPose(pose);
  });
  const unregister = registerSettingsPeer(groupId, () => box);

  return {
    set(pose) {
      const patch: ViewportSettings = { "scene3d.camera": pose };
      absorb(patch);
      publishSettingsPatch(groupId, patch);
    },
    seed() {
      const pose = peekGroupSettings(groupId)?.["scene3d.camera"];
      if (pose) applyPose(pose);
    },
    dispose() {
      unsubscribe();
      unregister();
    },
  };
}
