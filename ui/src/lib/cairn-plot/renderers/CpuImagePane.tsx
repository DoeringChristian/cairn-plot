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
 * ## `toolbar` (the shared host seam)
 * `toolbar?: boolean` (default `true`) is now an OFFICIAL host seam on the shared
 * `ImageBackendProps` contract — the SAME prop `GpuImagePane`/`GpuComparePane`
 * accept, so all three panes hide the toolbar identically. When `false` the shell
 * renders NO `PlotToolbar` (and no hover `group`); the ONLY floating affordance
 * kept is the `PixelNotationToggle` chip while the TEV overlay is active — the
 * long-standing CPU convention, now unified across every pane (see
 * `ImagePaneShell`). The app-card compositor (`media-compare/compositor.tsx`)
 * still forwards `toolbar={false}` for its per-side chrome; a host that wants its
 * own menu passes `toolbar={false}` from `cp.Image(toolbar=False)` and drives the
 * view through the controlled props (colormap / tonemap / peak / gamma / base
 * exposure+offset). Backend-seam mounts (`resolveImageRenderer` /
 * `GpuImagePane`'s C1 fallback) use the default `toolbar={true}`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import PaneUnavailable from "../primitives/PaneUnavailable";
import type { Colormap, DiffMode, Interpolation } from "../types";
import { autoImageRendering, containScreenPxPerTexel } from "./interp-auto";
// The ONE shared magnification threshold — the SAME constant `GpuImagePane`
// reads for its nearest/linear sampler switch (and `PixelValueOverlay` for its
// per-pixel numbers), so the CPU pane's `pixelated` flip stays in lockstep.
import { PIXEL_VALUE_MIN_SCREEN_PX } from "../primitives/PixelValueOverlay";
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
  canonicalizeColorspace,
  applyExposureOffset,
  outputEncode,
  normalMapEncode,
  srgbEotf,
  resolveEncodeGamma,
  tonemapHasGamma,
  TONEMAP_GAMMA_DEFAULT,
  TONEMAP_GAMMA_MIN,
  TONEMAP_GAMMA_MAX,
  TONEMAP_GAMMA_STEP,
  type RgbTriple,
  type TonemapOperator,
  type ImageColorspace,
} from "../image/tonemap";
import {
  buildChannelSample,
  type PixelSample,
  type PixelValueNotation,
} from "../primitives/PixelValueOverlay";
import ImagePaneShell from "./ImagePaneShell";
import { u8HistogramSource, floatHistogramSource } from "./image-histogram-source";
import { useSyncedImageSettings } from "./use-synced-image-settings";
import type { ImageSyncSettings } from "../viewport/image-settings-sync";
import {
  colormapToolbarButton,
  tonemapToolbarButton,
  displayTransferToolbarButton,
  colorspaceToolbarButton,
} from "./use-image-controller";
import { useResettableState } from "../hooks/use-resettable-state";
import { useDeepFlatten } from "./use-deep-flatten";
import {
  isHdrProps,
  useLegacyImageProps,
  shapeDims,
  finite,
  type HdrData,
  type HdrImageProps,
  type SdrImageProps,
  type ImageBackend,
  type ImageBackendProps,
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
  colorspace: string = "linear",
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

    // NORMAL-MAP colorspace: remap the float source [-1,1]→[0,1] per channel and
    // write it DIRECTLY, bypassing exposure/tone-map/output-encode (a normal is
    // geometry, not light). Mirrors image.wgsl.ts's u_bind9 short-circuit exactly.
    if (colorspace === "normal") {
      const o = i * 4;
      out[o] = 255 * normalMapEncode(r);
      out[o + 1] = 255 * normalMapEncode(g);
      out[o + 2] = 255 * normalMapEncode(b);
      out[o + 3] = 255 * (a < 0 ? 0 : a > 1 ? 1 : a);
      continue;
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

/**
 * Apply an SDR DISPLAY TRANSFER (tev sRGB · Gamma · Linear) to an already-sRGB
 * 8-bit `ImageData`, returning a new `ImageData`. Mirrors the GPU shader's plain-
 * SDR path (`srgbDecode → clamp → output-encode`) at EV=0/offset=0, so the CPU
 * fallback matches `GpuImagePane` to within 8-bit rounding:
 *   linear = srgbEotf(v/255) → clamp01 → out = 255·outputEncode(linear, gEnc)
 * where `gEnc = resolveEncodeGamma(operator, γ)` (gamma → γ, linear → 1/identity,
 * srgb → undefined/sRGB OETF). For `srgb` this is a bit-exact round-trip (so the
 * pane keeps the plain `<img>` there — no recompute); this runs for gamma/linear.
 * Alpha passes through unchanged.
 */
export function sdrTransferToImageData(
  src: ImageData,
  operator: string,
  gamma?: number,
): ImageData {
  const gEnc = resolveEncodeGamma(operator, gamma ?? TONEMAP_GAMMA_DEFAULT);
  const out = new Uint8ClampedArray(src.data.length);
  const d = src.data;
  for (let i = 0; i < d.length; i += 4) {
    out[i] = 255 * outputEncode(srgbEotf(d[i]! / 255), gEnc);
    out[i + 1] = 255 * outputEncode(srgbEotf(d[i + 1]! / 255), gEnc);
    out[i + 2] = 255 * outputEncode(srgbEotf(d[i + 2]! / 255), gEnc);
    out[i + 3] = d[i + 3]!;
  }
  return new ImageData(out, src.width, src.height);
}

/**
 * Resolve the CSS `image-rendering` for a CPU image pane, applying the SHARED
 * auto-interpolation threshold (`interp-auto.ts`) so `interpolation === "auto"`
 * snaps to `pixelated` at the SAME zoom the GPU pane switches to `nearest` —
 * once one source texel covers `PIXEL_VALUE_MIN_SCREEN_PX` screen px. An
 * explicit `pixelated`/`crisp-edges` bypasses the threshold (returned verbatim,
 * matching the pre-threshold behavior). The CPU backend zooms by physically
 * scaling its wrapper (`transform: scale(zoom)`), so the on-screen texel size is
 * the UNSCALED layout box (measured via `ResizeObserver`) × `zoom`. Shared by
 * both the SDR and HDR CPU branches.
 */
function useAutoImageRendering(
  wrapperRef: RefObject<HTMLDivElement | null>,
  zoom: number,
  naturalDims: { w: number; h: number } | null,
  interpolation: Interpolation,
): "pixelated" | "crisp-edges" | undefined {
  const [layoutBox, setLayoutBox] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[entries.length - 1]?.contentRect;
      if (!cr) return;
      setLayoutBox((prev) =>
        prev && prev.width === cr.width && prev.height === cr.height
          ? prev
          : { width: cr.width, height: cr.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrapperRef]);

  if (interpolation !== "auto") return interpolation;
  if (!layoutBox || !naturalDims) return undefined;
  const screenPxPerTexel = containScreenPxPerTexel(
    { width: layoutBox.width * zoom, height: layoutBox.height * zoom },
    naturalDims.w,
    naturalDims.h,
  );
  return autoImageRendering(screenPxPerTexel, PIXEL_VALUE_MIN_SCREEN_PX);
}

// ---------------------------------------------------------------------------
// SDR branch — the former ImagePane body (decode/colormap/diff effects ported
// verbatim), rendering its display element through the shared shell.
// ---------------------------------------------------------------------------

function CpuSdrImagePane(
  props: SdrImageProps & {
    toolbar?: boolean;
    settingsSyncGroupId?: string;
    syncIsAnchor?: boolean;
  },
) {
  const {
    imageUrl,
    baselineUrl = null,
    isBaseline = false,
    diffMode = "none",
    interpolation = "auto",
    colormap: colormapProp = "none",
    tonemap: tonemapProp,
    gamma: gammaProp,
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

  // SDR DISPLAY TRANSFER (tev sRGB · Gamma · Linear) — the plain-image display
  // menu. Seeded from the descriptor `tonemap=` prop coerced to a display
  // transfer (default "srgb"); HOME restores it. The γ for the Gamma transfer
  // rides `tonemapGamma` (slider shown only while Gamma is active — PEAK
  // precedent). sRGB is the identity round-trip (plain `<img>`); gamma/linear
  // recompute into a canvas (see the transfer effect / surface below).
  const seedSdrTransfer = ((): TonemapOperator => {
    const t = toSdrTonemap(tonemapProp);
    return t === "gamma" || t === "linear" ? t : "srgb";
  })();
  const [sdrTransfer, setSdrTransfer, sdrTransferMeta] =
    useResettableState<TonemapOperator>(seedSdrTransfer);
  useEffect(() => {
    setSdrTransfer(seedSdrTransfer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonemapProp]);
  const [tonemapGamma, setTonemapGamma, gammaMeta] = useResettableState(
    gammaProp && gammaProp > 0 ? gammaProp : TONEMAP_GAMMA_DEFAULT,
  );
  useEffect(() => {
    if (gammaProp && gammaProp > 0) setTonemapGamma(gammaProp);
  }, [gammaProp, setTonemapGamma]);

  // Multi-viewport SELECTION: settings sync (see use-synced-image-settings). The
  // CPU SDR path syncs colormap, the display-transfer operator and its γ (the
  // controls it actually owns; it has no in-pane exposure/offset — see the
  // graceful-degradation note at the sliders).
  const applyRemoteSettings = useCallback(
    (patch: ImageSyncSettings) => {
      if (patch.colormap !== undefined) setColormap(patch.colormap as Colormap);
      if (patch.tonemap !== undefined) setSdrTransfer(patch.tonemap as TonemapOperator);
      if (patch.tonemapGamma !== undefined) setTonemapGamma(patch.tonemapGamma);
    },
    [setColormap, setSdrTransfer, setTonemapGamma],
  );
  const settingsSnapshot = useCallback(
    (): ImageSyncSettings => ({ colormap, tonemap: sdrTransfer, tonemapGamma }),
    [colormap, sdrTransfer, tonemapGamma],
  );
  const publishSettings = useSyncedImageSettings(
    props.settingsSyncGroupId,
    !!props.syncIsAnchor,
    settingsSnapshot,
    applyRemoteSettings,
  );
  const changeColormap = useCallback(
    (id: Colormap) => {
      setColormap(id);
      publishSettings({ colormap: id });
    },
    [setColormap, publishSettings],
  );
  const changeSdrTransfer = useCallback(
    (id: TonemapOperator) => {
      setSdrTransfer(id);
      publishSettings({ tonemap: id });
    },
    [setSdrTransfer, publishSettings],
  );
  const changeGamma = useCallback(
    (v: number) => {
      setTonemapGamma(v);
      publishSettings({ tonemapGamma: v });
    },
    [setTonemapGamma, publishSettings],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const falseColorRef = useRef<HTMLCanvasElement | null>(null);
  const transferRef = useRef<HTMLCanvasElement | null>(null);
  const [transferReady, setTransferReady] = useState(false);
  // The shared shell attaches these (see `ImagePaneShell`); the CPU backend
  // has no render-pass effect that reads them, but the shell needs them for
  // the viewport/controller wiring and the PixelAxes container.
  const paneRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // -----------------------------------------------------------------------
  // TEV-style per-pixel value overlay — source buffer.
  //   valueDataRef: RAW source pixels (the numbers we print).
  // The displayed element (img|canvas) is tracked via `displayElRef` so the
  // overlay can read its live on-screen rect (post zoom/pan). (The overlay's
  // text colours are fixed-intensity now, so no displayed-pixel luminance
  // buffer is retained — see `primitives/PixelValueOverlay`.)
  // -----------------------------------------------------------------------
  const displayElRef = useRef<HTMLElement | null>(null);
  const valueDataRef = useRef<ImageData | null>(null);
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
  const setTransferEl = useCallback((el: HTMLCanvasElement | null) => {
    transferRef.current = el;
    if (el) displayElRef.current = el;
  }, []);
  const setImgEl = useCallback((el: HTMLImageElement | null) => {
    if (el) displayElRef.current = el;
  }, []);
  const [diffReady, setDiffReady] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
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

  // PLAIN-image display transfer (tev Gamma/Linear). Only when NOT diffing and
  // NOT colormapped (the false-color LUT output is already display-ready), and
  // only for a NON-sRGB transfer (sRGB is a bit-exact round-trip → keep the plain
  // <img>). Recomputes the pixels through `sdrTransferToImageData` (the CPU mirror
  // of the GPU plain-SDR shader path) into `transferRef`.
  const useDisplayTransfer =
    imageUrl != null && !showDiff && !useFalseColor && sdrTransfer !== "srgb";

  useEffect(() => {
    if (!useDisplayTransfer || !imageUrl) {
      setTransferReady(false);
      return;
    }
    let cancelled = false;
    setTransferReady(false);
    loadImageData(imageUrl).then((src) => {
      if (cancelled || !src) return;
      const mapped = sdrTransferToImageData(src, sdrTransfer, tonemapGamma);
      const c = transferRef.current;
      if (!c) return;
      c.width = mapped.width;
      c.height = mapped.height;
      const ctx = c.getContext("2d");
      if (ctx) ctx.putImageData(mapped, 0, 0);
      bumpPixelData();
      setNaturalDims({ w: mapped.width, h: mapped.height });
      onNaturalSize?.(mapped.width, mapped.height);
      setTransferReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDisplayTransfer, imageUrl, sdrTransfer, tonemapGamma]);

  const updateDims = useCallback((w: number, h: number) => {
    setNaturalDims((prev) =>
      prev && prev.w === w && prev.h === h ? prev : { w, h },
    );
    onNaturalSize?.(w, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decode the RAW source image once per url so the pixel-value overlay can
  // read true pixel values (independent of the display mode).
  useEffect(() => {
    if (!imageUrl) {
      valueDataRef.current = null;
      bumpPixelData();
      return;
    }
    let cancelled = false;
    loadImageData(imageUrl).then((d) => {
      if (cancelled) return;
      valueDataRef.current = d;
      bumpPixelData();
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, bumpPixelData]);

  const samplePixel = useCallback(
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      const vd = valueDataRef.current;
      if (!vd || px < 0 || py < 0 || px >= vd.width || py >= vd.height) return null;
      const i = (py * vd.width + px) * 4;
      const r = vd.data[i]!;
      const g = vd.data[i + 1]!;
      const b = vd.data[i + 2]!;
      // A false-colored (colormap) or grayscale pixel prints one untinted line;
      // a true multi-channel pixel prints three channel-tinted lines.
      const single = colormap !== "none" || (r === g && g === b);
      return buildChannelSample(single ? [r] : [r, g, b], "uint8", notation);
    },
    [colormap],
  );

  // In-pane HISTOGRAM source — bins the RAW RGBA source (the same `valueDataRef`
  // buffer the pixel-value overlay samples), not the colormapped display.
  const histogramSource = useMemo(
    () => u8HistogramSource(valueDataRef.current, pixelDataVersion),
    [pixelDataVersion],
  );

  useEffect(() => {
    setWebglUnavailable(false);
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
        // Forced-GPU mode with no WebGL2: show the shared placeholder instead
        // of a silent blank pane (the third divergence PaneUnavailable unifies).
        if (!cancelled) setWebglUnavailable(true);
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
  // Auto-interpolation: snap to `pixelated` when magnified past the shared
  // texel-size threshold (GPU-pane parity), else the browser default. Explicit
  // pixelated/crisp-edges bypass it. See `useAutoImageRendering`.
  const imgRendering = useAutoImageRendering(wrapperRef, zoomProp, naturalDims, interpolation);
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
  ) : showDiff && webglUnavailable ? (
    <PaneUnavailable
      title="WebGL 2 unavailable"
      body="GPU render mode needs WebGL 2 here — switch render mode to Auto or CPU."
    />
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
  ) : useDisplayTransfer ? (
    <>
      {!transferReady && (
        <span className="text-xs text-fg-muted motion-safe:animate-pulse">
          applying transfer...
        </span>
      )}
      <canvas
        ref={setTransferEl}
        className="w-full h-full object-contain block"
        style={{
          display: transferReady ? "block" : "none",
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
      // SDR single-image: a view-local COLORMAP menu + (on the plain path) the
      // tev DISPLAY-TRANSFER menu (sRGB · Gamma · Linear). The transfer menu is
      // hidden once a colormap is active (false-color output is display-ready).
      leadingMenus={
        colormap === "none"
          ? [
              colormapToolbarButton(colormap, (id) => changeColormap(id as Colormap)),
              displayTransferToolbarButton(sdrTransfer, (id) => changeSdrTransfer(id as TonemapOperator)),
            ]
          : [colormapToolbarButton(colormap, (id) => changeColormap(id as Colormap))]
      }
      // γ slider — shown only while the Gamma transfer is in effect on the plain
      // path (PEAK-slider precedent).
      extraSliders={
        colormap === "none" && tonemapHasGamma(sdrTransfer)
          ? [
              {
                id: "gamma",
                label: "γ",
                title:
                  "Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",
                min: TONEMAP_GAMMA_MIN,
                max: TONEMAP_GAMMA_MAX,
                step: TONEMAP_GAMMA_STEP,
                value: tonemapGamma,
                onChange: changeGamma,
                format: (v: number) => v.toFixed(1),
              },
            ]
          : undefined
      }
      onReset={() => {
        colormapMeta.reset();
        sdrTransferMeta.reset();
        gammaMeta.reset();
      }}
      extraModified={colormapMeta.isModified || sdrTransferMeta.isModified || gammaMeta.isModified}
      histogram={histogramSource}
      // NO EXPOSURE/OFFSET sliders here (graceful degradation, §requirement B):
      // the CPU SDR path shows already-encoded 8-bit pixels via a plain `<img>`
      // (or a colormap/diff `<canvas>`), with no scene-linear pixel-recompute
      // stage to apply `color*2^EV + offset` in. Applying it would need a full
      // per-pixel re-encode pipeline this path doesn't have. The GPU SDR backend
      // (`GpuImagePane`) applies both in-shader, and the CPU HDR path recomputes
      // its tone-map pass — so `displayAdjust` is wired there, just not here.
      label={label}
      // Gate on a non-empty label (matching the CPU HDR path + `GpuImagePane`),
      // so an empty label renders NO chip. The `side`-compare reference pane
      // relies on this: it passes `label=""` and shows the shared top-left
      // `RefBadge` instead of a bottom-left "REF" label chip.
      showLabelChip={!!label}
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

function CpuHdrImagePane(
  props: HdrImageProps & {
    toolbar?: boolean;
    settingsSyncGroupId?: string;
    syncIsAnchor?: boolean;
  },
) {
  const {
    tonemap = "srgb",
    colorspace: colorspaceProp,
    exposure = 0,
    offset: baseOffset = 0,
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

  // Gamma(γ) for the Gamma operator (the γ slider is shown only while Gamma is in
  // effect — the PEAK-slider precedent). Seeded from the descriptor `gamma=`,
  // else the default 2.2; HOME restores it.
  const [tonemapGamma, setTonemapGamma, gammaMeta] = useResettableState(
    gamma && gamma > 0 ? gamma : TONEMAP_GAMMA_DEFAULT,
  );
  useEffect(() => {
    if (gamma && gamma > 0) setTonemapGamma(gamma);
  }, [gamma, setTonemapGamma]);

  // DISPLAY COLORSPACE ("linear" | "normal") — the normal-map remap toggle. View-
  // local, seeded from the descriptor `colorspace=` prop and re-seeded on change
  // (controlled surface, like the tonemap override). While "normal" the CPU tone-
  // map pass short-circuits to the [-1,1]→[0,1] remap (see tonemapToImageData).
  const [colorspace, setColorspace] = useState<ImageColorspace>(
    canonicalizeColorspace(colorspaceProp),
  );
  useEffect(() => {
    setColorspace(canonicalizeColorspace(colorspaceProp));
  }, [colorspaceProp]);
  const normalMapActive = colorspace === "normal";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [pixelDataVersion, setPixelDataVersion] = useState(0);

  // EXPOSURE / OFFSET display-adjust sliders (§requirement B). View-local,
  // display-only — recomputes the CPU tone-map pass (like a tonemap/exposure
  // change already does), never a diff. The display EV ADDS to the prop exposure.
  const [displayEV, setDisplayEV] = useState(0);
  const [displayOffset, setDisplayOffset] = useState(0);

  // Multi-viewport SELECTION: settings sync (see use-synced-image-settings). The
  // CPU HDR path syncs the tone-map operator, its γ, and exposure/offset.
  const applyRemoteSettings = useCallback(
    (patch: ImageSyncSettings) => {
      if (patch.tonemap !== undefined) setTonemapOp(patch.tonemap as TonemapOperator);
      if (patch.colorspace !== undefined) setColorspace(canonicalizeColorspace(patch.colorspace));
      if (patch.tonemapGamma !== undefined) setTonemapGamma(patch.tonemapGamma);
      if (patch.exposureEV !== undefined) setDisplayEV(patch.exposureEV);
      if (patch.offset !== undefined) setDisplayOffset(patch.offset);
    },
    [setTonemapOp, setTonemapGamma],
  );
  const settingsSnapshot = useCallback(
    (): ImageSyncSettings => ({
      tonemap: tonemapOp,
      colorspace,
      tonemapGamma,
      exposureEV: displayEV,
      offset: displayOffset,
    }),
    [tonemapOp, colorspace, tonemapGamma, displayEV, displayOffset],
  );
  const publishSettings = useSyncedImageSettings(
    props.settingsSyncGroupId,
    !!props.syncIsAnchor,
    settingsSnapshot,
    applyRemoteSettings,
  );
  const changeTonemap = useCallback(
    (id: TonemapOperator) => {
      setTonemapOp(id);
      publishSettings({ tonemap: id });
    },
    [setTonemapOp, publishSettings],
  );
  const changeColorspace = useCallback(
    (id: string) => {
      setColorspace(canonicalizeColorspace(id));
      publishSettings({ colorspace: id });
    },
    [publishSettings],
  );
  const changeGamma = useCallback(
    (v: number) => {
      setTonemapGamma(v);
      publishSettings({ tonemapGamma: v });
    },
    [setTonemapGamma, publishSettings],
  );
  const changeExposure = useCallback(
    (ev: number) => {
      setDisplayEV(ev);
      publishSettings({ exposureEV: ev });
    },
    [publishSettings],
  );
  const changeOffset = useCallback(
    (off: number) => {
      setDisplayOffset(off);
      publishSettings({ offset: off });
    },
    [publishSettings],
  );

  // Single CPU tone-map pass; reruns on data / tonemap / exposure / gamma /
  // display-adjust.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let imageData: ImageData;
    try {
      imageData = tonemapToImageData(
        hdr,
        tonemapOp,
        exposure + displayEV,
        // The output-encode transfer selected by the operator in effect
        // (gamma → γ, linear → identity, else sRGB OETF). See resolveEncodeGamma.
        resolveEncodeGamma(tonemapOp, tonemapGamma),
        // Base offset (controlled) + the additive runtime OFF slider. HOME zeroes
        // only `displayOffset`, so the descriptor `offset` persists.
        baseOffset + displayOffset,
        colorspace,
      );
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
    setPixelDataVersion((v) => v + 1);
    setDims((prev) =>
      prev && prev.w === imageData.width && prev.h === imageData.height
        ? prev
        : { w: imageData.width, h: imageData.height },
    );
  }, [hdr, tonemapOp, colorspace, exposure, baseOffset, tonemapGamma, displayEV, displayOffset]);

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
      const values =
        c === 1 ? [readV(base)] : [readV(base), readV(base + 1), readV(base + 2)];
      return buildChannelSample(values, "unit", notation);
    },
    [hdr, dims],
  );

  // In-pane HISTOGRAM source — bins the RAW float scene values. For a DEEP EXR,
  // `getDeepCsr` exports the retained samples so the panel can list the cursor
  // pixel's per-sample value + DEPTH (Z).
  const histogramSource = useMemo(
    () =>
      floatHistogramSource(
        hdr,
        pixelDataVersion,
        hdr.deep ? () => hdr.deep!.getGpuCsr() : undefined,
      ),
    [hdr, pixelDataVersion],
  );

  // Auto-interpolation: shared threshold (GPU-pane parity); see the SDR branch.
  const imgRendering = useAutoImageRendering(wrapperRef, zoom, dims, interpolation);

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
      // TONEMAP menu (HDR/float pane) — the ONE unified 5-operator group. The
      // CPU fallback tone-maps to an 8-bit surface (never engages true HDR), so
      // it is the SDR rendition by construction (P=1, no PEAK slider). HOME
      // restores the default.
      leadingMenus={[
        colorspaceToolbarButton(colorspace, changeColorspace),
        // Normal-map colorspace REPLACES the tone-map transform, so hide the
        // (inert) tonemap menu while it is active.
        ...(normalMapActive
          ? []
          : [tonemapToolbarButton(tonemapOp, (id) => changeTonemap(id as TonemapOperator))]),
      ]}
      // EXPOSURE / OFFSET display-adjust sliders — the CPU HDR tone-map pass
      // applies them (recomputed like any exposure/tonemap change).
      displayAdjust={{
        exposureEV: displayEV,
        offset: displayOffset,
        onExposureChange: changeExposure,
        onOffsetChange: changeOffset,
      }}
      // γ slider — shown ONLY while the Gamma operator is in effect (the same
      // conditional-slider precedent PEAK uses on the GPU pane).
      extraSliders={
        tonemapHasGamma(tonemapOp) && !normalMapActive
          ? [
              {
                id: "gamma",
                label: "γ",
                title:
                  "Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",
                min: TONEMAP_GAMMA_MIN,
                max: TONEMAP_GAMMA_MAX,
                step: TONEMAP_GAMMA_STEP,
                value: tonemapGamma,
                onChange: changeGamma,
                format: (v: number) => v.toFixed(1),
              },
            ]
          : undefined
      }
      // DEEP depth-window sliders (Z-NEAR/Z-FAR) + region-select (absent for
      // non-deep); HOME resets the window to [zMin,zMax] and the tonemap override.
      depthSliders={deepFlatten.sliders}
      regionSelect={
        deepFlatten.hasDeep
          ? {
              rect: deepFlatten.region,
              queryLive: deepFlatten.queryRegionWindow,
              commit: deepFlatten.commitRegion,
              remove: deepFlatten.removeRegion,
            }
          : undefined
      }
      onReset={() => {
        deepFlatten.reset();
        tonemapMeta.reset();
        gammaMeta.reset();
      }}
      extraModified={deepFlatten.isModified || tonemapMeta.isModified || gammaMeta.isModified}
      histogram={histogramSource}
      label={label}
      showLabelChip={!!label}
    />
  );
}

// ---------------------------------------------------------------------------
// Public component.
// ---------------------------------------------------------------------------

/** The unified backend prop shape this pane accepts (kept as a public alias). */
export type CpuImagePaneProps = ImageBackendProps;

/**
 * One of the two interchangeable image backends (the CPU/2D-canvas one — see
 * `GpuImagePane` for the WebGPU other); both accept the ONE
 * {@link ImageBackendProps} and are assignable to `ImageBackend`. The unified
 * `source` fans out (keyed on `source.dtype`) into the two internal pane
 * representations via {@link useLegacyImageProps}; the sub-panes below are
 * unchanged.
 */
export default function CpuImagePane(backendProps: ImageBackendProps): JSX.Element {
  const props = useLegacyImageProps(backendProps);
  // The selection settings-sync fields ride ALONGSIDE the reconstructed legacy
  // props (they aren't part of the dtype-keyed `LegacyImageProps` shape).
  const sync = {
    settingsSyncGroupId: backendProps.settingsSyncGroupId,
    syncIsAnchor: backendProps.syncIsAnchor,
  };
  return isHdrProps(props) ? (
    <CpuHdrImagePane {...props} {...sync} />
  ) : (
    <CpuSdrImagePane {...props} {...sync} />
  );
}

// Compile-time contract check: CpuImagePane implements the shared backend
// interface (accepts the plain `ImageBackendProps` union — `toolbar` is
// optional, so the plain union is assignable to `CpuImagePaneProps`).
const _backendCheck: ImageBackend = CpuImagePane;
void _backendCheck;
