/**
 * CpuImagePane — the CPU (2D-canvas) image backend. One of TWO interchangeable
 * image backends (see `GpuImagePane.tsx` for the WebGPU one): both accept the
 * SAME `ImageBackendProps` union (`renderers/image-backend.ts`) and are chosen
 * upstream by the user-settable render mode (`resolveRenderMode` — cpu | gpu |
 * auto), so the rest of the app is backend-agnostic.
 *
 * ## One component, two prop shapes (mirrors `GpuImagePane` exactly)
 * `isHdrProps(props)` (presence of `hdr`) selects the branch:
 *   - SDR (`imageUrl` shape) — the former `ImagePane`'s FULL path, ported
 *     verbatim: `<img>` display with `processing` CSS/SVG filters
 *     (gamma/offset/flipSign via `useGammaFilter`), CPU `applyColormap`
 *     false-color canvas, and the legacy `baselineUrl`/`diffMode` pixel-diff
 *     pipeline (`computeDiff`/`webglRenderDiffToCanvas`).
 *   - HDR (`hdr` float shape) — the former `HdrImagePane`'s
 *     tonemap-to-canvas path: `tonemapToImageData(hdr, tonemap, exposure,
 *     gamma)` per-pixel → `putImageData`.
 * ASYMMETRY (unchanged from before the unification): the HDR branch has no
 * colormap / compare-diff / `processing` — those props only exist on the SDR
 * shape (`SdrImageProps`), exactly as the two separate panes had it.
 *
 * ## Shared plumbing — the shared `ImagePaneShell`
 * Both branches render through `renderers/ImagePaneShell.tsx` (the ONE frame
 * all three image panes share): it owns the `useImageViewport` zoom/pan
 * (modifier-gated wheel zoom-to-cursor + drag pan), the TEV `PixelValueOverlay`
 * mount + notation state, the double-click viewport reset, and the
 * `PlotToolbar` + `useImageController` wiring (notation leading button
 * included, so the two backends look the same). This CPU backend passes the
 * bits that are genuinely its own: the CSS `translate(pan) scale(zoom)`
 * transform (`wrapperStyle`), the checkerboard-on-the-padded-pane placement,
 * and its `<img>`/`<canvas>` surface.
 *
 * ## `toolbar` (shim compatibility)
 * The legacy `ImagePane.tsx`/`HdrImagePane.tsx` shims forward here with
 * `toolbar={false}`, preserving the exact pre-unification chrome for app-card
 * consumers (`media-compare/compositor.tsx` etc.): no `PlotToolbar`, the
 * free-floating `PixelNotationToggle` chip instead of the toolbar's leading
 * button. Backend-seam mounts (`resolveImageRenderer` / `GpuImagePane`'s C1
 * fallback) use the default `toolbar={true}`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Colormap, DiffMode } from "../types";
import { useGammaFilter, GammaFilterSvg } from "../media-compare/post-processing";
import ImageOverlay from "./ImageOverlay";
import {
  computeDiff,
  loadImageData,
  webglRenderDiffToCanvas,
  getRenderMode,
  getCachedImageData,
  setCachedImageData,
} from "../image";
import { applyColormap, getColormapLUT } from "../colormaps";
// Pure sequential-vs-diverging rule (no GPU/engine deps — see its module doc);
// safe to pull into the CPU pane / core bundle.
import { resolveColormapMode } from "../engine/diff-cmap-mode";
import { f16BitsToFloat32, halfToFloat } from "../image/half";
import {
  getTonemapOperator,
  toSdrTonemap,
  applyExposureOffset,
  outputEncode,
  type RgbTriple,
  type TonemapOperator,
} from "../image/tonemap";
import {
  buildChannelSample,
  type PixelSample,
  type PixelValueNotation,
} from "../primitives/PixelValueOverlay";
import ImagePaneShell from "./ImagePaneShell";
import { colormapToolbarButton, tonemapToolbarButton } from "./use-image-controller";
import { useResettableState } from "../hooks/use-resettable-state";
import { useDeepFlatten } from "./use-deep-flatten";
import {
  isHdrProps,
  shapeDims,
  finite,
  type HdrData,
  type HdrImageProps,
  type SdrImageProps,
  type ImageBackend,
} from "./image-backend";
import type { ImageProcessing } from "../types";

const DEFAULT_PROCESSING: ImageProcessing = {
  brightness: 0,
  contrast: 0,
  gamma: 1,
  exposure: 0,
  offset: 0,
  flipSign: false,
};

// ---------------------------------------------------------------------------
// HDR tone-map (moved verbatim from HdrImagePane.tsx; re-exported there).
// ---------------------------------------------------------------------------

/**
 * Tone-map the float HDR buffer into an 8-bit RGBA `ImageData`. Pure — no DOM
 * beyond the `ImageData` allocation. Exposure → operator → output-encode per
 * pixel, exactly the pipeline documented in `tonemap.ts`.
 */
