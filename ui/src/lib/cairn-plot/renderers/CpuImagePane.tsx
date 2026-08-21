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
import type { ReactNode, RefObject } from "react";
import PaneUnavailable from "../primitives/PaneUnavailable";
import LabelChip from "../primitives/LabelChip";
import RefBadge from "../primitives/RefBadge";
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
import { sampleLutByte } from "../colormaps/lut-sample";
import { clamp01 } from "../util/clamp";
// Pure sequential-vs-diverging rule (no GPU/engine deps — see its module doc);
// safe to pull into the CPU pane / core bundle.
import { resolveColormapMode } from "../engine/diff-cmap-mode";
import { f16BitsToFloat32, halfToFloat } from "../image/half";
import {
  toSdrTonemap,
  DEFAULT_TONEMAP,
  applyExposureOffset,
  outputEncode,
  srgbEotf,
  resolveEncodeGamma,
  TONEMAP_GAMMA_DEFAULT,
  TONEMAP_GAMMA_MIN,
  TONEMAP_GAMMA_MAX,
  TONEMAP_GAMMA_STEP,
  SDR_DISPLAY_TRANSFER_OPERATORS,
  SDR_TONEMAP_OPERATORS,
  type RgbTriple,
  type TonemapOperator,
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
  adoptRemoteDisplayEncoding,
  diffFaceTag,
} from "./image-display-encoding-sync";
import { displayToolbarButton, reduceSegment, usePaneEncoding } from "./display-encoding";
import {
  computeDataIndex,
  reduceToScalar,
  defaultReduceMode,
  getEncoding,
  signedAnalyticColor,
  turboDataIndex,
  DEFAULT_ENCODE_PARAMS,
  type EncodeParams,
  type NormMode,
  type ReduceMode,
} from "../image/encodings";
import { getContentOp, isDirectContentOp, type DirectContentOp } from "../image/content-ops";
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

/** The CONTENT stage's CPU twin (Phase 1: identity — a passthrough). The CPU
 *  pane produces its per-texel content through the content-op registry, the SAME
 *  declaration the GPU shader's `cairnContent` assembles from. Identity returns
 *  the sampled source channels unchanged, so the pixel pipeline is byte-for-byte
 *  as before. */
