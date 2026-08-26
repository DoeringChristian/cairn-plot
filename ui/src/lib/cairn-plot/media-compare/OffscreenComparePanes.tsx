import { useEffect, useId, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Scene3DSyncOptions } from "../three/use-scene3d";
import { createCameraSettingsPeer, type CameraState } from "../three/camera-settings";
import { CrossTypeCompositeMediaPane } from "./compositor";
import type { MediaCompareModeKind } from "./mode";
import type { FrameSource } from "../viewport/types";
import type { Colormap, DiffMode } from "../types";
import { useOffscreenSnapshot } from "./use-offscreen-snapshot";

/** Convert any `FrameSource` variant to a plain `<img src>`-compatible
 *  string. `canvas` is read back via `toDataURL` (same operation
 *  `useOffscreenSnapshot` already performs on every live-viewer frame). */
export function frameSourceToUrl(f: FrameSource): string {
  if (f.kind === "url") return f.url;
  if (f.kind === "dataUrl") return f.dataUrl;
  return f.canvas.toDataURL("image/png");
}

/**
 * One side of a compare pane: either a LIVE hidden 3D viewer (the same-type
 * 3D-vs-3D case — participates in the shared camera-sync group and is
 * snapshotted every frame) or an already-resolved static `FrameSource`
 * (WS-VC6 cross-type — e.g. a foreign card's image artifact URL, or another
 * type's own offscreen render already captured once — see
 * `media-compare/cross-type-frame.tsx`). A "frame" side renders nothing
 * hidden and never re-snapshots; it just feeds its URL straight into the
 * compositor.
 *
 * The `render` callback is supplied by the consumer (the app card that owns
 * the concrete `*Viewer`): it receives the per-frame snapshot callback and
 * the shared `Scene3DSyncOptions` group, and returns the hidden viewer node.
 * This keeps `OffscreenComparePanes` renderer-agnostic — it orchestrates the
 * offscreen snapshot + camera-sync lifecycle without knowing which concrete
 * viewer produces the pixels.
 */
export type ComparePaneSource =
  | { kind: "live"; render: (onFrame: (canvas: HTMLCanvasElement) => void, sync: Scene3DSyncOptions) => React.ReactNode }
  | { kind: "frame"; frameSource: FrameSource };

export interface OffscreenComparePanesProps {
  /** One of the core "one-pane" media-compare kinds (split/diff)
   *  — "normal" doesn't need offscreen compositing (the card-level caller
   *  renders the primary viewer directly for "normal"). Cross-type (WS-VC6)
   *  references route through this shared compositor for split/diff. */
  mode: Extract<MediaCompareModeKind, "split" | "diff">;
  primary: ComparePaneSource;
  reference: ComparePaneSource;
  diffSubmode: DiffMode;
  colormap: Colormap;
  splitPosition: number;
  onSplitPositionChange: (p: number) => void;
  primaryLabel: string;
  /** WS-VC6: route `diff` through the resample/letterbox alignment step
   *  (only meaningful — and only ever passed — for a cross-type pane; a
   *  same-type pane's two live snapshots are already the same offscreen
   *  render size, so alignment would be a no-op there). */
  alignForDiff?: boolean;
  /**
   * WS-3DR2: the card's own live camera-sync group id (`cameraSyncGroupId`
   * from `ViewportPaneProps`, non-null only when the card's "Sync 3D views"
   * toggle is on), so this pane's two offscreen mirrors + interaction
   * controller join THAT group instead of a private per-mount one.
   *
   * Before this, `OffscreenComparePanes` always minted its own private
   * `compare3d-${useId()}` group, completely disconnected from the card-
   * level toggle — so orbiting a split/diff pane never propagated to
   * any OTHER pane on the same card (e.g. a multi-series comparison with
   * several split panes), even with "Sync 3D views" on. This is the WS-3DR2
   * fix for that (user-reported as "pointcloud split sync broken", but the
   * same bug affected split/diff for every 3D type — mesh/boxes/
   * volume too, since they all route through this one component).
   *
   * `null`/absent (card sync off, or no card-level group applies) falls
   * back to the original private-per-mount group — the primary/reference
   * pair (+ interaction controller) still always mirror each other (WS-VCP
   * fix 3's equivalent for split/diff), just scoped to this one pane,
   * matching pre-WS-3DR2 behavior exactly when sync is off.
   */
  syncGroupId?: string | null;
}

/**
 * Interaction controller for the compare overlay.
 *
 * Attaches a REAL `OrbitControls` to the transparent interaction surface —
 * driving a bare `PerspectiveCamera` (no renderer, so NO extra WebGL
 * context) that is a peer in the offscreen mirrors' private camera-sync
 * group. Pointer drag → orbit, wheel → zoom on the controller camera; every
 * `OrbitControls` "change" publishes `{position,target,zoom}` to the group,
 * which BOTH offscreen mirror viewers apply (re-render + re-snapshot →
 * recomposite). It also subscribes to the group so it adopts the mirrors'
 * fitted camera (via a peer deref (`seed()`) on mount + live updates), so the
 * first drag continues smoothly instead of jumping from a default pose.
 *
 * On-demand only: `OrbitControls` fires "change" solely on genuine pointer/
 * wheel input (no `enableDamping`, no rAF loop); the mirrors render once per
 * received state via their existing `use-scene3d` subscription.
 */
