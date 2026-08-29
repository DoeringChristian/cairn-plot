import type { DataSpec } from "../../../../../packages/spec/src/spec.ts";
import {
  decodeImageSource,
  resolveImageArtifacts,
} from "../../artifact-resolvers.ts";
import type { DataSource } from "../../../resources/data/data-source.ts";
import type { ImageSource, ResolvedFloatImage } from "../definition/content.ts";
import { parseOverlay } from "./overlay-metadata.ts";
import { parseNpy } from "../../transforms/parse-npy.ts";
import { resolveFinalUrl } from "../resources/final-url.ts";
import type { ImageOverlayData } from "../../types.ts";
import {
  floatPixelsFrom,
  floatValues,
} from "../runtime/pixel-buffer.ts";

interface ResolvedImageOperand {
  url: string | null;
  float?: ResolvedFloatImage;
  overlay?: ImageOverlayData;
}

async function resolveOperand(
  data: DataSpec,
  source: DataSource,
): Promise<ResolvedImageOperand> {
  if (data.kind === "url") {
    return {
      url: await resolveFinalUrl(data.src),
      overlay: parseOverlay(data.metadata) ?? undefined,
    };
  }
  if (data.kind === "image") {
    if (data.url) {
      const resolved = await decodeImageSource({ url: data.url });
      return {
        url: resolved.url,
        float: resolved.float,
        overlay: parseOverlay(data.metadata) ?? undefined,
      };
    }
    const resolved = resolveImageArtifacts(
      {
        hashes: [data.hash ?? null],
        referenceHashes: [data.referenceHash ?? null],
        metadata: [data.metadata ?? null],
      },
      source,
      parseOverlay,
    );
    const item = resolved.items[0] ?? null;
    return { url: item?.url ?? null, overlay: item?.overlay ?? undefined };
  }
  if (data.kind === "imghdr") {
    if (!data.hash) return { url: null };
    const runtime = source.runtime?.(data.hash);
    if (runtime?.kind === "float") {
      const height = runtime.shape[0] ?? 0;
      const width = runtime.shape[1] ?? 0;
      const channels = runtime.shape.length >= 3 ? (runtime.shape[2] ?? 1) : 1;
      if (!width || !height) return { url: null };
      return {
        url: null,
        float: {
          pixels: floatPixelsFrom(
            runtime.data instanceof Float32Array || runtime.data instanceof Uint16Array
              ? runtime.data
              : Float32Array.from(runtime.data),
            runtime.precision,
          ),
          width,
          height,
          channels,
          contentKey: data.hash,
        },
      };
    }
    const npy = parseNpy(await source.bytes(data.hash));
    const height = npy.shape[0] ?? 0;
    const width = npy.shape[1] ?? 0;
    const channels = npy.shape.length >= 3 ? (npy.shape[2] ?? 1) : 1;
    if (!width || !height) return { url: null };
    return {
      url: null,
      float: {
        pixels: floatValues(Float32Array.from(npy.data)),
        width,
        height,
        channels,
        contentKey: data.hash,
      },
    };
  }
  return { url: null };
}

function decodedSource(operand: ResolvedImageOperand): ImageSource | null {
  if (operand.float) {
    const { pixels, width, height, channels } = operand.float;
    return {
      dtype: "float",
      pixels,
      shape: channels > 1 ? [height, width, channels] : [height, width],
    };
  }
  return operand.url == null ? null : { dtype: "uint8", url: operand.url };
}

function contentKey(operand: ResolvedImageOperand, fallback: string): string {
  return operand.float?.contentKey ?? operand.url ?? fallback;
}

/** Resolve ordered image operands into the unified retained image presentation. */
export async function resolveImageComparisonPair(
  reference: DataSpec,
  foreground: DataSpec,
  source: DataSource,
): Promise<Record<string, unknown>> {
  const [referenceOperand, foregroundOperand] = await Promise.all([
    resolveOperand(reference, source),
    resolveOperand(foreground, source),
  ]);
  const primary = decodedSource(referenceOperand);
  const secondary = decodedSource(foregroundOperand);
  if (!primary) throw new Error("compare reference did not resolve to an image source");
  if (!secondary) throw new Error("compare foreground did not resolve to an image source");
  return {
    source: primary,
    __diffB: secondary,
    __diffContentKeyA: contentKey(referenceOperand, "diff:a"),
    __diffContentKeyB: contentKey(foregroundOperand, "diff:b"),
    __diffOverlay: foregroundOperand.overlay,
  };
}