const _identityOp = getContentOp("identity");
if (!_identityOp || !isDirectContentOp(_identityOp)) {
  throw new Error("CpuImagePane: the 'identity' content op must be registered as a direct op");
}
const IDENTITY_CONTENT: DirectContentOp = _identityOp;

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
  colormap: string = "none",
  // DATA-encoding norm + bounds (Phase 4) — the colormap-only extras. `norm`
  // reshapes the LUT index (linear/log/power; `normExponent` is the power
  // exponent); `colorMin`/`colorMax` (both set) engage the min/max BOUNDS skin
  // INSTEAD of the exposure/offset sensitivity (never composed). Defaults
  // reproduce the Phase-2 behavior (linear, no bounds) bit-for-bit.
  norm: NormMode = "linear",
  colorMin?: number,
  colorMax?: number,
  normExponent: number = 1,
  // Multi-channel REDUCE (the multi-channel-colormap follow-up) — how a k>1
  // colormap source collapses to the scalar the LUT indexes. Unset → the k-based
  // default (`defaultReduceMode`). Ignored for k=1 (the scalar IS the channel)
  // and when no colormap is active.
  reduce?: ReduceMode,
): ImageData {
  const { h, w, c } = shapeDims(hdr.shape);
  // TURBO false-color (the tev-exact follow-up) indexes the bound turbo table at
  // tev's FIXED log2 mapping (`turboDataIndex`) instead of `computeDataIndex`, and
  // defaults `reduce` to MEAN (tev averages RGB) regardless of k.
  const turboCmap = colormap !== "none" && !!getEncoding(colormap)?.turbo;
  const reduceMode: ReduceMode = reduce ?? (turboCmap ? "mean" : defaultReduceMode(c));
  // COLORMAP (LUT family, CPU twin — Phase 2/4): when a colormap is active the
  // SCALAR channel (channel 0) indexes the colormap LUT and the DISPLAY color is
  // written straight out — the tone-map operator + output-encode are SHORT-
  // CIRCUITED (the LUT holds display sRGB), matching the GPU `cairnLutColor`
  // family + the diff blit. The index runs through `computeDataIndex` (the norm
  // reshape + optional bounds affine — the CPU source of truth the WGSL
  // `cairnDataIndex` mirrors). cmap-mode `linear`.
  // ANALYTIC colormap (tev-style signed red-green) — computed color, no LUT. The
  // reduced signed scalar → signedAnalyticColor (neg→red, pos→green, 2*|v|,
  // UNCLAMPED) → SHARED output-encode (like a curve), NOT a baked-sRGB LUT sample.
  // This CPU fallback writes an 8-bit ImageData, so |v|>1 clamps here (the extended
  // >1 survival is the GPU/HDR-surface path); |v|<=1 matches the GPU exactly.
  const analyticCmap = colormap !== "none" && !!getEncoding(colormap)?.analytic;
  const cmapLut = colormap !== "none" && !analyticCmap ? getColormapLUT(colormap as never) : null;
  // TURBO bakes its own FIXED index (`turboDataIndex`), bypassing the norm/bounds
  // path — so its params (norm/bounds) are inert on this branch.
  const cmapBoundsOn =
    typeof colorMin === "number" && Number.isFinite(colorMin) &&
    typeof colorMax === "number" && Number.isFinite(colorMax);
  const cmapDataParams: EncodeParams = {
    exposure,
    offset,
    peak: 4,
    gamma: normExponent,
    norm,
    ...(cmapBoundsOn ? { min: colorMin, max: colorMax } : {}),
  };
  // F16 pipeline: this is the CPU tone-map FALLBACK path (used when the GPU
  // backend is unavailable), so a `precision:"f16-bits"` source is widened to
  // f32 ONCE for the whole frame here (see `../image/half.ts`) rather than
  // kept half — the GPU path keeps the bits; only this fallback pays the copy.
  const src =
    hdr.precision === "f16-bits" ? f16BitsToFloat32(hdr.data as Uint16Array) : hdr.data;
  // Resolve the operator CURVE straight from the registry (the single source of
  // truth). The CPU triple path applies only the PLAIN (non-peak) SDR curves —
  // exposure is folded in below and peak is an HDR-surface concern — so a peak or
  // LUT id (never reached here in practice) falls back to the srgb clamp, exactly
  // as the former `getTonemapOperator` lookup did.
  const curveEnc = getEncoding(tonemap);
  const opEnc =
    curveEnc && curveEnc.kind !== "lut" && !curveEnc.params.includes("peak")
      ? curveEnc
      : getEncoding(DEFAULT_TONEMAP)!;
  const op = (rgb: RgbTriple): RgbTriple => opEnc.cpu(rgb, 3, DEFAULT_ENCODE_PARAMS);
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

    // CONTENT stage (Phase 1: identity) — the sampled source color enters the
    // display pipeline through the content-op registry's `cpu` twin, mirroring
    // the GPU shader's `cairnContent`. Identity is a passthrough, so [r,g,b] is
    // unchanged (alpha is a coverage value, handled separately below).
    const content = IDENTITY_CONTENT.cpu([[r, g, b]], c);
    r = content[0]!;
    g = content[1]!;
    b = content[2]!;

    // 1) exposure + offset (TEV) in scene-linear, 2) tone-map HDR→[0,1],
    //    3) output-encode. Offset is added after exposure, before the operator.
    const lit: RgbTriple = [
      applyExposureOffset(r, exposure, offset),
      applyExposureOffset(g, exposure, offset),
      applyExposureOffset(b, exposure, offset),
    ];
    const o = i * 4;
    if (analyticCmap) {
      // The (exposure/offset-adjusted) color channels REDUCE to a signed scalar,
      // then the analytic color runs through the SAME output-encode as a curve.
      const scalar = reduceToScalar(lit, c, reduceMode);
      const [lr, lg, lb] = signedAnalyticColor(scalar);
      // sRGB OETF (no gamma) — matches the GPU analytic branch's hasGamma=false.
      out[o] = 255 * outputEncode(lr);
      out[o + 1] = 255 * outputEncode(lg);
      out[o + 2] = 255 * outputEncode(lb);
      out[o + 3] = 255 * (a < 0 ? 0 : a > 1 ? 1 : a);
      continue;
    }
    if (cmapLut) {
      // Multi-channel follow-up: the color channels are first REDUCED to a scalar
      // (luminance/mean — `reduceToScalar`, the shared CPU source of truth the WGSL
      // `cairnReduceScalar` mirrors), then data index → LUT → display color
      // directly (no operator/encode). The BOUNDS skin reduces the RAW channels
      // (`r,g,b`); otherwise the exposure/offset sensitivity (`lit`) — the two are
      // never composed. At k=1 the reduce returns channel 0 unchanged.
      const scalar = reduceToScalar(cmapBoundsOn ? [r, g, b] : lit, c, reduceMode);
      const idx = turboCmap ? turboDataIndex(scalar) : computeDataIndex(scalar, cmapDataParams);
      const [cr, cg, cb] = sampleLutByte(cmapLut, clamp01(idx));
      out[o] = cr;
      out[o + 1] = cg;
      out[o + 2] = cb;
      out[o + 3] = 255 * (a < 0 ? 0 : a > 1 ? 1 : a);
      continue;
    }
    const [tr, tg, tb] = op(lit);
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
    /** COMPARE chrome (caption chips + REF badge) when this pane renders a
     *  compare's reference (degraded CPU fallback); suppresses the label chip. */
    compareChrome?: ReactNode;
    isCompareMode?: boolean;
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

  // CONTROLLED SURFACE (`toolbar={false}` host-menu contract) vs INTERACTIVE
  // VIEWPORT — the ONE axis governing whether a descriptor prop change reseeds the
  // display settings (see GpuImagePane). A viewport OWNS its settings (persist across
  // flips, HOME re-seeds to the visible slot); a controlled surface follows the host
  // props. `__cairnDisableStackShared` (test-only) forces the reseed for pre/post.
  const controlledSurface =
    toolbar === false ||
    (typeof window !== "undefined" &&
      !!(window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared);

  // Colormap: the `colormap` prop SEEDS a view-local override so the toolbar
  // COLORMAP menu can switch it in-pane (diff-kernels toolbar track). Re-seeds
  // on prop change (the app card's colormap control) — a controlled surface
  // until the user overrides it locally. (Only surfaces when the toolbar shows,
  // i.e. `toolbar={true}` backend-seam mounts, not the legacy `toolbar={false}`
  // card chrome — see report note on the card-control interaction.)
  // Descriptor default captured at mount; HOME restores the view-local colormap
  // override (and `isModified` enables it while off-default) — same contract as
  // GpuImagePane / the compare pane, now via the shared `useResettableState`.
  // UNIFIED DISPLAY ENCODING (Phase 3): ONE `encoding` id — the colormap LUTs
  // and the tev DISPLAY-TRANSFER curves (sRGB · Gamma · Linear) in one menu,
  // mutually exclusive by construction. `mode:"sdr"` (an 8-bit source has no
  // channel-count signal) offers the full set; the default curve coerces
  // `tonemap=` to a transfer (reinhard/aces/unknown → srgb). The γ for the Gamma
  // transfer rides `tonemapGamma` (slider gated by the active encoding's manifest).
  const enc = usePaneEncoding({
    mode: "sdr",
    arity: 1,
    curveSet: SDR_DISPLAY_TRANSFER_OPERATORS,
    propColormap: colormapProp,
    propTonemap: tonemapProp,
    resolveDefaultCurve: (t) => {
      const s = toSdrTonemap(t);
      return s === "gamma" || s === "linear" ? s : "srgb";
    },
    controlledSurface,
  });
  const colormap = enc.colormap as Colormap;
  const sdrTransfer = enc.curveId as TonemapOperator;
  const gammaSeed = gammaProp && gammaProp > 0 ? gammaProp : TONEMAP_GAMMA_DEFAULT;
  const [tonemapGamma, setTonemapGamma] = useState(gammaSeed);
  // γ is a viewport setting — persists across flips; reseeds only on a controlled
  // surface. HOME re-seeds it to the visible slot below.
  useEffect(() => {
    if (controlledSurface && gammaProp && gammaProp > 0) setTonemapGamma(gammaProp);
  }, [gammaProp, controlledSurface, setTonemapGamma]);
  const gammaModified = tonemapGamma !== gammaSeed;

  // Multi-viewport SELECTION: settings sync (see use-synced-image-settings). The
  // CPU SDR path syncs the ONE encoding (+ derived colormap/tonemap for
  // pre-registry peers) and the Gamma-transfer γ (the controls it owns; it has
  // no in-pane exposure/offset — see the graceful-degradation note at the sliders).
  const applyRemoteSettings = useCallback(
    (patch: ImageSyncSettings) => {
      // ONE content-kind scoping rule + scoped-encoding adoption, shared by all three
      // panes (`image-display-encoding-sync.ts`). This SDR pane's `isDiffFace`
      // capability is the legacy `DiffMode` string enum reduced to the Phase-2c boolean.
      adoptRemoteDisplayEncoding(enc.setEncoding, patch, diffMode !== "none");
      if (patch.tonemapGamma !== undefined) setTonemapGamma(patch.tonemapGamma);
    },
    [enc, setTonemapGamma, diffMode],
  );
  const settingsSnapshot = useCallback(
    (): ImageSyncSettings => ({
      encoding: enc.encodingId,
      colormap: enc.colormap,
      tonemap: sdrTransfer,
      tonemapGamma,
      // FACE TAG (M3/M4) — one source (`diffFaceTag`): when this SDR pane is itself a
      // DIFF, its colormap is the scalar-error face → tag `"diff"` so a light peer
      // scopes it out and the bus's mode-aware merge stays coherent.
      ...diffFaceTag(diffMode !== "none"),
    }),
    [enc.encodingId, enc.colormap, sdrTransfer, tonemapGamma, diffMode],
  );
  const publishSettings = useSyncedImageSettings(
    props.settingsSyncGroupId,
    !!props.syncIsAnchor,
    settingsSnapshot,
    applyRemoteSettings,
  );
  const changeEncoding = useCallback(
    (id: string) => {
      enc.setEncoding(id);
      const isLut = enc.ids.lutIds.includes(id);
      publishSettings({
        encoding: id,
        colormap: isLut ? id : "none",
        tonemap: isLut ? sdrTransfer : id,
        // FACE TAG (M3/M4) — one source (`diffFaceTag`): a scoped display write from a
        // DIFF SDR pane is the scalar-error face → tag `"diff"`; an image SDR pane omits it.
        ...diffFaceTag(diffMode !== "none"),
      });
    },
    [enc, publishSettings, sdrTransfer, diffMode],
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
      // A false-colored (colormap) pixel prints one untinted line — its display
      // value IS a single scalar. An RGB pixel ALWAYS prints three channel-tinted
      // lines, even when the channels happen to be equal (a bright/gray pixel is
      // still RGB — do NOT collapse it to one value on value equality).
      const single = colormap !== "none";
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
      // SDR single-image: ONE unified DISPLAY menu (the tev DISPLAY-TRANSFER
      // curves sRGB · Gamma · Linear + the colormap LUTs) — mutually exclusive by
      // construction (`enc`), replacing the old colormap + transfer menu pair.
      leadingMenus={[
        // CHANNELS (EXR part/layer) menu, owner-supplied — leading, like the rest.
        ...(props.channelMenu ? [props.channelMenu] : []),
        displayToolbarButton({ value: enc.encodingId, ids: enc.ids, onSelect: changeEncoding }),
      ]}
      // γ slider — gated by the active encoding's manifest (only the Gamma curve
      // declares γ; a colormap LUT / other transfers do not).
      extraSliders={
        enc.hasParam("gamma")
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
        enc.resetEncoding();
        setTonemapGamma(gammaSeed); // γ back to the VISIBLE slot's descriptor
        props.onChannelReset?.(); // channel override folds into HOME
      }}
      extraModified={
        enc.encodingModified ||
        gammaModified ||
        !!props.channelModified
      }
      histogram={histogramSource}
      // NO EXPOSURE/OFFSET sliders here (graceful degradation, §requirement B):
      // the CPU SDR path shows already-encoded 8-bit pixels via a plain `<img>`
      // (or a colormap/diff `<canvas>`), with no scene-linear pixel-recompute
      // stage to apply `color*2^EV + offset` in. Applying it would need a full
      // per-pixel re-encode pipeline this path doesn't have. The GPU SDR backend
      // (`GpuImagePane`) applies both in-shader, and the CPU HDR path recomputes
      // its tone-map pass — so `displayAdjust` is wired there, just not here.
      // COMPARE mode: the caption chips carry the labeling (suppress the pane's
      // own label chip); else the ordinary bottom-left label.
      label={props.isCompareMode ? "" : label}
      // Gate on a non-empty label (matching the CPU HDR path + `GpuImagePane`),
      // so an empty label renders NO chip. The `side`-compare reference pane
      // relies on this: it passes `label=""` and shows the shared top-left
      // `RefBadge` instead of a bottom-left "REF" label chip.
      showLabelChip={!props.isCompareMode && !!label}
      extraChips={props.compareChrome}
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
    /** COMPARE chrome (caption chips + REF badge) for the degraded CPU compare
     *  fallback; suppresses the label chip. See {@link cpuCompareChrome}. */
    compareChrome?: ReactNode;
    isCompareMode?: boolean;
  },
) {
  const {
    tonemap = "srgb",
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

  // CONTROLLED SURFACE vs INTERACTIVE VIEWPORT (see the SDR body / GpuImagePane): a
  // viewport OWNS its settings (persist across flips, HOME re-seeds to the visible
  // slot); a `toolbar={false}` controlled surface follows the host props.
  const controlledSurface =
    toolbar === false ||
    (typeof window !== "undefined" &&
      !!(window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared);

  // DEEP EXR depth slider: `hdr` is the live-flattened effective source; the
  // depth slider + HOME reset ride the shell (absent for non-deep sources).
  const deepFlatten = useDeepFlatten(props.hdr);
  const hdr = deepFlatten.hdr;

  // UNIFIED DISPLAY ENCODING (Phase 3): ONE `encoding` id replaces the separate
  // tone-map + colormap overrides — selecting a colormap LUT deactivates the
  // curve and vice-versa STRUCTURALLY (`display-encoding.ts`). Like the GPU float
  // pane, this pane KNOWS its channel arity (`hdr.shape`), so it gates by arity:
  // luts@k=1, `normal`@k=3, curves always. The default curve resolves from the
  // descriptor `tonemap=` coerced to an SDR operator (the CPU pane tone-maps to
  // an 8-bit ImageData — "extended" is never offered); a colormap `colormap=`
  // wins the seed for a scalar source. HOME restores the authored seed.
  const propColormap: Colormap =
    (props as unknown as { colormap?: Colormap }).colormap ?? "none";
  const sourceArity = shapeDims(hdr.shape).c;
  const resolveDefaultCurve = useCallback(
    (t: string | null | undefined) => toSdrTonemap(t ?? undefined),
    [],
  );
  const enc = usePaneEncoding({
    mode: "arity",
    arity: sourceArity,
    curveSet: SDR_TONEMAP_OPERATORS,
    propColormap,
    propTonemap: tonemap,
    resolveDefaultCurve,
    controlledSurface,
  });
  const colormap = enc.colormap as Colormap;
  const tonemapOp = enc.curveId as TonemapOperator;

  // Gamma(γ) for the Gamma operator (the γ slider is gated by the active
  // encoding's param manifest — only the Gamma curve declares γ). Seeded from the
  // descriptor `gamma=`, else the default 2.2. A viewport setting: persists across
  // flips; reseeds only on a controlled surface; HOME re-seeds to the visible slot.
  const gammaSeed = gamma && gamma > 0 ? gamma : TONEMAP_GAMMA_DEFAULT;
  const [tonemapGamma, setTonemapGamma] = useState(gammaSeed);
  useEffect(() => {
    if (controlledSurface && gamma && gamma > 0) setTonemapGamma(gamma);
  }, [gamma, controlledSurface, setTonemapGamma]);
  const gammaModified = tonemapGamma !== gammaSeed;

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

  // DATA-ENCODING BOUNDS (Phase 4) — mirrors GpuImagePane. `colorRange` (grid-
  // shared descriptor) SEEDS the min/max BOUNDS skin — the ALTERNATIVE to EV/OFF
  // (never composed). (The norm Lin·Log·Pow PICKER was removed — the engine norm
  // machinery `cairnDataIndex`/`computeDataIndex` stays, but the UI is gone and the
  // effective norm is always linear; see the norm-UI-removal follow-up.)
  const propColorRange = (props as unknown as { colorRange?: [number, number] }).colorRange;
  // MULTI-CHANNEL REDUCE (the multi-channel-colormap follow-up) — mirrors
  // GpuImagePane. `reduceOverride` null = the k-based default (luminance for k≥3,
  // mean for k=2); the segmented control shows only while a lut is active AND
  // sourceArity>1.
  const [reduceOverride, setReduceOverride] = useState<ReduceMode | null>(null);
  const effectiveReduce = reduceOverride ?? defaultReduceMode(sourceArity);
  const [colorBounds, setColorBounds] = useState<[number, number] | null>(propColorRange ?? null);
  // Bounds are a viewport setting — persist across flips; reseed only on a controlled
  // surface. HOME re-seeds to the visible slot below.
  useEffect(() => {
    if (controlledSurface) setColorBounds(propColorRange ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propColorRange?.[0], propColorRange?.[1], controlledSurface]);
  const boundsSeedVal: [number, number] | null = propColorRange ?? null;
  const boundsModified =
    (colorBounds?.[0] ?? null) !== (boundsSeedVal?.[0] ?? null) ||
    (colorBounds?.[1] ?? null) !== (boundsSeedVal?.[1] ?? null);
  const boundsEngaged =
    enc.isLut && enc.hasParam("min") && !!colorBounds && Number.isFinite(colorBounds[0]) && Number.isFinite(colorBounds[1]);
  const boundsRange = useMemo(() => {
    const seed = propColorRange ?? [0, 1];
    const lo = seed[0];
    const hi = seed[1];
    const span = hi > lo ? hi - lo : 1;
    return { lo, hi, span };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propColorRange?.[0], propColorRange?.[1]]);

  // Multi-viewport SELECTION: settings sync (see use-synced-image-settings). The
  // CPU HDR path syncs the ONE encoding (+ derived colormap/tonemap for
  // pre-registry peers), the Gamma γ, exposure/offset, and the norm/bounds.
  const applyRemoteSettings = useCallback(
    (patch: ImageSyncSettings) => {
      // ONE content-kind scoping rule + scoped-encoding adoption, shared by all three
      // panes (`image-display-encoding-sync.ts`). This CPU HDR/float pane ALWAYS
      // renders LIGHT content (the CPU compare path is a separate degraded reference
      // render), so its `isDiffFace` capability is CONSTANT false — a diff peer's
      // scalar-error encoding is always scoped out.
      adoptRemoteDisplayEncoding(enc.setEncoding, patch, false);
      if (patch.tonemapGamma !== undefined) setTonemapGamma(patch.tonemapGamma);
      if (patch.exposureEV !== undefined) setDisplayEV(patch.exposureEV);
      if (patch.offset !== undefined) setDisplayOffset(patch.offset);
      // `patch.norm` is still ACCEPTED for back-compat (a stale peer may emit it)
      // but IGNORED — the norm picker is gone and the effective norm is linear.
      if (patch.reduce !== undefined) setReduceOverride(patch.reduce as ReduceMode);
      if (patch.colorMin !== undefined && patch.colorMax !== undefined) {
        setColorBounds([patch.colorMin, patch.colorMax]);
      }
    },
    [enc, setTonemapGamma, setColorBounds],
  );
  const settingsSnapshot = useCallback(
    (): ImageSyncSettings => ({
      encoding: enc.encodingId,
      colormap: enc.colormap,
      tonemap: tonemapOp,
      tonemapGamma,
      exposureEV: displayEV,
      offset: displayOffset,
      reduce: effectiveReduce,
      ...(colorBounds ? { colorMin: colorBounds[0], colorMax: colorBounds[1] } : {}),
    }),
    [enc.encodingId, enc.colormap, tonemapOp, tonemapGamma, displayEV, displayOffset, effectiveReduce, colorBounds],
  );
  const publishSettings = useSyncedImageSettings(
    props.settingsSyncGroupId,
    !!props.syncIsAnchor,
    settingsSnapshot,
    applyRemoteSettings,
  );
  const changeEncoding = useCallback(
    (id: string) => {
      enc.setEncoding(id);
      const isLut = enc.ids.lutIds.includes(id);
      publishSettings({
        encoding: id,
        colormap: isLut ? id : "none",
        tonemap: isLut ? tonemapOp : id,
      });
    },
    [enc, publishSettings, tonemapOp],
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
  const changeReduce = useCallback(
    (mode: ReduceMode) => {
      setReduceOverride(mode);
      publishSettings({ reduce: mode });
    },
    [publishSettings],
  );
  const changeBounds = useCallback(
    (next: [number, number]) => {
      setColorBounds(next);
      publishSettings({ colorMin: next[0], colorMax: next[1] });
    },
    [setColorBounds, publishSettings],
  );

  // Single CPU tone-map pass; reruns on data / tonemap / exposure / gamma /
  // display-adjust / norm / bounds.
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
        // Colormap (LUT family): active → the scalar channel is false-colored and
        // the tone-map operator is bypassed (see tonemapToImageData).
        colormap,
        // Phase 4 DATA-encoding bounds (colormap only). When bounds are engaged,
        // tonemapToImageData reads the RAW value (EV/OFF neutralized here to avoid
        // double-apply — single-application). Norm is always LINEAR (the picker was
        // removed; the engine norm machinery stays but is unused UI-side).
        "linear",
        boundsEngaged && colorBounds ? colorBounds[0] : undefined,
        boundsEngaged && colorBounds ? colorBounds[1] : undefined,
        1,
        // Multi-channel follow-up: the reduce (luminance/mean) that collapses a
        // k>1 colormap source to the LUT scalar. Moot for k=1.
        effectiveReduce,
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
  }, [hdr, tonemapOp, colormap, exposure, baseOffset, tonemapGamma, displayEV, displayOffset, effectiveReduce, colorBounds, boundsEngaged]);

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
      // A colormapped scalar prints ONE value (its false-color display is a
      // single scalar), like the SDR colormap pane.
      const values =
        c === 1 || colormap !== "none"
          ? [readV(base)]
          : [readV(base), readV(base + 1), readV(base + 2)];
      return buildChannelSample(values, "unit", notation);
    },
    [hdr, dims, colormap],
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
      // UNIFIED DISPLAY menu (Phase 3): ONE arity-gated dropdown (CURVES /
      // COLORMAPS / REMAPS sections) replaces the separate colormap + tonemap
      // menus. Selecting a LUT deactivates the curve and vice-versa structurally
      // (`enc` owns the single `encoding` id); luts are gated to k=1 and `normal`
      // to k=3. The CPU fallback tone-maps to an 8-bit surface (never engages
      // true HDR), so it is the SDR rendition by construction (no PEAK slider).
      leadingMenus={[
        // CHANNELS (EXR part/layer) menu, owner-supplied — leading, like the rest.
        ...(props.channelMenu ? [props.channelMenu] : []),
        displayToolbarButton({ value: enc.encodingId, ids: enc.ids, onSelect: changeEncoding }),
      ]}
      // SECOND-ROW segmented controls (controls-row-separation directive): the
      // multi-channel REDUCE (lut + k>1) picker sits in the second toolbar row
      // alongside EV/OFF/γ, not next to the DISPLAY menu. Mirrors GpuImagePane.
      // (The norm Lin·Log·Pow picker was REMOVED — norm-UI-removal follow-up.)
      rowSegments={[
        ...(enc.hasParam("reduce") && sourceArity > 1 ? [reduceSegment(effectiveReduce, changeReduce)] : []),
      ]}
      // EXPOSURE / OFFSET display-adjust sliders — the CPU HDR tone-map pass
      // applies them (recomputed like any exposure/tonemap change). Gated by the
      // ACTIVE encoding's param manifest: shown for curves + luts (which declare
      // exposure/offset), hidden for the paramless `normal` remap AND when the
      // min/max BOUNDS skin is engaged (the two are never composed).
      displayAdjust={
        enc.hasParam("exposure") && !boundsEngaged
          ? {
              exposureEV: displayEV,
              offset: displayOffset,
              onExposureChange: changeExposure,
              onOffsetChange: changeOffset,
            }
          : undefined
      }
      // γ slider — gated by the active encoding's manifest (only the Gamma curve
      // declares γ; a colormap LUT / other curves do not). Phase 4's min/max bounds
      // sliders follow. (The power-NORM exponent slider was REMOVED with the norm
      // picker — norm-UI-removal follow-up.)
      extraSliders={[
        ...(enc.hasParam("gamma")
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
          : []),
        ...(boundsEngaged && colorBounds
          ? [
              {
                id: "colorMin",
                label: "min",
                title: "Colormap domain minimum — the data value that maps to the bottom of the ramp.",
                min: boundsRange.lo - boundsRange.span,
                max: boundsRange.hi,
                step: boundsRange.span / 100,
                value: colorBounds[0],
                onChange: (v: number) => changeBounds([v, colorBounds[1]]),
                format: (v: number) => v.toPrecision(3),
              },
              {
                id: "colorMax",
                label: "max",
                title: "Colormap domain maximum — the data value that maps to the top of the ramp.",
                min: boundsRange.lo,
                max: boundsRange.hi + boundsRange.span,
                step: boundsRange.span / 100,
                value: colorBounds[1],
                onChange: (v: number) => changeBounds([colorBounds[0], v]),
                format: (v: number) => v.toPrecision(3),
              },
            ]
          : []),
      ]}
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
        enc.resetEncoding();
        setTonemapGamma(gammaSeed); // γ back to the VISIBLE slot's descriptor
        setReduceOverride(null); // reduce back to the k-based default
        setColorBounds(boundsSeedVal); // min/max back to the visible slot's colorRange
        props.onChannelReset?.(); // channel override folds into HOME
      }}
      extraModified={
        deepFlatten.isModified ||
        enc.encodingModified ||
        gammaModified ||
        reduceOverride !== null ||
        boundsModified ||
        !!props.channelModified
      }
      histogram={histogramSource}
      label={props.isCompareMode ? "" : label}
      showLabelChip={!props.isCompareMode && !!label}
      extraChips={props.compareChrome}
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
/**
 * COMPARE chrome for the CPU backend (content-op unification). The unified
 * COMPOSITOR lives on the GPU pane (`GpuImagePane`); the CPU backend is the
 * no-WebGPU / render=cpu FALLBACK, so on `compareSource` it renders the
 * REFERENCE image (the primary `source`) DEGRADED — no live composite of the
 * foreground — but keeps the compare CHROME (per-side caption chips + the split
 * REF badge, same DOM/selectors as the GPU pane) so the reference re-pick
 * gesture + labeling still work. A real CPU composite is a documented remaining
 * gap (see the default export + the design doc's Phase-4 note). Captions are
 * inlined (NOT `compareCaptions`, which pulls `engine/kernels` into the CORE
 * bundle — the CPU pane must stay engine-free). */
