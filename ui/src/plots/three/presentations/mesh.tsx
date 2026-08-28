import MeshViewer, {
  resolveMeshColorMode,
  type MeshBackground,
  type MeshColorMode,
  type MeshShading,
} from "../renderers/MeshViewer";
import type { Scene3DCameraMode, Scene3DSyncOptions } from "../runtime/use-scene3d";
import {
  resolveActiveProperty,
  type PropertyMap,
  type PropertyMeta,
} from "../model/properties";
import { LabelChip, ContentCaption } from "../../../primitives/components/index";
import PanePlaceholder from "../../../primitives/components/PanePlaceholder";

/** Mesh metadata (`artifact_metadata` JSON), parsed at the app layer and
 *  passed through untouched — same shape the pre-refactor `MeshCard` used
 *  (`MeshMeta`), just relocated. */
export interface MeshMeta {
  n_vertices: number;
  n_faces: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  has_colors: boolean;
  has_face_colors?: boolean;
  /** 3 (RGB) or 4 (RGBA); present only when `has_face_colors`. */
  face_color_channels?: number;
  has_normals: boolean;
  value_range?: { min: number; max: number; mean: number };
  properties?: PropertyMeta[];
  size_bytes: number;
}

/** MeshViewport's `TData`: one pane's resolved blob + its metadata. */
export interface MeshContent {
  arrays: {
    positions: Float32Array;
    faces: Uint32Array;
    properties: PropertyMap;
    colors: Float32Array | null;
    faceColors: Float32Array | null;
    normals: Float32Array | null;
  };
  meta: MeshMeta;
}

interface MeshViewConfig {
  colorMode: MeshColorMode;
  shading: MeshShading;
  wireframe: boolean;
  doubleSided: boolean;
  background: MeshBackground;
  property: string | null;
  showAxes: boolean;
  showPlanes: boolean;
  cameraMode: Scene3DCameraMode;
}

/** Present one mesh content item. */
export function MeshSingleView({
  item,
  view,
  sync,
  label,
  isDraggable,
  onDragStart,
  onFrame,
  colorRange,
}: {
  item: MeshContent | null;
  view: MeshViewConfig;
  sync: Scene3DSyncOptions | null;
  label: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onFrame?: (canvas: HTMLCanvasElement) => void;
  /** Card-level unified value range (WS-VCP fix 4) — overrides this item's
   *  own autoscaled `active.range` when the "values" color mode is active,
   *  so coloring matches the card's single colorbar. `null`/absent = fall
   *  back to per-item autoscale (e.g. no card-level colorbar applies). */
  colorRange?: [number, number] | null;
}) {
  if (!item) {
    return <PanePlaceholder variant="empty">no mesh logged yet</PanePlaceholder>;
  }
  const { arrays, meta } = item;
  const active = resolveActiveProperty(arrays.properties, view.property, meta.properties ?? null);
  const resolvedMode = resolveMeshColorMode(
    view.colorMode,
    !!arrays.colors,
    !!active.values,
    !!arrays.faceColors,
  );
  const valueRange = resolvedMode === "values" ? (colorRange ?? active.range) : active.range;
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded bg-bg">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="min-w-0 flex-1">
          <MeshViewer
            positions={arrays.positions}
            faces={arrays.faces}
            nVertices={meta.n_vertices}
            nFaces={meta.n_faces}
            values={active.values}
            valueRange={valueRange}
            colors={arrays.colors}
            faceColors={arrays.faceColors}
            normals={arrays.normals}
            bounds={meta.bounds}
            colorMode={view.colorMode}
            shading={view.shading}
            wireframe={view.wireframe}
            doubleSided={view.doubleSided}
            background={view.background}
            showAxes={view.showAxes}
          showPlanes={view.showPlanes}
          cameraMode={view.cameraMode}
            sync={sync}
            onFrame={onFrame}
          />
        </div>
      </div>
      {/* Per-pane metadata caption — vertex/face counts + the active property
          name (when any). See `ContentCaption` for the shared chip. */}
      <ContentCaption
        text={`${meta.n_vertices.toLocaleString()} verts · ${meta.n_faces.toLocaleString()} faces${active.name ? ` · ${active.name}` : ""}`}
      />
      <LabelChip label={label} isDraggable={isDraggable} onDragStart={onDragStart} />
    </div>
  );
}
