import { useState } from "react";
import BoxesViewer, {
  resolveBoxesColorMode,
  type BoxesBackground,
  type BoxesColorMode,
} from "../backends/three/BoxesViewer";
import type { Scene3DCameraMode, Scene3DSyncOptions } from "../runtime/use-scene3d";
import {
  resolveActiveProperty,
  type PropertyMap,
  type PropertyMeta,
} from "../model/properties";
import { LabelChip, ContentCaption } from "../../../primitives/components/index";
import PanePlaceholder from "../../../primitives/components/PanePlaceholder";

/** Boxes3D metadata (`artifact_metadata` JSON) — same shape the pre-refactor
 *  `BoxesCard` used (`Boxes3DMeta`), relocated. */
export interface Boxes3DMeta {
  n_boxes: number;
  max_depth: number;
  kind: "boxes" | "octree" | "bvh";
  bounds: { min: [number, number, number]; max: [number, number, number] };
  value_range?: { min: number; max: number; mean: number };
  properties?: PropertyMeta[];
  size_bytes: number;
}

/** Resolved boxes content: parsed arrays plus artifact metadata. */
export interface BoxesContent {
  arrays: {
    mins: Float32Array;
    maxs: Float32Array;
    depth: Float32Array;
    properties: PropertyMap;
  };
  meta: Boxes3DMeta;
}

interface BoxesViewConfig {
  colorMode: BoxesColorMode;
  background: BoxesBackground;
  depthMin?: number;
  depthMax?: number;
  valueFilterEnabled?: boolean;
  valueMin?: number;
  valueMax?: number;
  property: string | null;
  showAxes: boolean;
  showPlanes: boolean;
  cameraMode: Scene3DCameraMode;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** Present one boxes content item. */
export function BoxesSingleView({
  item,
  view,
  sync,
  label,
  isDraggable,
  onDragStart,
  onFrame,
  colorRange,
}: {
  item: BoxesContent | null;
  view: BoxesViewConfig;
  sync: Scene3DSyncOptions | null;
  label: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onFrame?: (canvas: HTMLCanvasElement) => void;
  /** Card-level unified color domain (WS-VCP fix 4) — overrides the "value"
   *  mode's property range or the "depth" mode's max-depth normalization
   *  (whichever is active) so coloring matches the card's single colorbar.
   *  Never affects the depth/value FILTER range, which stays per-item. */
  colorRange?: [number, number] | null;
}) {
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  if (!item) {
    return <PanePlaceholder variant="empty">no boxes logged yet</PanePlaceholder>;
  }

  const { arrays, meta } = item;
  const active = resolveActiveProperty(arrays.properties, view.property, meta.properties ?? null);
  const hasValues = !!active.values && !!active.range;
  const maxDepth = meta.max_depth;
  const depthMin = clamp(view.depthMin ?? 0, 0, maxDepth);
  const depthMax = clamp(view.depthMax ?? maxDepth, depthMin, maxDepth);
  const valueThreshold: [number, number] | null =
    hasValues && view.valueFilterEnabled && active.range
      ? [
          clamp(view.valueMin ?? active.range[0], active.range[0], active.range[1]),
          clamp(view.valueMax ?? active.range[1], active.range[0], active.range[1]),
        ]
      : null;

  const effectiveColorMode = resolveBoxesColorMode(view.colorMode, hasValues);
  const valueRangeForColor = effectiveColorMode === "value" ? (colorRange ?? active.range) : active.range;
  const maxDepthForColor = effectiveColorMode === "depth" && colorRange ? colorRange[1] : maxDepth;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded bg-bg">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="min-w-0 flex-1">
          <BoxesViewer
            mins={arrays.mins}
            maxs={arrays.maxs}
            depth={arrays.depth}
            values={active.values}
            nBoxes={meta.n_boxes}
            bounds={meta.bounds}
            maxDepth={maxDepthForColor}
            valueRange={valueRangeForColor}
            colorMode={view.colorMode}
            depthRange={[depthMin, depthMax]}
            valueThreshold={valueThreshold}
            background={view.background}
            showAxes={view.showAxes}
          showPlanes={view.showPlanes}
          cameraMode={view.cameraMode}
            sync={sync}
            onVisibleCount={(visible) => setVisibleCount(visible)}
            onFrame={onFrame}
          />
        </div>
      </div>
      {/* Per-pane metadata caption — visible/total box counts + kind. See
          `ContentCaption` for the shared chip. */}
      <ContentCaption
        text={`${(visibleCount ?? meta.n_boxes).toLocaleString()} of ${meta.n_boxes.toLocaleString()} boxes · ${meta.kind}`}
      />
      <LabelChip label={label} isDraggable={isDraggable} onDragStart={onDragStart} />
    </div>
  );
}