export function tonemapToImageData(
  hdr: HdrData,
  tonemap: string,
  exposure: number,
  gamma?: number,
  offset: number = 0,
): ImageData {
  const { h, w, c } = shapeDims(hdr.shape);
  // F16 pipeline: this is the CPU tone-map FALLBACK path (used when the GPU
  // backend is unavailable), so a `precision:"f16-bits"` source is widened to
  // f32 ONCE for the whole frame here (see `../image/half.ts`) rather than
  // kept half — the GPU path keeps the bits; only this fallback pays the copy.
  const src =
    hdr.precision === "f16-bits" ? f16BitsToFloat32(hdr.data as Uint16Array) : hdr.data;
  const op = getTonemapOperator(tonemap);
  const out = new Uint8ClampedArray(w * h * 4);

  for (let i = 0; i < w * h; i++) {
    const base = i * c;
    let r: number;
    let g: number;
    let b: number;
    let a = 1;
    if (c === 1) {
      r = g = b = finite(src[base]!);
    } else if (c === 3) {
      r = finite(src[base]!);
      g = finite(src[base + 1]!);
      b = finite(src[base + 2]!);
    } else {
      // c === 4 (rgba); alpha passes through the encode as a plain [0,1] value.
      r = finite(src[base]!);
      g = finite(src[base + 1]!);
      b = finite(src[base + 2]!);
      a = finite(src[base + 3]!);
    }

    // 1) exposure + offset (TEV) in scene-linear, 2) tone-map HDR→[0,1],
    //    3) output-encode. Offset is added after exposure, before the operator.
    const lit: RgbTriple = [
      applyExposureOffset(r, exposure, offset),
      applyExposureOffset(g, exposure, offset),
      applyExposureOffset(b, exposure, offset),
    ];
    const [tr, tg, tb] = op(lit);
    const o = i * 4;
    out[o] = 255 * outputEncode(tr, gamma);
    out[o + 1] = 255 * outputEncode(tg, gamma);
    out[o + 2] = 255 * outputEncode(tb, gamma);
    // Alpha is a coverage value, not light — clamp to [0,1], no tone-map.
    out[o + 3] = 255 * (a < 0 ? 0 : a > 1 ? 1 : a);
  }
  return new ImageData(out, w, h);
}

// ---------------------------------------------------------------------------
// SDR branch — the former ImagePane body (decode/colormap/diff effects ported
// verbatim), rendering its display element through the shared shell.
// ---------------------------------------------------------------------------

