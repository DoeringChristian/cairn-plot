import VolumeViewer, {
  type VolumeBackground,
  type VolumeQuality,
  type VolumeRenderMode,
} from "../renderers/VolumeViewer";
import type { Scene3DCameraMode, Scene3DSyncOptions } from "../runtime/use-scene3d";
import type { PropertyMeta } from "../model/properties";
import { LabelChip, ContentCaption } from "../../../primitives/components/index";
import PanePlaceholder from "../../../primitives/components/PanePlaceholder";
import type { ColormapName } from "../../types";

/** Volume metadata (`artifact_metadata` JSON) — same shape the pre-refactor
 *  `VolumeCard` used (`VolumeMeta`), relocated. */
export interface VolumeMeta {
  shape: [number, number, number]; // [D, H, W]
  dtype: string;
  vmin: number;
  vmax: number;
  mean: number;
  spacing: [number, number, number];
  origin: [number, number, number];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  properties?: PropertyMeta[];
  size_bytes: number;
}

/** Resolved volume content: a flat float32 grid plus artifact metadata. */
export interface VolumeContent {
  arrays: { data: Float32Array };
  meta: VolumeMeta;
}

interface VolumeViewConfig {
  mode: VolumeRenderMode;
  isovalue: number;
  colormap: ColormapName;
  steps: VolumeQuality;
  clipMin: [number, number, number];
  clipMax: [number, number, number];
  background: VolumeBackground;
  showAxes: boolean;
  showPlanes: boolean;
  cameraMode: Scene3DCameraMode;
}

/** Present one volume content item. */
export function VolumeSingleView({
  item,
  view,
  sync,
  label,
  isDraggable,
  onDragStart,
  onFrame,
  colorRange,
}: {
  item: VolumeContent | null;
  view: VolumeViewConfig;
  sync: Scene3DSyncOptions | null;
  label: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onFrame?: (canvas: HTMLCanvasElement) => void;
  /** Card-level unified value range (WS-VCP fix 4) — overrides this item's
   *  own `meta.vmin`/`vmax` so every pane's raymarch normalizes against the
   *  SAME domain (matching the card's single always-on colorbar) instead of
   *  each item's own data range. `null`/absent = fall back to this item's
   *  own `vmin`/`vmax` (e.g. only one pane resolved so far). */
  colorRange?: [number, number] | null;
}) {
  if (!item) {
    return <PanePlaceholder variant="empty">no volume logged yet</PanePlaceholder>;
  }
  const { arrays, meta } = item;
  const [vmin, vmax] = colorRange ?? [meta.vmin, meta.vmax];
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded bg-bg">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden rounded bg-bg">
          <VolumeViewer
            data={arrays.data}
            shape={meta.shape}
            spacing={meta.spacing}
            origin={meta.origin}
            vmin={vmin}
            vmax={vmax}
            mode={view.mode}
            isovalue={view.isovalue}
            colormap={view.colormap}
            steps={view.steps}
            clip={{ min: view.clipMin, max: view.clipMax }}
            background={view.background}
            showAxes={view.showAxes}
          showPlanes={view.showPlanes}
          cameraMode={view.cameraMode}
            sync={sync}
            onFrame={onFrame}
          />
        </div>
      </div>
      {/* Per-pane metadata caption — voxel shape + this pane's OWN blob's data
          range (not the card-unified `colorRange`, so the caption always
          reflects what's actually in this artifact). See `ContentCaption`
          for the shared chip. */}
      <ContentCaption
        text={`${meta.shape.join("×")} · vmin ${meta.vmin.toFixed(3)} · vmax ${meta.vmax.toFixed(3)}`}
      />
      <LabelChip label={label} isDraggable={isDraggable} onDragStart={onDragStart} />
    </div>
  );
}