function useCompareCameraController(
  overlayRef: React.RefObject<HTMLDivElement>,
  groupId: string,
): void {
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    camera.position.set(2, 1.5, 2);
    const controls = new OrbitControls(camera, el);
    controls.enableDamping = false;

    let applyingRemote = false;

    const peer = createCameraSettingsPeer(groupId, (state: CameraState) => {
      applyingRemote = true;
      camera.position.fromArray(state.position);
      controls.target.fromArray(state.target);
      camera.zoom = state.zoom;
      camera.updateProjectionMatrix();
      controls.update();
      applyingRemote = false;
    });
    // Late-join converge (peer DEREF, not a cached last value): adopt the
    // mirrors' fitted camera so the controller starts aligned and the first
    // drag doesn't jump.
    peer.seed();

    const onChange = () => {
      if (applyingRemote) return;
      peer.set({
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
        zoom: camera.zoom,
      });
    };
    controls.addEventListener("change", onChange);

    return () => {
      controls.removeEventListener("change", onChange);
      peer.dispose();
      controls.dispose();
    };
  }, [overlayRef, groupId]);
}

/**
 * Renders TWO hidden 3D viewers sharing a private live camera-sync group
 * (identical camera, per spec-visual-compare.md WS-VC2 §B), snapshots each
 * one's canvas to a data URL (`useOffscreenSnapshot`), and feeds those into
 * the SAME `CompositeMediaPane` an image card uses — this is the ONE
 * compositor (split/pixel-diff), reused rather than forked, with
 * rendered-3D-canvas data URLs standing in for the artifact image URLs an
 * image card would fetch. Shared by every 3D card's 2-series compare
 * feature (mesh/pointcloud/boxes3d/volume) — not a per-card copy.
 *
 * The two source viewers are visually hidden (fixed off-screen position)
 * but still mounted at a real pixel size, since a WebGL canvas needs actual
 * dimensions to render into; only the composited `<img>`-based pane is
 * visible. A transparent interaction surface sits on top of the composite
 * (below the split divider's `z-20` handle, so split-drag still works) and
 * forwards drag/wheel gestures into the shared camera group via
 * `useCompareCameraController`, so the composited 3D output is fully
 * orbit/zoom interactive — both mirrors stay camera-locked because they
 * subscribe to the same group.
 *
 * WS-VC6: either side may instead be a `{kind:"frame"}` `ComparePaneSource`
 * (a foreign type's already-resolved raster — no hidden viewer, no
 * per-frame snapshot). The camera-sync group + interaction controller are
 * only meaningful when at least one side is `"live"`; when BOTH sides are
 * live (the same-type case) behavior is byte-identical to before this
 * generalization.
 */
export function OffscreenComparePanes({
  mode,
  primary,
  reference,
  diffSubmode,
  colormap,
  splitPosition,
  onSplitPositionChange,
  primaryLabel,
  alignForDiff,
  syncGroupId,
}: OffscreenComparePanesProps) {
  // Join the card-level "Sync 3D views" group when supplied (WS-3DR2) so
  // this pane's mirrors react to — and contribute to — the same camera as
  // every other pane on the card; otherwise fall back to a private
  // per-mount group (primary+reference still always mirror each other,
  // independent of the card-level toggle — see `syncGroupId`'s doc
  // comment). `useId()` is called unconditionally regardless (Rules of
  // Hooks), even though its value is only used in the fallback case.
  const localId = useId();
  const groupId = syncGroupId ?? `compare3d-${localId}`;
  const sync: Scene3DSyncOptions = { groupId };

  const primarySnap = useOffscreenSnapshot();
  const referenceSnap = useOffscreenSnapshot();

  const anyLive = primary.kind === "live" || reference.kind === "live";
  const overlayRef = useRef<HTMLDivElement>(null);
  // Safe to call even when `!anyLive` (the overlay div below isn't rendered
  // in that case, so `overlayRef.current` stays null and the hook's own
  // `if (!el) return` guard makes it a no-op) — Rules of Hooks requires this
  // be called unconditionally regardless.
  useCompareCameraController(overlayRef, groupId);

  const primaryUrl = primary.kind === "live" ? primarySnap.dataUrl : frameSourceToUrl(primary.frameSource);
  const referenceUrl = reference.kind === "live" ? referenceSnap.dataUrl : frameSourceToUrl(reference.frameSource);

  return (
    <div className="relative h-full w-full">
      {primary.kind === "live" && (
        <div aria-hidden style={{ position: "absolute", left: -99999, top: 0, width: 640, height: 480 }}>
          {primary.render(primarySnap.onFrame, sync)}
        </div>
      )}
      {reference.kind === "live" && (
        <div aria-hidden style={{ position: "absolute", left: -99999, top: 0, width: 640, height: 480 }}>
          {reference.render(referenceSnap.onFrame, sync)}
        </div>
      )}
      <CrossTypeCompositeMediaPane
        mode={mode}
        imageUrl={primaryUrl}
        baselineUrl={referenceUrl}
        alignForDiff={alignForDiff}
        diffSubmode={diffSubmode}
        colormap={colormap}
        interpolation="auto"
        zoom={1}
        pan={{ x: 0, y: 0 }}
        splitPosition={splitPosition}
        onSplitPositionChange={onSplitPositionChange}
        label={primaryLabel}
      />
      {/* Transparent orbit/zoom surface. z-10 keeps it above the composited
          images but BELOW the split divider's z-20 handle, so split-drag
          still works while drags elsewhere orbit the shared 3D camera.
          Only mounted when at least one side is a live 3D viewer — a
          frame-vs-frame pane (not reachable today) would have nothing to
          orbit. */}
      {anyLive && (
        <div
          ref={overlayRef}
          className="absolute inset-0 z-10"
          style={{ touchAction: "none", cursor: "grab" }}
        />
      )}
    </div>
  );
}

export default OffscreenComparePanes;