function cpuCompareChrome(cs: ImageBackendProps["compareSource"]): ReactNode {
  if (!cs) return undefined;
  const mode = cs.mode ?? "diff";
  if (mode === "diff") {
    // ONE bottom-left caption "<fg> compared to <ref>" (no metric display name —
    // that needs the kernel registry the CPU bundle must not import).
    const fg = cs.foregroundLabel || "image";
    const ref = cs.referenceLabel || "reference";
    return (
      <LabelChip
        label={`${fg} compared to ${ref}`}
        corner="bottom-left"
        attrs={{ "data-cairn-compare-caption": "reference" }}
      />
    );
  }
  // split / blend: REFERENCE bottom-left, FOREGROUND bottom-right (the foreground
  // chip is the selection stage's click-to-set-reference affordance).
  return (
    <>
      {mode === "split" && <RefBadge />}
      {cs.referenceLabel ? (
        <LabelChip label={cs.referenceLabel} corner="bottom-left" attrs={{ "data-cairn-compare-caption": "reference" }} />
      ) : null}
      {cs.foregroundLabel ? (
        <LabelChip label={cs.foregroundLabel} corner="bottom-right" attrs={{ "data-cairn-compare-caption": "foreground" }} />
      ) : null}
    </>
  );
}

export default function CpuImagePane(backendProps: ImageBackendProps): JSX.Element {
  const props = useLegacyImageProps(backendProps);
  // The selection settings-sync fields + the COMPARE chrome ride ALONGSIDE the
  // reconstructed legacy props (they aren't part of the dtype-keyed
  // `LegacyImageProps` shape).
  //
  // CPU COMPARE FALLBACK (content-op unification). The unified COMPOSITOR is
  // GPU-only; on the no-WebGPU / render=cpu path a descriptor image-compare
  // lowers to THIS pane, which renders the REFERENCE (`source`) DEGRADED (no
  // live composite) but keeps the compare CHROME (per-side caption chips + split
  // REF badge, same DOM/selectors as the GPU pane) so the reference re-pick +
  // labeling still work. A REAL CPU composite is a documented remaining gap
  // (design doc, Phase-4 note): a CPU diff must render into the SAME `<img>`
  // surface the image tab uses (diff → data-URL) to preserve the
  // homogeneous-stack no-remount flip in CPU mode, which `stack/grid-stacked`
  // codifies (a canvas-based diff reintroduces a surface swap). The cross-type
  // consumers already get a real CPU split/blend/diff via the compositor's
  // `MediaComparePane` / `CpuImagePane`-diff / `CpuFloatComparePane` fallbacks.
  const isCompare = !!backendProps.compareSource;
  const sync = {
    settingsSyncGroupId: backendProps.settingsSyncGroupId,
    syncIsAnchor: backendProps.syncIsAnchor,
    channelMenu: backendProps.channelMenu,
    channelModified: backendProps.channelModified,
    onChannelReset: backendProps.onChannelReset,
    // In compare mode the caption chips carry the labeling — suppress the pane's
    // own bottom-left label chip and hand the shell the compare chrome.
    compareChrome: cpuCompareChrome(backendProps.compareSource),
    isCompareMode: isCompare,
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
