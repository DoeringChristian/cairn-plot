import type { PixelValueNotation } from "../../../primitives/components/PixelValueOverlay.tsx";
import type {
  DiffMode,
  ImageOverlayData,
  ImageOverlaySettings,
  ImageProcessing,
  Interpolation,
} from "../../types.ts";
import type { ImageComparisonContent, ImageSource } from "../definition/content.ts";
import type { ChannelMenuTree, ChannelSelection } from "../definition/channel-menu.ts";

/**
 * Resolved input presented by the host to the image runtime.
 *
 * This deliberately excludes settings-store commands and view callbacks. Those
 * arrive through the generic plot command channel and are adapted to a backend
 * only by `ImagePlotView`.
 */
export interface ImagePresentation {
  readonly source: ImageSource;
  readonly comparison?: ImageComparisonContent;
  readonly height?: number;
  readonly toolbar?: boolean;
  readonly baselineUrl?: string | null;
  readonly diffMode?: "none" | DiffMode;
  readonly interpolation?: Interpolation;
  readonly processing?: ImageProcessing;
  readonly showAxes?: boolean;
  readonly label?: string;
  readonly overlay?: ImageOverlayData;
  readonly overlaySettings?: ImageOverlaySettings;
  readonly pixelValueNotation?: PixelValueNotation;
  readonly channelTree?: ChannelMenuTree;
  readonly authoredChannelSelection?: ChannelSelection;
}
