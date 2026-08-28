/** Resource resolution shared by plot definitions. The durable specification
 * lives in `packages/spec`; this module only turns its data references into
 * decoded content through the injected `DataSource`.
 */
import {
  resolveImageArtifacts,
  fetchPointCloudArrays,
  fetchMeshArrays,
  fetchVolumeArray,
  fetchBoxesArrays,
} from "../plots/artifact-resolvers";
import type { DataSource } from "./data/data-source";
import { parseOverlay } from "../plots/image/definition/overlay-metadata";
import { parseNpy } from "../plots/transforms/index";
import {
  decodeImage,
  decodedU8ToDataUrl,
  isRawBufferFormat,
  sniffFormat,
  type DecodedImage,
} from "../plots/image/resources/decoders.ts";
import { resolveFinalUrl } from "../plots/image/resources/final-url.ts";
import { fetchImageBytes } from "./fetch-image";
import { floatPixelsFrom, floatValues } from "../plots/image/runtime/pixel-buffer.ts";
import { describeExr } from "../plots/image/resources/decoders/exr-describe";
import { groupChannels, type ChannelGroup } from "../plots/image/definition/channel-groups";
import type { DataSpec } from "../../../packages/spec/src/spec.ts";
export type {
  CompareNode,
  DataSpec,
  GridNode,
  PlotSpec,
  PlotLeafNode,
  PlotNode,
  SharedProps,
} from "../../../packages/spec/src/spec.ts";

/** The parts × channel-groups tree of an EXR source, attached to a resolved
 *  image leaf's props (`exrTree`) so the pane can render the CHANNEL STRIP
 *  (tev-style, below the viewport) and drive re-decodes. `null`-ish for
 *  non-EXR sources. */
export interface ExrTree {
  parts: Array<{ name: string; index: number; deep: boolean; groups: ChannelGroup[] }>;
}

/** Header-only describe → strip tree; `null` when `bytes` isn't an EXR (bad
 *  magic) — callers attach the tree opportunistically, never fail the decode. */
function tryExrTree(bytes: ArrayBuffer): ExrTree | null {
  try {
    const d = describeExr(bytes);
    return {
      parts: d.parts.map((p) => ({
        name: p.name,
        index: p.index,
        deep: p.deep,
        // SUBSAMPLED channels (RY/BY chroma, xSampling/ySampling > 1) are NOT
        // offered for selection: the selector decode path reads full-res planes
        // only, so isolating them would break (and the DEFAULT luminance-chroma
        // → RGB view already shows them combined).
        groups: groupChannels(p.channels.filter((c) => c.xSampling === 1 && c.ySampling === 1)),
      })),
    };
  } catch {
    return null;
  }
}

/** The durable recursive descriptor types live in packages/spec. */

/**
 * Resolve a descriptor's `DataSpec` → the renderer's DATA props, using the
 * active `DataSource`. The single seam where LOCAL and ENDPOINT converge:
 * every branch below is source-agnostic (it only calls `source.artifactUrl` /
 * `source.bytes`), so the same code path serves both modes.
 */
