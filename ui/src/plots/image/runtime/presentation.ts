import type { PixelValueNotation } from "../../../primitives/components/PixelValueOverlay.tsx";
import type {
  Colormap,
  DiffMode,
  ImageOverlayData,
  ImageOverlaySettings,
  ImageProcessing,
  Interpolation,
} from "../../types.ts";
import type { ImageComparisonContent, ImageSource } from "../definition/content.ts";
import type { DeepFlattenController } from "../resources/decoders.ts";
import type { ChannelMenuTree, ChannelSelection } from "../definition/channel-menu.ts";

/**
 * Resolved input presented by the host to the image runtime.
 *
 * This deliberately excludes settings-store commands and view callbacks. Those
 * arrive through the generic plot command channel and are adapted to a backend
 * only by `ImagePlotView`.
 */
export interface ImagePresentation {
  readonly source?: ImageSource;
  readonly comparison?: ImageComparisonContent;
  readonly imageUrl?: string | null;
  readonly hdr?: {
    readonly data: Float32Array | Float64Array | Uint16Array;
    readonly precision?: "f32" | "f16-bits";
    readonly shape: number[];
    readonly dtype: string;
    readonly deep?: DeepFlattenController;
  };
  readonly height?: number;
  readonly toolbar?: boolean;
  readonly baselineUrl?: string | null;
  readonly diffMode?: "none" | DiffMode;
  readonly interpolation?: Interpolation;
  readonly colormap?: Colormap;
  readonly tonemap?: string;
  readonly exposure?: number;
  readonly offset?: number;
  readonly peak?: number;
  readonly gamma?: number;
  readonly processing?: ImageProcessing;
  readonly showAxes?: boolean;
  readonly label?: string;
  readonly overlay?: ImageOverlayData;
  readonly overlaySettings?: ImageOverlaySettings;
  readonly pixelValueNotation?: PixelValueNotation;
  readonly zoom?: number;
  readonly pan?: { readonly x: number; readonly y: number };
  readonly channelTree?: ChannelMenuTree;
  readonly authoredChannelSelection?: ChannelSelection;
}
