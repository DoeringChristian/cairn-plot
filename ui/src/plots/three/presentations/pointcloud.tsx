import PointCloudViewer, {
  type PointCloudBackground,
  type PointCloudBounds,
  type PointCloudChannels,
  type PointColorMode,
  type PointSizeMode,
} from "../backends/three/PointCloudViewer";
import type { Scene3DCameraMode, Scene3DSyncOptions } from "../runtime/use-scene3d";
import type { PropertyMap, PropertyMeta } from "../model/properties";
import { LabelChip, ContentCaption } from "../../../primitives/components/index";
import PanePlaceholder from "../../../primitives/components/PanePlaceholder";

/** Point-cloud metadata (`artifact_metadata` JSON), parsed at the app layer
 *  and passed through untouched — same shape the pre-refactor `PointCloudCard`
 *  used (`PointCloudMeta`), just relocated. */
export interface PointCloudMeta {
  n_points: number;
  channels: PointCloudChannels;
  bounds: PointCloudBounds;
  original_count: number;
  downsampled?: boolean;
  value_range?: { min: number; max: number; mean: number };
  properties?: PropertyMeta[];
}

/** Resolved point-cloud content: parsed arrays plus artifact metadata. */
export interface PointCloudContent {
  arrays: { data: Float32Array; properties: PropertyMap };
  meta: PointCloudMeta;
}

interface PointCloudViewConfig {
  pointSize: number;
  pointSizeMode: PointSizeMode;
  colorMode: PointColorMode;
  background: PointCloudBackground;
  property: string | null;
  showAxes: boolean;
  showPlanes: boolean;
  cameraMode: Scene3DCameraMode;
}

/** Present one point-cloud content item. */
export function PointCloudSingleView({
  item,
  view,
  sync,
  label,
  isDraggable,
  onDragStart,
  onFrame,
}: {
  item: PointCloudContent | null;
  view: PointCloudViewConfig;
  sync: Scene3DSyncOptions | null;
  label: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onFrame?: (canvas: HTMLCanvasElement) => void;
}) {
  if (!item) {
    return <PanePlaceholder variant="empty">no point cloud logged yet</PanePlaceholder>;
  }
  const { arrays, meta } = item;
  return (
    <div className="relative flex h-full w-full overflow-hidden rounded bg-bg">
      <div className="min-w-0 flex-1">
        <PointCloudViewer
          data={arrays.data}
          channels={meta.channels}
          nPoints={meta.n_points}
          bounds={meta.bounds}
          colorMode={view.colorMode}
          pointSize={view.pointSize}
          pointSizeMode={view.pointSizeMode}
          background={view.background}
          showAxes={view.showAxes}
          showPlanes={view.showPlanes}
          cameraMode={view.cameraMode}
          sync={sync}
          onFrame={onFrame}
        />
      </div>
      {/* Per-pane metadata caption (WS-3DR dedup: closes the gap where
          pointcloud alone never restored its caption after WS-VC5). Point
          count + channel layout ("xyz" / "xyzc" / "xyzrgb") — the color info
          this artifact carries, mirroring boxes' "N boxes · kind" tone. See
          `ContentCaption` for the shared chip. */}
      <ContentCaption text={`${meta.n_points.toLocaleString()} points · ${meta.channels}`} />
      <LabelChip label={label} isDraggable={isDraggable} onDragStart={onDragStart} />
    </div>
  );
}