function CpuSdrImagePane(props: SdrImageProps & { toolbar?: boolean }) {
  const {
    imageUrl,
    baselineUrl = null,
    isBaseline = false,
    diffMode = "none",
    interpolation = "auto",
    colormap: colormapProp = "none",
    showAxes = false,
    processing = DEFAULT_PROCESSING,
    zoom: zoomProp = 1,
    pan: panProp = { x: 0, y: 0 },
    onViewportChange,
    onNaturalSize,
    label,
    isDraggable = false,
    onDragStart,
    overlay,
    overlaySettings,
    pixelValueNotation = "decimal",
    toolbar = true,
  } = props;

  // Colormap: the `colormap` prop SEEDS a view-local override so the toolbar
  // COLORMAP menu can switch it in-pane (diff-kernels toolbar track). Re-seeds
  // on prop change (the app card's colormap control) — a controlled surface
  // until the user overrides it locally. (Only surfaces when the toolbar shows,
  // i.e. `toolbar={true}` backend-seam mounts, not the legacy `toolbar={false}`
  // card chrome — see report note on the card-control interaction.)
  // Descriptor default captured at mount; HOME restores the view-local colormap
  // override (and `isModified` enables it while off-default) — same contract as
  // GpuImagePane / the compare pane, now via the shared `useResettableState`.
  const [colormap, setColormap, colormapMeta] = useResettableState<Colormap>(colormapProp);
  useEffect(() => {
    setColormap(colormapProp);
  }, [colormapProp, setColormap]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const falseColorRef = useRef<HTMLCanvasElement | null>(null);
  // The shared shell attaches these (see `ImagePaneShell`); the CPU backend
  // has no render-pass effect that reads them, but the shell needs them for
  // the viewport/controller wiring and the PixelAxes container.
  const paneRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // -----------------------------------------------------------------------
  // TEV-style per-pixel value overlay — source buffers.
  //   valueDataRef: RAW source pixels (the numbers we print).
  //   dispDataRef:  the pixels actually SHOWN (for auto-contrast luminance).
  // The displayed element (img|canvas) is tracked via `displayElRef` so the
  // overlay can read its live on-screen rect (post zoom/pan).
  // -----------------------------------------------------------------------
  const displayElRef = useRef<HTMLElement | null>(null);
  const valueDataRef = useRef<ImageData | null>(null);
  const dispDataRef = useRef<ImageData | null>(null);
  const [pixelDataVersion, setPixelDataVersion] = useState(0);
  const bumpPixelData = useCallback(() => setPixelDataVersion((v) => v + 1), []);

  // Screenshot target: the displayed element when it IS a canvas (diff /
  // false-color paths); the plain-<img> path has no canvas, so `toPNG` falls
  // back to `plotToPng(root)` there (which requires a canvas/svg — see the
  // module doc's shim note; the toolbar only shows in backend mode anyway).
  const exportCanvasRef = useMemo(
    () => ({
      get current(): HTMLCanvasElement | null {
        const el = displayElRef.current;
        return el instanceof HTMLCanvasElement ? el : null;
      },
    }),
    [],
  );

  // Callback refs that also record the currently-displayed element (only one
  // of img/canvas/falseColor is mounted at a time) for the overlay's geometry.
  const setCanvasEl = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el) displayElRef.current = el;
  }, []);
  const setFalseColorEl = useCallback((el: HTMLCanvasElement | null) => {
    falseColorRef.current = el;
    if (el) displayElRef.current = el;
  }, []);
  const setImgEl = useCallback((el: HTMLImageElement | null) => {
    if (el) displayElRef.current = el;
  }, []);
  const [diffReady, setDiffReady] = useState(false);
  const [falseColorReady, setFalseColorReady] = useState(false);
  const [naturalDims, setNaturalDims] = useState<{
    w: number;
    h: number;
  } | null>(null);

  // -----------------------------------------------------------------------
  // SVG gamma filter + CSS filter string (shared helper)
  // -----------------------------------------------------------------------
  const { flipSign } = processing;
  const { gammaFilterId, filterStr, gamma, offset } = useGammaFilter(processing);

  // -----------------------------------------------------------------------
  // Diff / false-color rendering
  // -----------------------------------------------------------------------
  const showDiff =
    !isBaseline &&
    diffMode !== "none" &&
    baselineUrl != null &&
    imageUrl != null;

  const isDiffActive = diffMode !== "none" && baselineUrl != null;
  const useFalseColor =
    colormap !== "none" &&
    !showDiff &&
    !(isBaseline && isDiffActive) &&
    imageUrl != null;

  useEffect(() => {
    if (!useFalseColor || !imageUrl) {
      setFalseColorReady(false);
      return;
    }
    let cancelled = false;
    setFalseColorReady(false);

    const cacheKey = `${imageUrl}::${colormap}`;
    const cached = getCachedImageData(cacheKey);
    if (cached) {
      const fc = falseColorRef.current;
      if (fc) {
        fc.width = cached.width;
        fc.height = cached.height;
        const fctx = fc.getContext("2d");
        if (fctx) fctx.putImageData(cached, 0, 0);
        dispDataRef.current = cached;
        bumpPixelData();
        setNaturalDims({ w: cached.width, h: cached.height });
        onNaturalSize?.(cached.width, cached.height);
        setFalseColorReady(true);
      }
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const src = ctx.getImageData(0, 0, c.width, c.height);
      const cmapMode = resolveColormapMode(colormap);
      const mapped = applyColormap(
        src,
        colormap as Exclude<Colormap, "none">,
        cmapMode,
      );
      setCachedImageData(cacheKey, mapped);
      const fc = falseColorRef.current;
      if (!fc || cancelled) return;
      fc.width = mapped.width;
      fc.height = mapped.height;
      const fctx = fc.getContext("2d");
      if (fctx) fctx.putImageData(mapped, 0, 0);
      dispDataRef.current = mapped;
      bumpPixelData();
      setNaturalDims({ w: mapped.width, h: mapped.height });
      onNaturalSize?.(mapped.width, mapped.height);
      setFalseColorReady(true);
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useFalseColor, imageUrl, colormap]);

  const updateDims = useCallback((w: number, h: number) => {
    setNaturalDims((prev) =>
      prev && prev.w === w && prev.h === h ? prev : { w, h },
    );
    onNaturalSize?.(w, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decode the RAW source image once per url so the pixel-value overlay can
  // read true pixel values (independent of the display mode). In plain/diff
  // modes the shown pixels equal the source, so luminance reads from it too;
  // the colormap effect overrides `dispDataRef` with the mapped pixels.
  useEffect(() => {
    if (!imageUrl) {
      valueDataRef.current = null;
      dispDataRef.current = null;
      bumpPixelData();
      return;
    }
    let cancelled = false;
    loadImageData(imageUrl).then((d) => {
      if (cancelled) return;
      valueDataRef.current = d;
      if (colormap === "none") dispDataRef.current = d;
      bumpPixelData();
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, colormap, bumpPixelData]);

  const samplePixel = useCallback(
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      const vd = valueDataRef.current;
      if (!vd || px < 0 || py < 0 || px >= vd.width || py >= vd.height) return null;
      const i = (py * vd.width + px) * 4;
      const r = vd.data[i]!;
      const g = vd.data[i + 1]!;
      const b = vd.data[i + 2]!;
      // Luminance from the DISPLAYED pixels when available (colormap-mapped),
      // else from the raw source (plain path shows the source unchanged).
      const dd = dispDataRef.current;
      let lr = r, lg = g, lb = b;
      if (dd && dd.width === vd.width && dd.height === vd.height) {
        const j = (py * dd.width + px) * 4;
        lr = dd.data[j]!;
        lg = dd.data[j + 1]!;
        lb = dd.data[j + 2]!;
      }
      const luminance = (0.299 * lr + 0.587 * lg + 0.114 * lb) / 255;
      // A false-colored (colormap) or grayscale pixel prints one untinted line;
      // a true multi-channel pixel prints three channel-tinted lines.
      const single = colormap !== "none" || (r === g && g === b);
      return buildChannelSample(single ? [r] : [r, g, b], "uint8", notation, luminance);
    },
    [colormap],
  );

  useEffect(() => {
    if (!showDiff) {
      setDiffReady(false);
      return;
    }
    let cancelled = false;

    const renderMode = getRenderMode();
    const useGPU = renderMode === "gpu" || renderMode === "auto";

    const cacheKey = `${baselineUrl}::${imageUrl}::${diffMode}::${colormap}`;
    if (renderMode !== "gpu") {
      const cached = getCachedImageData(cacheKey);
      if (cached) {
        const canvas = canvasRef.current;
        if (canvas) {
          if (
            canvas.width !== cached.width ||
            canvas.height !== cached.height
          ) {
            canvas.width = cached.width;
            canvas.height = cached.height;
          }
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.putImageData(cached, 0, 0);
          updateDims(cached.width, cached.height);
          setDiffReady(true);
        }
        return;
      }
    }

    (async () => {
      const [baseData, otherData] = await Promise.all([
        loadImageData(baselineUrl!),
        loadImageData(imageUrl!),
      ]);
      if (cancelled) return;
      if (!baseData || !otherData) return;

      const isSigned = (diffMode as string).includes("signed");
      const cmapMode: "linear" | "signed" | "positive" = isSigned
        ? "signed"
        : "positive";
      const gpuLut =
        colormap !== "none"
          ? getColormapLUT(colormap as Exclude<Colormap, "none">)
          : null;
      const gpuOpts = {
        diffMode: diffMode as DiffMode,
        colormap: gpuLut,
        cmapMode,
      };

      if (useGPU) {
        try {
          const canvas = canvasRef.current;
          if (canvas) {
            const dims = webglRenderDiffToCanvas(
              baseData,
              otherData,
              gpuOpts,
              canvas,
            );
            if (dims) {
              if (cancelled) return;
              updateDims(dims.width, dims.height);
              setDiffReady(true);
              return;
            }
          }
        } catch (err) {
          console.warn("[cairn] WebGL 2 diff error:", err);
        }
      }

      if (renderMode === "gpu") {
        console.error(
          "[cairn] WebGL 2 unavailable — set render mode to 'Auto' or 'CPU'",
        );
        return;
      }
      let diffData = computeDiff(
        baseData,
        otherData,
        diffMode as DiffMode,
      );
      if (colormap !== "none") {
        diffData = applyColormap(
          diffData,
          colormap as Exclude<Colormap, "none">,
          cmapMode,
        );
      }
      setCachedImageData(cacheKey, diffData);
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      if (
        canvas.width !== diffData.width ||
        canvas.height !== diffData.height
      ) {
        canvas.width = diffData.width;
        canvas.height = diffData.height;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.putImageData(diffData, 0, 0);
      updateDims(diffData.width, diffData.height);
      setDiffReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineUrl, imageUrl, diffMode, showDiff, colormap, onNaturalSize]);

  // -----------------------------------------------------------------------
  // Render (display-element branch verbatim from ImagePane; frame = shell)
  // -----------------------------------------------------------------------
  const imgRendering =
    interpolation === "auto" ? undefined : interpolation;
  const invertStyle = flipSign ? { filter: "invert(1)" } : {};

  const overlayNode =
    overlay &&
    overlaySettings?.enabled &&
    naturalDims &&
    imageUrl &&
    ((overlay.boxes?.length ?? 0) > 0 ||
      (overlay.masks?.length ?? 0) > 0) ? (
      <ImageOverlay
        data={overlay}
        settings={overlaySettings}
        naturalWidth={naturalDims.w}
        naturalHeight={naturalDims.h}
      />
    ) : undefined;

  const surface = !imageUrl ? (
    <span className="text-xs text-fg-muted">no image</span>
  ) : showDiff ? (
    <>
      {!diffReady && (
        <span className="text-xs text-fg-muted motion-safe:animate-pulse">
          computing diff...
        </span>
      )}
      <canvas
        ref={setCanvasEl}
        className="w-full h-full object-contain block"
        style={{
          display: diffReady ? "block" : "none",
          imageRendering: imgRendering,
          ...invertStyle,
        }}
      />
    </>
  ) : useFalseColor ? (
    <>
      {!falseColorReady && (
        <span className="text-xs text-fg-muted motion-safe:animate-pulse">
          applying colormap...
        </span>
      )}
      <canvas
        ref={setFalseColorEl}
        className="w-full h-full object-contain block"
        style={{
          display: falseColorReady ? "block" : "none",
          imageRendering: imgRendering,
          ...invertStyle,
        }}
      />
    </>
  ) : (
    <img
      ref={setImgEl}
      src={imageUrl}
      alt={label}
      className="w-full h-full object-contain block"
      draggable={false}
      style={{
        filter: filterStr,
        imageRendering: imgRendering,
      }}
      onLoad={(e) => {
        const img = e.currentTarget;
        setNaturalDims({
          w: img.naturalWidth,
          h: img.naturalHeight,
        });
        onNaturalSize?.(img.naturalWidth, img.naturalHeight);
      }}
    />
  );

  return (
    <ImagePaneShell
      paneAttrs={{ "data-cpu-image-pane": "" }}
      viewportAttrs={{ "data-cpu-image-viewport": "" }}
      toolbar={toolbar}
      paneRef={paneRef}
      wrapperRef={wrapperRef}
      zoom={zoomProp}
      pan={panProp}
      onViewportChange={onViewportChange}
      naturalDims={naturalDims}
      checkerboard="pane"
      wrapperClassName="relative w-full h-full"
      // The CPU backend zooms by physically growing the wrapper (CSS
      // transform), unlike the GPU backend's uvRect crop.
      wrapperStyle={{
        transform: `translate(${panProp.x}px, ${panProp.y}px) scale(${zoomProp})`,
        transformOrigin: "0 0",
      }}
      viewportPadding={showAxes && naturalDims ? "16px 4px 4px 28px" : "4px"}
      header={<GammaFilterSvg id={gammaFilterId} gamma={gamma} offset={offset} />}
      surface={surface}
      showAxes={showAxes}
      overlayNode={overlayNode}
      overlay={{
        displayElRef,
        sample: samplePixel,
        version: pixelDataVersion,
        hasSource: !!imageUrl,
      }}
      notationSeed={pixelValueNotation}
      exportCanvasRef={exportCanvasRef}
      // SDR single-image: a view-local COLORMAP menu (shown only when the
      // toolbar renders — `toolbar={true}` backend-seam mounts).
      leadingMenus={[colormapToolbarButton(colormap, (id) => setColormap(id as Colormap))]}
      onReset={colormapMeta.reset}
      extraModified={colormapMeta.isModified}
      // NO EXPOSURE/OFFSET sliders here (graceful degradation, §requirement B):
      // the CPU SDR path shows already-encoded 8-bit pixels via a plain `<img>`
      // (or a colormap/diff `<canvas>`), with no scene-linear pixel-recompute
      // stage to apply `color*2^EV + offset` in. Applying it would need a full
      // per-pixel re-encode pipeline this path doesn't have. The GPU SDR backend
      // (`GpuImagePane`) applies both in-shader, and the CPU HDR path recomputes
      // its tone-map pass — so `displayAdjust` is wired there, just not here.
      label={label}
      showLabelChip
      isDraggable={isDraggable}
      onDragStart={onDragStart}
    />
  );
}

// ---------------------------------------------------------------------------
// HDR branch — the former HdrImagePane body (single CPU tone-map pass ported
// verbatim), rendering its canvas through the shared shell. No colormap /
// compare-diff / processing here — asymmetric by design (see module doc).
// ---------------------------------------------------------------------------

function CpuHdrImagePane(props: HdrImageProps & { toolbar?: boolean }) {
  const {
    tonemap = "srgb",
    exposure = 0,
    gamma,
    showAxes = false,
    label = "",
    interpolation = "auto",
    zoom = 1,
    pan = { x: 0, y: 0 },
    onViewportChange,
    pixelValueNotation = "decimal",
    toolbar = true,
  } = props;

  // DEEP EXR depth slider: `hdr` is the live-flattened effective source; the
  // depth slider + HOME reset ride the shell (absent for non-deep sources).
  const deepFlatten = useDeepFlatten(props.hdr);
  const hdr = deepFlatten.hdr;

  // TONE-MAP operator (view-local override for the toolbar menu). Seeded from
  // the descriptor `tonemap=` prop (validated to an SDR operator; default
  // "srgb") and re-seeded on prop change — same controlled-surface contract as
  // the colormap override on the SDR pane. The CPU pane tone-maps to an 8-bit
  // ImageData (no real HDR surface), so "extended" is NOT offered — the menu
  // shows Linear/sRGB/Reinhard/ACES only. HOME restores the descriptor default.
  const [tonemapOp, setTonemapOp, tonemapMeta] = useResettableState<TonemapOperator>(
    toSdrTonemap(tonemap),
  );
  useEffect(() => {
    setTonemapOp(toSdrTonemap(tonemap));
  }, [tonemap, setTonemapOp]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  // Retained tone-mapped pixels — used for the overlay's auto-contrast.
  const dispDataRef = useRef<ImageData | null>(null);
  const [pixelDataVersion, setPixelDataVersion] = useState(0);

  // EXPOSURE / OFFSET display-adjust sliders (§requirement B). View-local,
  // display-only — recomputes the CPU tone-map pass (like a tonemap/exposure
  // change already does), never a diff. The display EV ADDS to the prop exposure.
  const [displayEV, setDisplayEV] = useState(0);
  const [displayOffset, setDisplayOffset] = useState(0);

  // Single CPU tone-map pass; reruns on data / tonemap / exposure / gamma /
  // display-adjust.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let imageData: ImageData;
    try {
      imageData = tonemapToImageData(hdr, tonemapOp, exposure + displayEV, gamma, displayOffset);
    } catch (err) {
      console.error("[cairn] HDR tone-map error:", err);
      return;
    }
    if (canvas.width !== imageData.width || canvas.height !== imageData.height) {
      canvas.width = imageData.width;
      canvas.height = imageData.height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
    dispDataRef.current = imageData;
    setPixelDataVersion((v) => v + 1);
    setDims((prev) =>
      prev && prev.w === imageData.width && prev.h === imageData.height
        ? prev
        : { w: imageData.width, h: imageData.height },
    );
  }, [hdr, tonemapOp, exposure, gamma, displayEV, displayOffset]);

  // TEV-style per-pixel value overlay: reads the RAW float samples so the
  // numbers are the true scene values (not the tone-mapped display pixels).
  const samplePixel = useCallback(
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      const d = dims;
      if (!d || px < 0 || py < 0 || px >= d.w || py >= d.h) return null;
      const c = hdr.shape.length === 2 ? 1 : (hdr.shape[2] ?? 1);
      const base = (py * d.w + px) * c;
      const src = hdr.data;
      // F16 pipeline: widen the touched samples lazily (single pixel).
      const readV =
        hdr.precision === "f16-bits"
          ? (k: number) => halfToFloat(src[k] ?? 0)
          : (k: number) => src[k] ?? 0;
      const disp = dispDataRef.current;
      let luminance = 0.5;
      if (disp && disp.width === d.w && disp.height === d.h) {
        const j = (py * d.w + px) * 4;
        luminance =
          (0.299 * disp.data[j]! +
            0.587 * disp.data[j + 1]! +
            0.114 * disp.data[j + 2]!) /
          255;
      }
      const values =
        c === 1 ? [readV(base)] : [readV(base), readV(base + 1), readV(base + 2)];
      return buildChannelSample(values, "unit", notation, luminance);
    },
    [hdr, dims],
  );

  const imgRendering = interpolation === "auto" ? undefined : interpolation;

  return (
    <ImagePaneShell
      paneAttrs={{ "data-cpu-image-pane": "" }}
      viewportAttrs={{ "data-cpu-image-viewport": "" }}
      toolbar={toolbar}
      paneRef={paneRef}
      wrapperRef={wrapperRef}
      zoom={zoom}
      pan={pan}
      onViewportChange={onViewportChange}
      naturalDims={dims}
      checkerboard="pane"
      wrapperClassName="relative w-full h-full"
      wrapperStyle={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: "0 0",
      }}
      viewportPadding={showAxes && dims ? "16px 4px 4px 28px" : "4px"}
      surface={
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain block"
          style={{ imageRendering: imgRendering }}
        />
      }
      showAxes={showAxes}
      overlay={{
        displayElRef: canvasRef,
        sample: samplePixel,
        version: pixelDataVersion,
        hasSource: true,
      }}
      notationSeed={pixelValueNotation}
      exportCanvasRef={canvasRef}
      // TONEMAP menu (HDR/float pane). CPU tone-maps to 8-bit, so no
      // "Extended (HDR)" option (includeExtended=false). HOME restores the default.
      leadingMenus={[
        tonemapToolbarButton(tonemapOp, (id) => setTonemapOp(id as TonemapOperator), false),
      ]}
      // EXPOSURE / OFFSET display-adjust sliders — the CPU HDR tone-map pass
      // applies them (recomputed like any exposure/tonemap change).
      displayAdjust={{
        exposureEV: displayEV,
        offset: displayOffset,
        onExposureChange: setDisplayEV,
        onOffsetChange: setDisplayOffset,
      }}
      // DEEP depth-window sliders (Z-NEAR/Z-FAR) + region-select (absent for
      // non-deep); HOME resets the window to [zMin,zMax] and the tonemap override.
      depthSliders={deepFlatten.sliders}
      regionSelect={
        deepFlatten.hasDeep
          ? {
              rect: deepFlatten.region,
              commit: deepFlatten.commitRegion,
              remove: deepFlatten.removeRegion,
            }
          : undefined
      }
      onReset={() => {
        deepFlatten.reset();
        tonemapMeta.reset();
      }}
      extraModified={deepFlatten.isModified || tonemapMeta.isModified}
      label={label}
      showLabelChip={!!label}
    />
  );
}

// ---------------------------------------------------------------------------
// Public component.
// ---------------------------------------------------------------------------

/** `ImageBackendProps` plus the shim-only chrome flag (see module doc). */
export type CpuImagePaneProps =
  | (HdrImageProps & { toolbar?: boolean })
  | (SdrImageProps & { toolbar?: boolean });

/**
 * One of the two interchangeable image backends (the CPU/2D-canvas one — see
 * `GpuImagePane` for the WebGPU other); both accept `ImageBackendProps` and
 * are assignable to `ImageBackend`.
 */
export default function CpuImagePane(props: CpuImagePaneProps): JSX.Element {
  return isHdrProps(props) ? (
    <CpuHdrImagePane {...props} />
  ) : (
    <CpuSdrImagePane {...props} />
  );
}

// Compile-time contract check: CpuImagePane implements the shared backend
// interface (accepts the plain `ImageBackendProps` union — `toolbar` is
// optional, so the plain union is assignable to `CpuImagePaneProps`).
const _backendCheck: ImageBackend = CpuImagePane;
void _backendCheck;
