/**
 * 3D-camera adapter over the ONE unified settings bus (unified-viewport
 * ruling, 2026-08-26: every viewport kind shares one `ViewportSettings`
 * dictionary and one channel class — see `viewport/image-settings-sync.ts`).
 *
 * A viewer publishes its pose as a settings patch `{"scene3d.camera":
 * {position, target, zoom}}` whenever its OrbitControls fires "change"; every
 * other viewer subscribed to the same group applies the incoming pose to its
 * own camera/controls. There is no persistent rAF loop — a patch is pushed
 * only on a genuine "change" event and applied synchronously by subscribers.
 *
 * Two echo guards prevent feedback loops:
 * 1. `publish` remembers the exact patch object it sent per `sourceId`
 *    (patch-identity dedupe, the same pattern as the frame appliers in
 *    `useViewportSettings`), so a viewer never reacts to its own broadcast.
 * 2. `use-scene3d.ts` additionally suppresses re-publishing while it is
 *    applying an incoming remote pose, so the "change" event fired by that
 *    programmatic update (setting camera.position / controls.update()) can't
 *    ping back onto the bus. The imperative-apply guard belongs to the
 *    ADAPTER SIDE — the settings machinery itself has no echo protocol.
 *
 * `lastStates` is an adapter-local LAST-VALUE cache for late joiners only
 * (e.g. the compare-mode interaction controller mounting as a third peer
 * beside two already-fitted offscreen mirrors) — NOT authoritative group
 * state; each viewer's own camera remains the single source of truth.
 */
import {
  publishSettingsPatch,
  subscribeSettingsPatches,
  type ViewportSettings,
} from "../viewport/image-settings-sync.ts";

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

// Patch-identity echo guard (same pattern as `useViewportSettings`).
const lastPublishedBySource = new Map<string, ViewportSettings>();
// Late-join memory (adapter-local convenience, not group state).
const lastStates = new Map<string, CameraState>();

/** Broadcasts `state` to every other subscriber of `groupId`. */
export function publishCameraState(groupId: string, sourceId: string, state: CameraState): void {
  lastStates.set(groupId, state);
  const patch: ViewportSettings = { "scene3d.camera": state };
  lastPublishedBySource.set(sourceId, patch);
  publishSettingsPatch(groupId, patch);
}

/**
 * The most recent camera state published on `groupId`, or `undefined` if none
 * has been published yet. Lets a viewer/controller that JOINS a group late
 * (after peers have already framed the scene) adopt the current camera on
 * mount instead of starting at a default pose.
 */
export function getLastCameraState(groupId: string): CameraState | undefined {
  return lastStates.get(groupId);
}

/**
 * Subscribes to `scene3d.camera` patches on `groupId`, ignoring the caller's
 * own publishes (patch-identity match via `sourceId`). Returns unsubscribe.
 */
export function subscribeCameraState(
  groupId: string,
  sourceId: string,
  onState: (state: CameraState) => void,
): () => void {
  return subscribeSettingsPatches(groupId, (patch) => {
    const state = patch["scene3d.camera"];
    if (!state) return;
    if (lastPublishedBySource.get(sourceId) === patch) return;
    lastStates.set(groupId, state);
    onState(state);
  });
}

/** Generates a per-viewer-instance id for the echo guard (§1 above). */
export function makeCameraSyncSourceId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
