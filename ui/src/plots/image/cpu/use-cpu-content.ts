/**
 * `cpu/use-cpu-content.ts` — the CPU backend's CONTENT stage.
 *
 * The CPU pane used to own four DOM surfaces (an `<img>`, a diff canvas, a
 * false-color canvas, a transfer canvas), each written by its own effect and
 * placed/zoomed with CSS. Under the shared viewport there is ONE presentation
 * canvas and ONE paint (`paint.ts`), so what a pipeline produces is no longer a
 * surface but a `PaintSource` — a ready-to-blit bitmap plus its grid. This hook
 * is those effects, unchanged in their inputs and their math, with their outputs
 * redirected into bitmaps and a version counter.
 *
 * ## The pipelines (mutually exclusive; the same selection as before)
 *   - DIFF (`baselineUrl` + a diff mode, not the baseline side) — the WebGL 2
 *     blit into an offscreen canvas, else `computeDiff` (+ `applyColormap`).
 *   - FALSE COLOR (a colormap, no diff) — `tonemapToImageData` over the decoded
 *     source promoted to a scene field.
 *   - DIRECT (everything else) — the decoded source, optionally through
 *     `sdrTransferToImageData` when the transfer is not the sRGB identity or
 *     EV/OFF are dialed. `srgb` at EV=0/OFF=0 is a bit-exact round trip, so it
 *     is skipped and the decoded pixels blit as-is (the old plain-`<img>` path).
 *   - HDR — the single `tonemapToImageData` pass over the float buffer.
 * The 8-bit `processing` block (brightness/contrast/γ/offset/flipSign) is a
 * DISPLAY-space stage applied to whichever `ImageData` the SDR pipeline produced
 * (`applyProcessingToImageData`), replacing the CSS/SVG filter chain the `<img>`
 * carried — there is no styled element to hang a filter on any more. It now
 * reaches the diff/false-color/transfer outputs too, which the CSS chain only
 * ever applied `invert(1)` to.
 *
 * ## Caching and identity
 * Each pipeline names its output with a KEY built from the content identity plus
 * the scalar display parameters it consumes — the same tuple its effect depends
 * on. Bitmaps are memoized per key in `bitmap-cache.ts` — an LRU that never
 * destroys an evicted value and never displaces a resident one, because a
 * mounted pane keeps re-blitting the bitmap it committed; the intermediate
 * `ImageData` rides the existing `resources/cache.ts` LRU, so a mode/colormap
 * toggle still hits it. A key already resident commits SYNCHRONOUSLY inside the
 * effect, so a cached flip never shows a placeholder.
 *
 * The key and the pixels it names MUST come from the same inputs, or a cache
 * entry is poisoned for the life of the LRU. The display-space `processing`
 * block is the one input a decode can outlive, so each effect captures it ONCE,
 * at effect time, as a `ProcessingPass` (`processing.ts`) whose `key` fragment
 * and `apply` close over the same block — never re-read from a ref after the
 * `await`, which would file the new block's pixels under the old block's key.
 *
 * ## Holding the previous frame
 * `source` is only ever REPLACED, never cleared, while a new pipeline runs:
 * `status` goes `loading` and the pane keeps painting the frame it has. That is
 * the same no-flash contract the GPU pane's render snapshot provides.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Colormap, DiffMode, ImageProcessing } from "../../types";
import { createBitmapCache } from "./bitmap-cache.ts";
import { getCachedImageData, setCachedImageData } from "../resources/cache.ts";
import { loadImageData } from "../resources/load-image-data.ts";
import { imageDataToSceneField } from "../resources/scene-field.ts";
import { floatValues } from "../runtime/pixel-buffer.ts";
import { getColormapLUT } from "../../../settings/colormaps/index";
import { applyColormap } from "../resources/apply-colormap.ts";
import { computeDiff } from "./diff.ts";
import { webglRenderDiffToCanvas } from "./webgl-diff.ts";
import { processingPass } from "./processing.ts";
import { sdrTransferToImageData, tonemapToImageData } from "./tonemap-image-data.ts";
import type { PaintSource } from "./paint.ts";
import type { FloatImageData } from "../runtime/contracts";
import { resolveEncodeGamma, type DisplayCurveId } from "../runtime/tonemap";
import type { ReduceMode } from "../definition/display-operations.ts";

export type { PaintSource };

/** Everything the content stage consumes: the content identity (urls / the
 *  float buffer) plus the SCALAR display parameters. No React elements and no
 *  callbacks — so a pipeline reruns exactly when its pixels would change, and
 *  never on a pan/zoom. */