export async function resolveDataProps(
  data: DataSpec,
  source: DataSource,
): Promise<Record<string, unknown>> {
  switch (data.kind) {
    case "inline":
      return { ...data.props };
    case "image": {
      // Direct-URL CLIENT-DECODE seam. When `url` is set, fetch the bytes from
      // that URL and normalize through `decodeImage` (sniffed by the response
      // Content-Type, the URL extension, then magic bytes) — the SAME shaping as
      // the `format?` path below: float buffers → the `hdr` prop shape, uint8/
      // browser-native buffers → an `imageUrl` PNG data URL. This lets a URL
      // serve formats the browser can't `<img>`-decode (`exr`/`npy`/…) while the
      // image stays referenced by URL, not embedded. CORS applies to the fetch.
      if (data.url) {
        // Throttled + retry-on-429 (a big URL gallery must not trip the host's
        // rate limit; a transient 429 recovers rather than hard-erroring).
        const res = await fetchImageBytes(data.url);
        if (!res.ok) {
          throw new Error(`cairn-plot: failed to fetch image ${data.url} (${res.status})`);
        }
        const bytes = await res.arrayBuffer();
        // Single-image leaf → deep-live-flatten enabled so a deep EXR gets the
        // depth slider (`decoded.deep`, threaded into the `hdr` prop below).
        const decoded = await decodeImage(
          { bytes, url: data.url, mime: res.headers.get("content-type") ?? undefined },
          // Part/layer selection (EXR-only; other formats ignore it).
          { deepLiveFlatten: true, select: { part: data.part, layer: data.layer } },
        );
        const overlay = parseOverlay(data.metadata) ?? undefined;
        // EXR: attach the parts × groups tree so the pane shows the channel strip.
        const exrTree = tryExrTree(bytes);
        return {
          source: decodedToSource(decoded),
          baselineUrl: null,
          overlay,
          ...(exrTree ? { exrTree } : {}),
        };
      }
      // Multi-format DECODER seam. When `format` names a RAW-buffer image
      // (`.npy`/`.npz`), the browser can't decode it via `<img>`, so fetch the
      // bytes and normalize through `decodeImage`: float buffers become the
      // `hdr` prop shape (pair the leaf with an HDR-capable image renderer),
      // uint8 buffers become an `imageUrl` PNG data URL for the SDR path. The
      // baseline follows the same rule. Browser-native formats (or no `format`)
      // fall through to the byte-identical URL fast path below.
      if (data.format && isRawBufferFormat(data.format) && data.hash) {
        // Single-image leaf → deep-live-flatten enabled (depth slider).
        const bytes = await source.bytes(data.hash);
        const decoded = await decodeImage(
          { bytes, ext: data.format },
          // Part/layer selection (EXR-only; other formats ignore it).
          { deepLiveFlatten: true, select: { part: data.part, layer: data.layer } },
        );
        const baselineUrl = await resolveRawBufferBaseline(data, source);
        const overlay = parseOverlay(data.metadata) ?? undefined;
        // Magic-sniffed (tryExrTree bails on non-EXR bytes) — an exact
        // format-string gate missed MIME/uppercase hints ("image/x-exr").
        const exrTree = tryExrTree(bytes);
        return {
          source: decodedToSource(decoded),
          baselineUrl,
          overlay,
          ...(exrTree ? { exrTree } : {}),
        };
      }
      const res = resolveImageArtifacts(
        {
          hashes: [data.hash ?? null],
          referenceHashes: [data.referenceHash ?? null],
          metadata: [data.metadata ?? null],
        },
        source,
        parseOverlay,
      );
      const item = res.items[0] ?? null;
      const ref = res.referenceItems[0] ?? null;
      // A hash-only EXR (no `format` hint) must NOT fall through to the pane's
      // internal URL decode — it would lose the parts × channels tree AND the
      // part/layer selection. Detect by URL (extension or data: mime) and route
      // through the same fetch + selector-aware decode as the `url` branch.
      if (item?.url && sniffFormat({ url: item.url }) === "exr") {
        const res2 = await fetchImageBytes(item.url);
        if (res2.ok) {
          const bytes = await res2.arrayBuffer();
          const decoded = await decodeImage(
            { bytes, url: item.url },
            { deepLiveFlatten: true, select: { part: data.part, layer: data.layer } },
          );
          const exrTree = tryExrTree(bytes);
          return {
            source: decodedToSource(decoded),
            baselineUrl: ref?.url ?? null,
            overlay: item.overlay ?? undefined,
            ...(exrTree ? { exrTree } : {}),
          };
        }
      }
      return {
        source: { dtype: "uint8", url: item?.url ?? null },
        baselineUrl: ref?.url ?? null,
        overlay: item?.overlay ?? undefined,
      };
    }
    case "url": {
      // Raw URL passthrough: the `src`/`referenceSrc` flow into the panes (and
      // the URL-keyed image/diff caches) as the render identity. To stay
      // content-addressed under a live/redirecting query URL — whose bytes move
      // as "latest" re-resolves — resolve each to its FINAL post-redirect URL
      // (`res.url`, the content-addressed digest) FIRST, so the caches key on
      // the digest, not the mutable request URL. Non-redirecting / `data:` URLs
      // resolve to themselves (byte-for-byte unchanged); a CORS-blocked fetch
      // falls back to the raw URL so `<img src>`-only rendering still works.
      const [imageUrl, baselineUrl] = await Promise.all([
        resolveFinalUrl(data.src),
        data.referenceSrc ? resolveFinalUrl(data.referenceSrc) : Promise.resolve(null),
      ]);
      return {
        source: { dtype: "uint8", url: imageUrl },
        baselineUrl,
        overlay: parseOverlay(data.metadata) ?? undefined,
      };
    }
    case "npz": {
      // 3D binary artifact (G3). Dispatch on `objectType` — G3a wired
      // `pointcloud`, G3b adds `mesh`/`volume`/`boxes3d`. Each fetch core
      // (source-agnostic: LOCAL store bytes or ENDPOINT fetch) parses the
      // `.npy`/`.npz` into its typed arrays; bundle them with the inline
      // `meta` into the `{arrays, meta}` `item` the matching 3D standalone
      // consumes. NOTE: this path pulls NO three.js into core — the parsers
      // are pure; three lives only in the standalone renderers (the three
      // addon bundle).
      if (!data.hash) {
        throw new Error("npz DataSpec has no hash to resolve.");
      }
      switch (data.objectType) {
        case "pointcloud": {
          const arrays = await fetchPointCloudArrays(data.hash, source);
          return { item: { arrays, meta: data.meta } };
        }
        case "mesh": {
          const arrays = await fetchMeshArrays(data.hash, source);
          return { item: { arrays, meta: data.meta } };
        }
        case "volume": {
          // The volume renderer's `arrays` is `{ data: Float32Array }`.
          const data32 = await fetchVolumeArray(data.hash, source);
          return { item: { arrays: { data: data32 }, meta: data.meta } };
        }
        case "boxes3d": {
          const arrays = await fetchBoxesArrays(data.hash, source);
          return { item: { arrays, meta: data.meta } };
        }
        default: {
          const _exhaustive: never = data.objectType;
          throw new Error(`npz objectType "${_exhaustive}" is not supported.`);
        }
      }
    }
    case "imghdr": {
      // Float-HDR image (HDR-A). Fetch the float `.npy` bytes (source-agnostic:
      // LOCAL store or ENDPOINT), parse into `{dtype, shape, data:Float64Array}`,
      // and hand the HDR renderer (`HdrImagePane`) the `hdr` prop it consumes —
      // exposure/tone-mapping happen client-side, no 8-bit normalization. Mirror
      // of the `npz` branch (single bytes fetch; `meta` carried inline).
      if (!data.hash) {
        throw new Error("imghdr DataSpec has no hash to resolve.");
      }
      // RUNTIME fast path (JS-authored plots): a `Float32Array`/`Uint16Array`
      // registered by `window.cairnPlot` rides straight into the `hdr` prop BY
      // REFERENCE — no `.npy` encode on the way in, no `parseNpy` on the way out
      // (the Python-baked path takes both). `runtime()` is absent on the
      // ENDPOINT source and returns `undefined` for a baked LOCAL hash, so the
      // parseNpy path below stays the default.
      const rt = source.runtime?.(data.hash);
      if (rt && rt.kind === "float") {
        return {
          source: {
            dtype: "float",
            // SELF-DESCRIBING buffer (image/pixel-buffer.ts): the runtime
            // payload's representation travels with the bytes.
            pixels: floatPixelsFrom(rt.data, rt.precision),
            shape: rt.shape,
            numpyDtype: rt.dtype,
          },
          meta: data.meta,
        };
      }
      const buf = await source.bytes(data.hash);
      const npy = parseNpy(buf);
      return {
        source: { dtype: "float", pixels: floatValues(npy.data), shape: npy.shape, numpyDtype: npy.dtype },
        meta: data.meta,
      };
    }
  }
}