export interface CpuContentInput {
  kind: "sdr" | "hdr";
  // --- sdr ---------------------------------------------------------------
  imageUrl?: string | null;
  baselineUrl?: string | null;
  isBaseline?: boolean;
  diffMode?: DiffMode | "none";
  processing?: ImageProcessing;
  sdrTransfer?: DisplayCurveId;
  // --- hdr ---------------------------------------------------------------
  hdr?: FloatImageData;
  tonemapOp?: DisplayCurveId;
  // --- shared display parameters (scalars only) ---------------------------
  colormap: Colormap | null;
  tonemapGamma: number;
  effectiveExposure: number;
  effectiveOffset: number;
  effectiveReduce: ReduceMode;
  colorBounds: readonly [number, number] | null;
  boundsEngaged?: boolean;
}

export interface CpuContent {
  /** The frame to paint; HELD across a pipeline rerun (never cleared). */
  source: PaintSource | null;
  /** Bumps whenever `source` changes — the paint's trigger. */
  version: number;
  dims: { w: number; h: number } | null;
  status: "ready" | "loading" | "empty";
  /** Placeholder text for the shell while `status === "loading"` (absent for
   *  the pipelines that never showed a placeholder). */
  statusText?: string;
}

const DEFAULT_PROCESSING: ImageProcessing = {
  brightness: 0,
  contrast: 0,
  gamma: 1,
  exposure: 0,
  offset: 0,
  flipSign: false,
};

// ---------------------------------------------------------------------------
// The bitmap store. One entry per content key. See `bitmap-cache.ts` for why it
// never destroys an evicted value and never displaces a resident one: a mounted
// pane holds the bitmap it committed and re-blits it on every viewport change.
// ---------------------------------------------------------------------------
const BITMAP_CACHE_MAX = 50;
const bitmapCache = createBitmapCache<PaintSource>(BITMAP_CACHE_MAX);

/** A stable string id per object identity — the float HDR buffer has no content
 *  key of its own, and its identity IS its cache identity (the pane's `hdr` is
 *  memoized upstream; `useDeepFlatten` produces a new object per flatten). */
const objectIds = new WeakMap<object, string>();
let nextObjectId = 0;
function objectKey(value: object): string {
  let id = objectIds.get(value);
  if (id === undefined) {
    id = `#${++nextObjectId}`;
    objectIds.set(value, id);
  }
  return id;
}

/** `createImageBitmap` where available; an offscreen canvas otherwise (older
 *  engines / non-browser test hosts) — `drawImage` accepts either. */
async function toPaintSource(data: ImageData): Promise<PaintSource> {
  if (typeof createImageBitmap === "function") {
    return { bitmap: await createImageBitmap(data), width: data.width, height: data.height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")?.putImageData(data, 0, 0);
  return { bitmap: canvas, width: data.width, height: data.height };
}

/**
 * The PLAIN path's bitmap, straight from the decoded image element — no
 * `ImageData` round trip. This matters beyond speed: `loadImageData` reads back
 * a canvas, which a cross-origin image without CORS headers taints, and the old
 * pane displayed such an image fine through its `<img>`. Decoding to a bitmap
 * keeps that working (only pixel READBACK is restricted, and only the TEV
 * numbers/histogram depend on that).
 */
async function bitmapFromUrl(url: string): Promise<PaintSource | null> {
  const img = new Image();
  img.decoding = "async";
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (!ok) return null;
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (typeof createImageBitmap === "function") {
    try {
      return { bitmap: await createImageBitmap(img), width, height };
    } catch {
      /* fall through to the element itself — `drawImage` accepts it */
    }
  }
  return { bitmap: img, width, height };
}

/**
 * The one production path: the bitmap store, then the shared `ImageData` LRU,
 * then `produce()`. Never calls `getImageData` on a produced bitmap, and never
 * displaces a resident entry (`claim`) — a cancelled or duplicate run converges
 * on whatever a mounted pane is already painting instead of replacing it.
 */
async function bitmapFor(key: string, produce: () => Promise<ImageData | null>): Promise<PaintSource | null> {
  const resident = bitmapCache.get(key);
  if (resident) return resident;
  let data = getCachedImageData(key);
  if (!data) {
    const produced = await produce();
    if (!produced) return null;
    data = produced;
    setCachedImageData(key, data);
  }
  // `claim` returns the incumbent if a concurrent run won the race while this
  // one awaited, so every caller converges on the ONE entry panes are painting.
  return bitmapCache.claim(key, await toPaintSource(data));
}

interface Frame {
  key: string;
  source: PaintSource;
}

export function useCpuContent(input: CpuContentInput): CpuContent {
  const {
    kind,
    imageUrl = null,
    baselineUrl = null,
    isBaseline = false,
    diffMode = "none",
    sdrTransfer = "srgb",
    hdr,
    tonemapOp = "srgb",
    colormap,
    tonemapGamma,
    effectiveExposure,
    effectiveOffset,
    effectiveReduce,
    colorBounds,
    boundsEngaged = false,
  } = input;

  // The processing block bound to the key fragment that names it. Every effect
  // below CAPTURES this object at effect time (`const proc = pass`) and takes
  // both its key and its pixel math from that one capture — never from a ref
  // read after an `await`, which would file the pixels of a newly-selected
  // block under the key of the one the effect started with. See `ProcessingPass`
  // in `processing.ts`; `processing.test.ts` pins the pairing.
  const pass = processingPass(input.processing ?? DEFAULT_PROCESSING);
  // The SCALAR identity — a dependency that survives an inline-authored object
  // literal re-creating the block every render.
  const processingKey = pass.key;

  const [frame, setFrame] = useState<Frame | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState<{ key: string; text?: string } | null>(null);
  const frameRef = useRef<Frame | null>(null);

  const commit = useCallback((key: string, source: PaintSource) => {
    // Unconditionally: only the pipeline the current render selected can reach
    // here (every other run is cancelled by its effect cleanup), so ANY commit
    // means the pane is showing what it should. Keying this to the loading
    // entry's own key stranded the placeholder whenever the pane switched to a
    // pipeline whose result was already resident (that path commits a DIFFERENT
    // key), leaving "computing diff..." pulsing forever over a correct frame.
    setLoading(null);
    const current = frameRef.current;
    if (current && current.key === key && current.source === source) return;
    frameRef.current = { key, source };
    setFrame(frameRef.current);
    setVersion((v) => v + 1);
  }, []);

  /**
   * Run one pipeline. A resident bitmap commits SYNCHRONOUSLY (a cached flip
   * never shows a placeholder); otherwise the pane keeps its current frame while
   * `produce` runs. Returns the effect's cleanup.
   */
  const run = useCallback(
    (key: string, text: string | undefined, produce: () => Promise<PaintSource | null>): (() => void) => {
      const resident = bitmapCache.get(key);
      if (resident) {
        commit(key, resident);
        return () => {};
      }
      let cancelled = false;
      setLoading((prev) => (prev && prev.key === key && prev.text === text ? prev : { key, text }));
      void (async () => {
        let produced: PaintSource | null = null;
        try {
          produced = await produce();
        } catch (err) {
          console.warn("cairn-plot: CPU image content failed", err);
        }
        // A failed production leaves the pane on its previous frame with the
        // placeholder up — exactly what the pre-viewport pane did.
        if (cancelled || !produced) return;
        commit(key, produced);
      })();
      return () => {
        cancelled = true;
      };
    },
    [commit],
  );

  // -----------------------------------------------------------------------
  // Pipeline selection — the SDR branch's historic mutually-exclusive rules.
  // -----------------------------------------------------------------------
  const sdr = kind === "sdr";
  const showDiff = sdr && !isBaseline && diffMode !== "none" && baselineUrl != null && imageUrl != null;
  const isDiffActive = diffMode !== "none" && baselineUrl != null;
  const useFalseColor = sdr && colormap != null && !showDiff && !(isBaseline && isDiffActive) && imageUrl != null;
  const useDirect = sdr && imageUrl != null && !showDiff && !useFalseColor;
  const useTransfer = useDirect && (sdrTransfer !== "srgb" || effectiveExposure !== 0 || effectiveOffset !== 0);

  const boundsKey = colorBounds ? `${colorBounds[0]},${colorBounds[1]}` : "auto";

  // --- FALSE COLOR --------------------------------------------------------
  useEffect(() => {
    if (!useFalseColor || !imageUrl) return;
    // Captured at effect time: `proc.key` names the entry and `proc.apply`
    // fills it, so the two can never come from different renders.
    const proc = pass;
    const key = `${imageUrl}::${colormap}::${effectiveExposure}::${effectiveOffset}::${effectiveReduce}::${boundsKey}::proc(${proc.key})`;
    return run(key, "applying colormap...", () =>
      bitmapFor(key, async () => {
        const src = await loadImageData(imageUrl);
        if (!src) return null;
        const field = imageDataToSceneField(src);
        const mapped = tonemapToImageData(
          { pixels: floatValues(field.pixels), shape: [field.height, field.width, 4], dtype: "<f4" },
          "srgb",
          colorBounds ? 0 : effectiveExposure,
          tonemapGamma,
          colorBounds ? 0 : effectiveOffset,
          colormap,
          "linear",
          colorBounds?.[0],
          colorBounds?.[1],
          1,
          effectiveReduce,
        );
        return proc.apply(mapped);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useFalseColor, imageUrl, colormap, effectiveExposure, effectiveOffset, effectiveReduce, boundsKey, tonemapGamma, processingKey, run]);

  // --- DIRECT (the plain source, optionally through the display transfer) --
  useEffect(() => {
    if (!useDirect || !imageUrl) return;
    // Captured at effect time — see the FALSE COLOR effect.
    const proc = pass;
    const key = useTransfer
      ? `${imageUrl}::transfer::${sdrTransfer}::${tonemapGamma}::${effectiveExposure}::${effectiveOffset}::proc(${proc.key})`
      : `${imageUrl}::plain::proc(${proc.key})`;
    return run(key, useTransfer ? "applying transfer..." : undefined, async () => {
      // The untouched source: decode straight to a bitmap (the old `<img>` fast
      // path — no readback, so a cross-origin image still displays).
      if (!useTransfer && proc.isIdentity) {
        const direct = await bitmapFromUrl(imageUrl);
        return direct && bitmapCache.claim(key, direct);
      }
      return bitmapFor(key, async () => {
        const src = await loadImageData(imageUrl);
        if (!src) return null;
        return proc.apply(
          useTransfer
            ? sdrTransferToImageData(src, sdrTransfer, tonemapGamma, effectiveExposure, effectiveOffset)
            : src,
        );
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDirect, useTransfer, imageUrl, sdrTransfer, tonemapGamma, effectiveExposure, effectiveOffset, processingKey, run]);

  // --- DIFF ---------------------------------------------------------------
  useEffect(() => {
    if (!showDiff || !imageUrl || !baselineUrl) return;
    // Captured at effect time — see the FALSE COLOR effect.
    const proc = pass;
    const key = `${baselineUrl}::${imageUrl}::${diffMode}::${colormap}::${effectiveExposure}::${effectiveOffset}::proc(${proc.key})`;
    const cmapMode: "linear" | "signed" | "positive" = (diffMode as string).includes("signed")
      ? "signed"
      : "positive";
    return run(key, "computing diff...", async () => {
      // WebGL 2 acceleration: the offscreen render target IS the paint source —
      // no `getImageData` readback. Usable only when `processing` is the identity
      // (otherwise the display stage needs the pixels) and only when the CPU
      // result is not already cached.
      if (proc.isIdentity && !getCachedImageData(key)) {
        const [baseData, otherData] = await Promise.all([loadImageData(baselineUrl), loadImageData(imageUrl)]);
        if (!baseData || !otherData) return null;
        try {
          const canvas = document.createElement("canvas");
          const dims = webglRenderDiffToCanvas(
            baseData,
            otherData,
            { diffMode: diffMode as DiffMode, colormap: colormap != null ? getColormapLUT(colormap) : null, cmapMode },
            canvas,
          );
          if (dims) {
            return bitmapCache.claim(key, { bitmap: canvas, width: dims.width, height: dims.height });
          }
        } catch (err) {
          console.warn("cairn-plot: WebGL 2 diff acceleration failed; using CPU", err);
        }
      }
      return bitmapFor(key, async () => {
        const [baseData, otherData] = await Promise.all([loadImageData(baselineUrl), loadImageData(imageUrl)]);
        if (!baseData || !otherData) return null;
        let diffData = computeDiff(baseData, otherData, diffMode as DiffMode);
        if (colormap != null) {
          diffData = applyColormap(diffData, colormap, cmapMode, effectiveExposure, effectiveOffset);
        }
        return proc.apply(diffData);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineUrl, imageUrl, diffMode, showDiff, colormap, effectiveExposure, effectiveOffset, processingKey, run]);

  // --- HDR ----------------------------------------------------------------
  useEffect(() => {
    if (kind !== "hdr" || !hdr) return;
    const key = `hdr${objectKey(hdr)}::${tonemapOp}::${colormap}::${effectiveExposure}::${effectiveOffset}::${tonemapGamma}::${effectiveReduce}::${boundsEngaged ? boundsKey : "off"}`;
    return run(key, undefined, () =>
      bitmapFor(key, async () =>
        tonemapToImageData(
          hdr,
          tonemapOp,
          effectiveExposure,
          // The output-encode transfer selected by the operator in effect
          // (gamma → γ, linear → identity, else the sRGB OETF).
          resolveEncodeGamma(tonemapOp, tonemapGamma),
          effectiveOffset,
          // Colormap (LUT family): active → the scalar channel is false-colored
          // and the tone-map operator is bypassed (see tonemapToImageData).
          colormap,
          // Phase 4 DATA-encoding bounds (colormap only). With bounds engaged,
          // `tonemapToImageData` reads the RAW value (EV/OFF are neutralized by
          // the caller to avoid a double-apply). Norm is always LINEAR.
          "linear",
          boundsEngaged && colorBounds ? colorBounds[0] : undefined,
          boundsEngaged && colorBounds ? colorBounds[1] : undefined,
          1,
          // The reduce (luminance/mean) that collapses a k>1 colormap source to
          // the LUT scalar. Moot for k=1.
          effectiveReduce,
        ),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, hdr, tonemapOp, colormap, effectiveExposure, effectiveOffset, tonemapGamma, effectiveReduce, boundsKey, boundsEngaged, run]);

  const hasContent = kind === "hdr" ? !!hdr : imageUrl != null;
  const source = frame?.source ?? null;
  return useMemo<CpuContent>(() => {
    const status: CpuContent["status"] = !hasContent
      ? "empty"
      : loading
        ? "loading"
        : source
          ? "ready"
          : "loading";
    return {
      source,
      version,
      dims: source ? { w: source.width, h: source.height } : null,
      status,
      statusText: status === "loading" ? loading?.text : undefined,
    };
  }, [hasContent, loading, source, version]);
}