/**
 * Normalize a {@link DecodedImage} into the ONE unified {@link ImageSource}
 * the image renderer consumes: `f32` → a float source (shape derived from
 * width/height/channels; `precision` preserved for the F16 pipeline; deep-flatten
 * controller threaded through), `u8` → a uint8 source carrying a PNG data URL
 * (the byte-exact `<img>` / SDR-surface path).
 */
function decodedToSource(decoded: DecodedImage) {
  if (decoded.kind === "f32") {
    const shape =
      decoded.channels === 1
        ? [decoded.height, decoded.width]
        : [decoded.height, decoded.width, decoded.channels];
    return {
      dtype: "float",
      pixels: floatPixelsFrom(decoded.data, decoded.precision),
      shape,
      numpyDtype: decoded.precision === "f16-bits" ? "<f2" : "<f4",
      deep: decoded.deep,
    };
  }
  return { dtype: "uint8", url: decodedU8ToDataUrl(decoded) };
}

/**
 * Resolve the OPTIONAL baseline of a raw-buffer (`format`) `image` DataSpec to
 * an SDR `imageUrl`. Decodes the reference blob through the same registry;
 * uint8 baselines become a PNG data URL. A float baseline has no place in the
 * SDR `baselineUrl` string channel, so it resolves to `null`. Returns `null`
 * when there is no `referenceHash`.
 */
async function resolveRawBufferBaseline(
  data: Extract<DataSpec, { kind: "image" }>,
  source: DataSource,
): Promise<string | null> {
  if (!data.referenceHash || !data.format) return null;
  const decoded = await decodeImage({
    bytes: await source.bytes(data.referenceHash),
    ext: data.format,
  });
  return decoded.kind === "u8" ? decodedU8ToDataUrl(decoded) : null;
}
