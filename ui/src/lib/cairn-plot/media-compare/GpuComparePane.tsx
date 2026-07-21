/**
 * GpuComparePane — the engine-backed split/blend/diff compare pane (Task 7 of
 * the WebGPU engine, Sub-project 1). Replaces `MediaComparePane`'s CPU
 * compositing (CSS clip-path split + opacity blend) and `ImagePane`'s
 * `image/webgl-diff.ts` diff path with ONE `engine/image-engine.ts`
 * `renderCompare()` GPU pass sampling two source textures (reference/texA +
 * foreground/texB — texA is the shader's "A" role: left side / alpha=0
 * endpoint / diff `a` operand, matching legacy semantics), plus
 * `computeMetrics()` for the MSE/PSNR/MAE readout.
 *
 * ## Gating (mirrors GpuImagePane / plot-gpu-image-addon)
 * Like `renderers/GpuImagePane.tsx`, this pane is NOT wired into any live page
 * by default — `CompositeMediaPane` only routes to it when
 * `window.__cairnPlotUseGpuImage === true` (Task 8 flips this on once the
 * engine panes are the default). When unset/false, the legacy CPU
 * `MediaComparePane`/`ImagePane` path stays in place, so production behavior
 * is unchanged. If a GPU backend can't init the pane self-heals to a blank
 * canvas (the CPU fallback is chosen at the `CompositeMediaPane` layer, not
 * here).
 *
 * ## Device/surface lifecycle (self-contained, NOT the pool)
 * `engine/pool.ts` manages ONE source texture per pane; a compare pane needs
 * TWO plus a render target, so this component owns its device/surface/textures
 * directly (a compare view is singular/few, not gallery-scale, so it doesn't
 * need the pool's LRU park/restore). It resolves `getSharedDevice()` (the one
 * shared WebGPU device — it backs many canvases, so this pane uses it
 * directly rather than creating its own). Everything is torn down on unmount.
 *
 * ## What it reproduces from the CPU compositor
 *   - split: a full-height, gapless divider (`splitPosition * 100%`) driving
 *     the `split` uniform; double-clicking the divider resets it to 0.5.
 *   - blend: the `alpha` uniform.
 *   - diff: `diffSubmode` + colormap (same "signed"/"positive" cmap-mode
 *     selection `ImagePane` uses, same `colormaps/lut.ts` LUT).
 *   - per-side TEV `PixelValueOverlay`s (split-clipped), same as
 *     `MediaComparePane`.
 *   - a metrics chip (MSE/PSNR/MAE via `computeMetrics`).
 *   - Q17: double-clicking the pane BACKGROUND resets the shared viewport to
 *     `{zoom:1, pan:{x:0,y:0}}` (both panes, via `onViewportChange`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Colormap, DiffMode, Interpolation } from "../types";
import { getSharedDevice } from "../engine/device";
import { forceEngineFailRequested } from "../engine/test-hooks";
import {
  renderCompose,
  computeMetrics,
  type CompareParams,
  type CompareMode,
  type DiffMetrics,
} from "../engine/image-engine";
import {
  ensureDiff,
  ensureDiffScalars,
  ensureDiffResultReadback,
  renderDiffDisplay,
  resolveDiffCmapMode,
  type DiffCacheEntry,
} from "../engine/diff-engine";
import { getDiffKernel, listDiffMenuModes, resolveDiffKernelId } from "../engine/kernels";
import { computeHdrFlipExposures } from "../engine/kernels/hdr-flip-reference";
import { HALF_ONE, halfToFloat, f16BitsToFloat32 } from "../image/half";
import type { Device, Surface, Texture } from "../engine/types";
import { getColormapLUT } from "../colormaps";
import type { ToolbarButtonSpec } from "../controls/ToolbarConfig";
import { colormapToolbarButton } from "../renderers/use-image-controller";
import { loadImageData } from "../image";
import type { Viewport as ImageViewport } from "../hooks/use-image-viewport";
import { useDevicePixelRatio } from "../hooks/use-device-pixel-ratio";
import { useResettableState } from "../hooks/use-resettable-state";
import { screenPxPerTexel, viewportToUvRect } from "../renderers/GpuImagePane";
import PixelValueOverlay, {
  PIXEL_VALUE_MIN_SCREEN_PX,
  buildChannelSample,
  type PixelSample,
  type PixelValueNotation,
} from "../primitives/PixelValueOverlay";
// C1 fix (whole-branch review) — the LEGACY compare panes, used as the
// fallback when the engine fails to activate/render (see `engineFailed`
// state below). Safe to import here: this file only ever ships inside the
// gpu-image ADDON bundle (`vite.plot-gpu-image.config.ts`), never
// `core.iife.js` — the core-bundle guard is about core staying free of the
// ENGINE, not about the addon avoiding a duplicate copy of these already-tiny
// CPU renderers. The diff fallback self-heals to `CpuImagePane` (the unified
// CPU image backend — same `ImageBackendProps` contract as `GpuImagePane`,
// see `renderers/image-backend.ts`). `MediaComparePane` is imported as a
// VALUE from `./compositor` — that file only imports THIS file's
// `GpuComparePaneProps` as a TYPE (`import type`), which TS/esbuild fully
// erase, so this is not a runtime import cycle.
import CpuImagePane from "../renderers/CpuImagePane";
import ImagePaneShell from "../renderers/ImagePaneShell";
import {
  MediaComparePane,
  CompareFloatUnsupportedError,
  type CompareFloatSource,
} from "./compositor";
import { buildCompareModeMenu } from "./compare-mode-menu";

export interface GpuComparePaneProps {
  imageUrl: string | null;
  baselineUrl: string | null;
  /**
   * DECODED float sides (`.exr`/float `.npy` URLs) — the GPU-only alternative
   * to `imageUrl`/`baselineUrl`. When set, THIS side is uploaded as an
   * `rgba32float` source texture (mirroring the HDR image path) instead of
   * being fetched+decoded from a URL, so the diff runs in true float values.
   * `imageFloat` is the foreground/comparison side, `baselineFloat` the
   * reference. Either format may pair with the other (mixed u8/f32) — each side
   * uploads in its natural texture format; the engine samples both via
   * `textureLoad` (format-agnostic), so a u8 side reads normalized `[0,1]` and a
   * float side reads its raw values. See {@link CompareFloatSource}.
   */
  imageFloat?: CompareFloatSource;
  baselineFloat?: CompareFloatSource;
  /** split | blend | diff (the three engine-composited modes). */
  mode: CompareMode;
  splitPosition: number;
  blendAlpha: number;
  onSplitPositionChange?: (p: number) => void;

  /** diff submode + colormap (used only in `mode:"diff"`). */
  diffSubmode?: DiffMode;
  colormap?: Colormap;
  /**
   * Diff KERNEL id (the diff-kernel registry — the six pointwise ids plus
   * `flip`). This is the pane's INITIAL diff kernel; internal state
   * (`diffKernel`) then owns it so the toolbar-menu track can switch it
   * view-locally via `onDiffKernelChange`. When unset it defaults from
   * `diffSubmode` (the legacy 1:1 mapping). Ignored unless `mode:"diff"`.
   */
  diffKernel?: string;
  /** Fired when the pane's diff kernel changes (menu selection). The
   *  toolbar-menu track wires a dropdown to this + `diffKernel`. */
  onDiffKernelChange?: (kernelId: string) => void;
  /** Fired when the pane's compare MODE changes via its MODE menu (split ⇄
   *  blend ⇄ diff). Lets an owner above this pane (`CompareView`) keep its
   *  lifted view-mode state in sync so a later side ⇄ compare round-trip
   *  re-seeds to the last selection. Optional — the pane stays self-contained
   *  (owns `compareMode`) when unwired (the browser harness path). */
  onCompareModeChange?: (mode: CompareMode) => void;
  /** Fired when the user picks "Side" in the MODE menu. `side` is NOT an engine
   *  composite (`CompareMode` is split/blend/diff only — the shader has no side
   *  pass); the 2-pane side-by-side lives ABOVE this pane in `CompareView`, so
   *  selecting it delegates UP instead of mutating internal state. Absent ⇒ the
   *  "Side" entry is omitted from the menu. */
  onRequestSide?: () => void;

  zoom: number;
  pan: { x: number; y: number };
  onViewportChange?: (v: ImageViewport) => void;

  interpolation?: Interpolation;
  label?: string;
  pixelValueNotation?: PixelValueNotation;
}

/** Uint8 256x3 LUT -> Float32 256x4 (RGBA, [0,1]) for `CompareParams.diffColormap`. */
function floatLutFor(colormap: Exclude<Colormap, "none">): Float32Array {
  const bytes = getColormapLUT(colormap);
  const out = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    out[i * 4 + 0] = bytes[i * 3 + 0]! / 255;
    out[i * 4 + 1] = bytes[i * 3 + 1]! / 255;
    out[i * 4 + 2] = bytes[i * 3 + 2]! / 255;
    out[i * 4 + 3] = 1;
  }
  return out;
}

interface GpuResources {
  device: Device;
  surface: Surface | null;
  texA: Texture | null;
  texB: Texture | null;
}

/** The RGBA-expanded upload for a compare side: `Float32Array`+`rgba32float`
 *  (f32) or `Uint16Array`+`rgba16float` (F16 pipeline half bits). */
interface FloatUpload {
  data: Float32Array | Uint16Array;
  format: "rgba32float" | "rgba16float";
}

/** Expand a decoded float side (1/3/4 channels, row-major) into an RGBA upload
 *  — mirrors `GpuImagePane`'s `hdrToRGBAFloat32`.
 *
 *  F16 pipeline: a `precision:"f16-bits"` side (`Uint16Array` of raw binary16
 *  bits) expands RGB→RGBA IN HALF SPACE (alpha = `HALF_ONE`) into an
 *  `rgba16float` upload (8 bytes/px, never widened to f32); `textureLoad` yields
 *  f32 in the shader, so the diff math is unchanged. The f32 path is
 *  NaN/Inf-guarded (a bad sample never poisons the diff) as before; the half
 *  path passes bits through (non-finite halves stay non-finite, same as the
 *  shader would see after a float upload). */
function floatSideToRGBA(src: CompareFloatSource): FloatUpload {
  const { width, height, channels } = src;
  const n = width * height;
  if (src.precision === "f16-bits") {
    const data = src.data as Uint16Array;
    const out = new Uint16Array(n * 4);
    for (let i = 0; i < n; i++) {
      const base = i * channels;
      const o = i * 4;
      if (channels === 1) {
        const v = data[base]!;
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
        out[o + 3] = HALF_ONE;
      } else {
        out[o] = data[base]!;
        out[o + 1] = data[base + 1]!;
        out[o + 2] = data[base + 2]!;
        out[o + 3] = channels >= 4 ? data[base + 3]! : HALF_ONE;
      }
    }
    return { data: out, format: "rgba16float" };
  }
  const data = src.data;
  const out = new Float32Array(n * 4);
  const f = (v: number | undefined): number => (Number.isFinite(v) ? (v as number) : 0);
  for (let i = 0; i < n; i++) {
    const base = i * channels;
    let r: number;
    let g: number;
    let b: number;
    let a = 1;
    if (channels === 1) {
      r = g = b = f(data[base]);
    } else if (channels === 3) {
      r = f(data[base]);
      g = f(data[base + 1]);
      b = f(data[base + 2]);
    } else {
      r = f(data[base]);
      g = f(data[base + 1]);
      b = f(data[base + 2]);
      a = f(data[base + 3]);
    }
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
  }
  return { data: out, format: "rgba32float" };
}

export default function GpuComparePane({
  imageUrl,
  baselineUrl,
  imageFloat,
  baselineFloat,
  mode,
  splitPosition,
  blendAlpha,
  onSplitPositionChange,
  diffSubmode,
  colormap = "none",
  diffKernel: diffKernelProp,
  onDiffKernelChange,
  onCompareModeChange,
  onRequestSide,
  zoom,
  pan,
  onViewportChange,
  interpolation = "auto",
  label = "",
  pixelValueNotation = "decimal",
}: GpuComparePaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  // Attached by the shared shell (see `ImagePaneShell`); this pane measures
  // `paneRef` (padding 0), not the wrapper, so it's here only for the shell.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resRef = useRef<GpuResources | null>(null);
  // Most-recent cached diff entry (diff mode) — its scalars back the metrics
  // chip without a separate readback.
  const diffEntryRef = useRef<DiffCacheEntry | null>(null);

  // C1 fix (whole-branch review): true once the engine has definitively
  // failed to activate or render this compare pane (a hard GPU-init/render
  // failure). Once set, this component permanently renders the LEGACY
  // compare pane (`MediaComparePane` for split/blend, `CpuImagePane` for diff)
  // instead of the GPU canvas — see the bailout branch near the bottom of
  // this component's render body. A pane never blanks.
  const [engineFailed, setEngineFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [uploadVersion, setUploadVersion] = useState(0);
  const [containerTick, setContainerTick] = useState(0);
  const [metrics, setMetrics] = useState<DiffMetrics | null>(null);
  // The DISPLAYED uv window, for `PixelValueOverlay`'s
  // `sourceWindow` — same reasoning as `GpuImagePane`'s `overlayWindow`.
  const [overlayWindow, setOverlayWindow] = useState({ x: 0, y: 0, w: 1, h: 1 });

  // Diff KERNEL selection (spec §toolbar). Initial value comes from the
  // `diffKernel` prop (the descriptor's initial state) or, failing that, the
  // legacy `diffSubmode` (1:1 with the six pointwise kernel ids); internal
  // state then owns it so a menu can switch it view-locally. The toolbar-menu
  // track wires a dropdown to `listDiffKernels()` + `setDiffKernel`.
  const initialKernel = diffKernelProp ?? (diffSubmode as string | undefined) ?? "absolute";
  const [diffKernel, setDiffKernelState, diffKernelMeta] = useResettableState<string>(initialKernel);
  useEffect(() => {
    setDiffKernelState(diffKernelProp ?? (diffSubmode as string | undefined) ?? "absolute");
  }, [diffKernelProp, diffSubmode, setDiffKernelState]);
  const setDiffKernel = useCallback(
    (id: string) => {
      setDiffKernelState(id);
      onDiffKernelChange?.(id);
    },
    [onDiffKernelChange, setDiffKernelState],
  );
  // Expose the selection API on the pane element so the toolbar-menu track (and
  // the browser harness) can drive kernel switching without prop-drilling.
  useEffect(() => {
    const el = paneRef.current as (HTMLDivElement & { __cairnDiffKernel?: unknown }) | null;
    if (!el) return;
    el.__cairnDiffKernel = { current: diffKernel, set: setDiffKernel };
    return () => {
      if (el) delete el.__cairnDiffKernel;
    };
  }, [diffKernel, setDiffKernel]);

  // Compare MODE selection (spec §toolbar). The `mode` prop seeds the initial
  // composition (slide/blend/diff); internal state then owns it so the toolbar
  // MODE menu can switch it VIEW-LOCALLY (slide ⇄ blend ⇄ a diff kernel) without
  // a descriptor round-trip. NOTE: `"side"` is NOT reachable here — it's a
  // 2-cell grid composed ABOVE this pane by `CompositeMediaPane`, so the menu
  // scopes to slide · blend · kernels (see the menu build below).
  const [compareMode, setCompareModeState, compareModeMeta] = useResettableState<CompareMode>(mode);
  useEffect(() => {
    setCompareModeState(mode);
  }, [mode, setCompareModeState]);
  // Set the compare mode AND notify an owner above (so `CompareView` can keep
  // its lifted view-mode state coherent for side ⇄ compare round-trips). Menu
  // selections go through here; the prop-driven `useEffect` above does NOT
  // (that mirrors an owner change already made upstream — no echo back).
  const setCompareMode = useCallback(
    (next: CompareMode) => {
      setCompareModeState(next);
      onCompareModeChange?.(next);
    },
    [onCompareModeChange, setCompareModeState],
  );

  // Diff COLORMAP selection (spec §toolbar). Seeded from the `colormap` prop;
  // internal state owns it so the COLORMAP menu is view-local (display-only —
  // it NEVER changes the diff cache key / recompute count, only the blit LUT).
  const [colormapState, setColormapState, colormapMeta] = useResettableState<Colormap>(colormap);
  useEffect(() => {
    setColormapState(colormap);
  }, [colormap, setColormapState]);

  // HOME / double-click reset restores every VIEW-LOCAL selection to its
  // descriptor default — mode, colormap AND kernel — alongside the shell's own
  // viewport + EV/OFFSET reset (user requirement: home = fully neutral pane).
  // `setCompareMode` (not the raw state setter) so an owner above (CompareView)
  // re-syncs its lifted view-mode state too.
  // Descriptor DEFAULTS captured at MOUNT (via `useResettableState`'s seed
  // capture — first-render props are the descriptor-seeded values; later prop
  // changes mirror lifted view-local state, so resetting to the live prop would
  // no-op). Reset restores mode + kernel through their ECHO setters
  // (`setCompareMode`/`setDiffKernel`) so an owner above (CompareView) re-syncs
  // its lifted state; colormap has no echo callback (display-only), so it resets
  // through the raw setter — identical to the prior hand-rolled behavior.
  const resetViewSelections = useCallback(() => {
    setCompareMode(compareModeMeta.default);
    setColormapState(colormapMeta.default);
    setDiffKernel(diffKernelMeta.default);
  }, [
    setCompareMode,
    setColormapState,
    setDiffKernel,
    compareModeMeta.default,
    colormapMeta.default,
    diffKernelMeta.default,
  ]);
  // Home enables when any view-local selection is off its descriptor default.
  const viewSelectionsModified =
    compareModeMeta.isModified || colormapMeta.isModified || diffKernelMeta.isModified;

  // EXPOSURE / OFFSET display-adjust sliders (§requirement B). View-local,
  // display-only in EVERY mode. Split/blend: fed into the compose pass (`color *
  // 2^EV + offset` before tonemap/encode). Diff: fed into the display blit as the
  // colormap SENSITIVITY (the raw metric is scaled BEFORE the LUT). Neither path
  // touches the cached diff RESULT, so slider drags never recompute the diff.
  const [displayEV, setDisplayEV] = useState(0);
  const [displayOffset, setDisplayOffset] = useState(0);

  // The two leading toolbar menus (rendered by `ImagePaneShell` → `PlotToolbar`).
  //   MODE — slide · blend · every registered diff kernel (flat list). Selecting
  //          a view mode sets `compareMode`; selecting a kernel switches to diff
  //          mode AND sets the kernel (the `__cairnDiffKernel/set` path).
  //   COLORMAP — the registered colormaps; shown only in diff mode (colormap has
  //          no effect on slide/blend). Display-only (view-local state).
  const leadingMenus = useMemo<ToolbarButtonSpec[]>(() => {
    // `listDiffMenuModes()` collapses the FLIP family to one "FLIP (perceptual)"
    // entry (`flip`, auto-dispatched LDR/HDR by source type) + "FLIP (LDR
    // forced)" (`flip_ldr`) — HDR-FLIP is never listed separately. "Side" (the
    // 2-pane layout owned by `CompareView` ABOVE this pane) leads the menu only
    // when an owner wired `onRequestSide` — selecting it delegates UP (the
    // shader has no side pass) rather than touching internal state.
    const modeMenu = buildCompareModeMenu({
      mode: compareMode,
      kernel: diffKernel,
      kernelOptions: listDiffMenuModes().map((k) => ({ id: k.id, label: k.label })),
      onSide: onRequestSide,
      onSlide: () => setCompareMode("split"),
      onBlend: () => setCompareMode("blend"),
      onKernel: (id) => {
        setCompareMode("diff");
        setDiffKernel(id);
      },
    });
    const menus: ToolbarButtonSpec[] = [modeMenu];
    if (compareMode === "diff") {
      menus.push(colormapToolbarButton(colormapState, (id) => setColormapState(id as Colormap)));
    }
    return menus;
  }, [compareMode, diffKernel, colormapState, setDiffKernel, setCompareMode, onRequestSide]);

  // TEV per-side source pixels. u8 sides keep their raw `ImageData`; FLOAT sides
  // (`.exr`/`imghdr`) have NO 8-bit `ImageData` (decoded to `rgba32float`), so
  // the float source is retained separately and the sampler reads it directly —
  // otherwise a float side would show NO pixel numbers (the reported bug).
  const fgDataRef = useRef<ImageData | null>(null);
  const refDataRef = useRef<ImageData | null>(null);
  const fgFloatRef = useRef<CompareFloatSource | null>(null);
  const refFloatRef = useRef<CompareFloatSource | null>(null);
  const [pixelDataVersion, setPixelDataVersion] = useState(0);

  // Diff-mode TEV: the RESULT texture's per-pixel metric value(s), read back
  // lazily (once per cache entry) and cached in the entry. `null` while a
  // readback is in flight (the overlay then draws nothing and settles on its
  // own). `diffOverlayVersion` bumps on every kernel switch (clear) and on each
  // readback settle (draw), so the printed numbers TRACK the selected metric.
  const diffSamplesRef = useRef<Float32Array | null>(null);
  const [diffOverlayVersion, setDiffOverlayVersion] = useState(0);

  // Q22 fix: same as `GpuImagePane` — the canvas backing store / surface
  // track the on-screen display resolution x dpr, not the source images'.
  const dpr = useDevicePixelRatio();

  // ---- device/surface acquisition (once) --------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    // C1 fix (whole-branch review): this file is self-contained (module doc:
    // "NOT the pool") — unlike `renderers/GpuImagePane.tsx`, there is no
    // `engine/pool.ts` to catch a hard GPU-init failure here.
    // `device.createSurface()` can throw under real GPU-context exhaustion or
    // driver failure, and this used to run with NO try/catch at all.
    // `?forceEngineFail` (test-only, `./test-hooks`, matches the same hook
    // `engine/pool.ts` reads) deterministically triggers this same failure
    // path.
    getSharedDevice()
      .then((device) => {
        if (cancelled) return;
        try {
          if (forceEngineFailRequested()) {
            throw new Error("cairn-plot engine: forced compare-pane activation failure (?forceEngineFail test hook)");
          }
          const surface = device.createSurface(canvas, { hdr: false });
          resRef.current = { device, surface, texA: null, texB: null };
          setReady(true);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("cairn-plot: GpuComparePane failed to activate, falling back to legacy pane", err);
          setEngineFailed(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("cairn-plot: GpuComparePane could not resolve a GPU device, falling back to legacy pane", err);
        setEngineFailed(true);
      });
    return () => {
      cancelled = true;
      const r = resRef.current;
      if (r) {
        r.texA?.destroy();
        r.texB?.destroy();
        // `r.device` is the page-wide SHARED device (see module doc) — never
        // destroy it here, just stop using it for this canvas.
        resRef.current = null;
      }
    };
  }, []);

  // ---- container resize -> re-render ------------------------------------
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- load both sides -> upload source textures ------------------------
  // Each side is EITHER a decoded float payload (`imageFloat`/`baselineFloat`,
  // uploaded as `rgba32float`) OR a browser-decodable URL (`imageUrl`/
  // `baselineUrl`, decoded to `ImageData` and uploaded as `rgba8unorm`). Mixed
  // pairs work: the engine samples both formats via `textureLoad`.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const r = resRef.current;
    if (!r) return;

    // A resolved side: its natural dims, an optional `ImageData` for the TEV
    // pixel sampler (float sides have none — no 8-bit readout), and a `make`
    // that uploads it as a texture in its natural format.
    interface LoadedSide {
      width: number;
      height: number;
      imageData: ImageData | null;
      make: (device: Device) => Texture;
    }
    async function loadSide(
      url: string | null,
      float: CompareFloatSource | undefined,
    ): Promise<LoadedSide | null> {
      if (float) {
        const upload = floatSideToRGBA(float);
        return {
          width: float.width,
          height: float.height,
          imageData: null,
          make: (device) => {
            const t = device.createTexture(float.width, float.height, upload.format);
            t.write(upload.data);
            return t;
          },
        };
      }
      if (!url) return null;
      const d = await loadImageData(url);
      if (!d) return null;
      return {
        width: d.width,
        height: d.height,
        imageData: d,
        make: (device) => {
          const t = device.createTexture(d.width, d.height, "rgba8unorm");
          t.write(d.data);
          return t;
        },
      };
    }

    Promise.all([loadSide(imageUrl, imageFloat), loadSide(baselineUrl, baselineFloat)]).then(
      ([fg, ref]) => {
        if (cancelled || !resRef.current) return;
        const res = resRef.current;
        fgDataRef.current = fg?.imageData ?? null;
        refDataRef.current = ref?.imageData ?? null;
        // Retain the FLOAT sources next to the ImageData refs so the TEV sampler
        // can read float pixels (a float side has `imageData:null`).
        fgFloatRef.current = imageFloat ?? null;
        refFloatRef.current = baselineFloat ?? null;

        res.texA?.destroy();
        res.texB?.destroy();
        res.texA = null;
        res.texB = null;

        // Foreground drives the canvas natural dims. Reference falls back to the
        // foreground (single-source display) when absent so renderCompose always
        // has two bindings.
        const primary = fg ?? ref;
        if (!primary) {
          setDims(null);
          setPixelDataVersion((v) => v + 1);
          // Q24 fix: no explicit inline CSS size to drop — the canvas is
          // always `w-full h-full` of its wrapper (see `GpuImagePane`'s
          // identical reasoning for the `imageUrl:null` case).
          return;
        }
        // texA = reference/baseline (the shader's "A" role: left side / alpha=0
        // endpoint / diff `a` operand — matches legacy `compositor.tsx`'s
        // left-clipped reference pane, `ImagePane.tsx`'s blend alpha=0 side, and
        // `image/webgl-diff.ts`'s `computeDiffChannel(base.*, other.*, ...)`
        // where `base` = baselineUrl). texB = foreground/comparison ("B": right
        // side / alpha=1 / diff `b`).
        res.texA = (ref ?? primary).make(res.device);
        res.texB = (fg ?? primary).make(res.device);

        // Q22 fix: canvas backing-store / surface sizing is driven by the
        // render-pass effect below (display resolution x dpr), NOT the source
        // images' own resolution — no `canvas.width/height`/`surface.configure`
        // here.
        setDims({ w: primary.width, h: primary.height });
        setPixelDataVersion((v) => v + 1);
        setUploadVersion((v) => v + 1);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ready, imageUrl, baselineUrl, imageFloat, baselineFloat]);

  // ---- diff colormap params ---------------------------------------------
  // The colormap index mode follows the selected kernel's display range:
  // `signed`-range kernels center 0 at the LUT midpoint (cmap "signed"), the
  // rest push [0,1] into the upper half (cmap "positive") — same visual
  // convention the legacy diff blit used, now derived from the registry.
  // Auto-dispatch (spec addendum): float sources (imghdr / f32 EXR) route the
  // public `flip` selection → HDR-FLIP and `flip_ldr` → forced-LDR; u8 sources
  // keep LDR-FLIP. Either side being float is enough to make the pair "float".
  const sourcesAreFloat = imageFloat != null || baselineFloat != null;
  const resolvedKernelId = useMemo(
    () => resolveDiffKernelId(diffKernel, sourcesAreFloat),
    [diffKernel, sourcesAreFloat],
  );
  // HDR-FLIP exposure range: computed once per REFERENCE source content from its
  // linear luminance (max + median) — deterministic, so it folds into the diff
  // cache key without ever triggering a recompute on zoom/pan. The pane already
  // holds the decoded float array (`*Float.data`), so no GPU readback is needed.
  const hdrExposures = useMemo(() => {
    if (!sourcesAreFloat) return null;
    const ref = baselineFloat ?? imageFloat;
    if (!ref) return null;
    // F16 pipeline: `computeHdrFlipExposures` reads float VALUES (luminance), so
    // widen a half-bits reference once here (deterministic, memoized — folds
    // into the diff-cache key like the f32 path). See `../image/half.ts`.
    const refData =
      ref.precision === "f16-bits" ? f16BitsToFloat32(ref.data as Uint16Array) : ref.data;
    return computeHdrFlipExposures(refData, ref.width, ref.height, ref.channels);
  }, [sourcesAreFloat, baselineFloat, imageFloat]);

  // Derive the cmap index mode from BOTH the kernel's display range AND the
  // colormap's divergence (the reported bug: a SEQUENTIAL map like plasma/magma
  // must use its FULL range for a unit-range kernel, not be pushed into its upper
  // half). Colormap-dependent, but display-only — a colormap switch re-blits, it
  // never recomputes the cached diff.
  const diffCmapMode = useMemo(
    () =>
      resolveDiffCmapMode(
        getDiffKernel(resolvedKernelId)?.displayRange ?? "unit",
        colormapState === "none" ? null : colormapState,
      ),
    [resolvedKernelId, colormapState],
  );
  const diffColormap = useMemo<Float32Array | undefined>(
    () => (colormapState !== "none" ? floatLutFor(colormapState as Exclude<Colormap, "none">) : undefined),
    [colormapState],
  );

  // ---- render pass -------------------------------------------------------
  // Extracted into a stable callback so the screenshot path
  // (`useImageController`'s `toPNG`) can force a fresh, SYNCHRONOUS repaint
  // before reading the WebGPU canvas back (see that hook's module doc). The
  // effect below invokes it on the same dep set as before.
  const renderPass = useCallback(() => {
    const r = resRef.current;
    if (!ready || !r || !r.surface || !r.texA || !r.texB || !dims) return;
    const paneEl = paneRef.current;
    const box = paneEl ? paneEl.getBoundingClientRect() : { width: dims.w, height: dims.h };
    const rawUv = viewportToUvRect({ zoom, pan }, box, dims.w, dims.h);
    setOverlayWindow((prev) =>
      prev.x === rawUv.x && prev.y === rawUv.y && prev.w === rawUv.w && prev.h === rawUv.h ? prev : rawUv,
    );

    // Q24 fix: size the canvas's backing store / surface to the FULL pane
    // box (`box` — padding is 0 for this pane, so it's already the
    // padding-free content box) x `devicePixelRatio` — NOT a computed
    // letterboxed sub-rect (Q22's approach, which confined zoom/pan to the
    // image's own aspect box, leaving dead canvas space at any zoom, AND
    // desynced the SPLIT divider — positioned as a percentage of this SAME
    // `box`/wrapper — from the shader's `split` uniform, since the render
    // target no longer spanned the divider's own reference frame; see
    // `viewportToUvRect`'s doc comment for the matching uv-math fix — Q23).
    // The canvas's CSS LAYOUT box is just `w-full h-full` of its wrapper (no
    // inline style needed), so it already equals `box`.
    const canvasEl = canvasRef.current;
    if (box.width > 0 && box.height > 0 && canvasEl && r.surface) {
      const backingW = Math.max(1, Math.round(box.width * dpr));
      const backingH = Math.max(1, Math.round(box.height * dpr));
      if (canvasEl.width !== backingW || canvasEl.height !== backingH) {
        canvasEl.width = backingW;
        canvasEl.height = backingH;
        r.surface.configure(backingW, backingH);
      }
    }

    // Q20: same nearest/linear threshold GpuImagePane uses — see
    // `screenPxPerTexel`'s doc comment. Uses `box` directly — the canvas's
    // own box now matches it exactly (Q24), so no separate measurement is
    // needed.
    const filter: "nearest" | "linear" =
      screenPxPerTexel(rawUv, box, dims.w, dims.h) >= PIXEL_VALUE_MIN_SCREEN_PX ? "nearest" : "linear";
    const uv = rawUv;
    // C1 fix (whole-branch review): the render call is SYNCHRONOUS in this
    // effect; an uncaught throw would unmount this pane's whole subtree in
    // React 18. Catch and fall back to the legacy compare pane instead (see the
    // bailout branch near the bottom of this component's render body) — a pane
    // never blanks.
    try {
      if (compareMode === "diff") {
        // Cached kernel path (spec §cached): ensure the diff RESULT texture for
        // the CURRENT (contentKey, kernel, params) — a pure function of the
        // SOURCE content, NOT the viewport/exposure/colormap — then blit it
        // through the uv-window. Zoom/pan/exposure/colormap only re-run the
        // blit below; `ensureDiff` is a cache hit and does NOT recompute.
        // Content key: for a float side the ORIGINAL source URL
        // (`*Float.contentKey`) is the cache key, NOT the decoded bytes — so a
        // remount with the same URL is a cache hit, same as a URL side. (Task
        // point (b): "the URL string remains the content key".)
        const contentKeyRef = baselineFloat?.contentKey ?? baselineUrl ?? imageFloat?.contentKey ?? imageUrl ?? "none";
        const contentKeyFg = imageFloat?.contentKey ?? imageUrl ?? baselineFloat?.contentKey ?? baselineUrl ?? "none";
        // Auto-dispatch the selected mode to a concrete kernel by source type
        // (float → HDR-FLIP / forced-LDR; u8 → LDR-FLIP). HDR-FLIP needs the
        // reference-derived exposure range in its params so they enter the cache
        // key (deterministic per source; recomputed only when the content changes).
        const kernelId = getDiffKernel(resolvedKernelId) ? resolvedKernelId : "absolute";
        const diffParams: Record<string, number> | undefined =
          kernelId === "hdr-flip" && hdrExposures
            ? {
                ppd: 67,
                startExposure: hdrExposures.startExposure,
                stopExposure: hdrExposures.stopExposure,
                numExposures: hdrExposures.numExposures,
              }
            : undefined;
        const entry: DiffCacheEntry = ensureDiff(
          r.device,
          r.texA,
          r.texB,
          kernelId,
          diffParams,
          contentKeyRef,
          contentKeyFg,
        );
        diffEntryRef.current = entry;
        renderDiffDisplay(r.device, r.surface, entry.texture, entry.displayRange, {
          uv,
          cmapMode: diffCmapMode,
          colormap: diffColormap,
          filter,
          // Exposure/offset change the colormap SENSITIVITY (applied to the raw
          // metric BEFORE the LUT), display-only — never a diff recompute.
          exposureEV: displayEV,
          offset: displayOffset,
        });
      } else {
        const params: CompareParams = {
          exposureEV: displayEV,
          offset: displayOffset,
          operator: "linear",
          gamma: 1,
          isScalar: false,
          hdrOut: false,
          uv,
          filter,
          mode: compareMode,
          split: splitPosition,
          alpha: blendAlpha,
        };
        renderCompose(r.device, r.surface, r.texA, r.texB, params);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("cairn-plot: GpuComparePane render failed, falling back to legacy pane", err);
      setEngineFailed(true);
    }
  }, [
    ready,
    dims,
    zoom,
    pan.x,
    pan.y,
    compareMode,
    splitPosition,
    blendAlpha,
    displayEV,
    displayOffset,
    diffKernel,
    resolvedKernelId,
    hdrExposures,
    diffCmapMode,
    diffColormap,
    imageUrl,
    baselineUrl,
    imageFloat,
    baselineFloat,
    dpr,
  ]);

  useEffect(() => {
    renderPass();
  }, [renderPass, uploadVersion, containerTick]);

  // ---- metrics (computed on source change; NEVER on viewport/exposure) -----
  // In diff mode the scalars are cached IN the diff-cache entry
  // (`ensureDiffScalars`), so a remount with the same sources is a cache hit —
  // fixing the legacy remount-recompute. Split/blend have no diff entry, so
  // they fall back to a direct `computeMetrics` over the sources.
  // A reference side is present when there's a URL baseline OR a float baseline.
  const hasBaseline = baselineUrl != null || baselineFloat != null;
  useEffect(() => {
    const r = resRef.current;
    if (!ready || !r || !r.texA || !r.texB || !hasBaseline) {
      setMetrics(null);
      return;
    }
    let cancelled = false;
    const texA = r.texA;
    const texB = r.texB;
    const entry = diffEntryRef.current;
    const p =
      compareMode === "diff" && entry
        ? ensureDiffScalars(r.device, entry, texA, texB)
        : computeMetrics(r.device, texA, texB);
    p.then((m) => {
      if (!cancelled) setMetrics(m);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, uploadVersion, hasBaseline, compareMode, diffKernel]);

  // ---- diff RESULT readback (TEV per-pixel metric values) ----------------
  // In diff mode the overlay must show the METRIC value(s), NOT the source
  // prediction pixels (the reported bug). Read back the cached RESULT texture
  // once per entry (memoized IN the entry); keyed on the SOURCE/kernel identity
  // (via `resolvedKernelId`/`uploadVersion`) so zoom/pan/colormap/exposure never
  // re-read and `getDiffComputeCount()` never moves. `renderPass` (the effect
  // above) has already populated `diffEntryRef.current` for the current kernel
  // by the time this runs (same commit, declared earlier).
  useEffect(() => {
    if (compareMode !== "diff") {
      diffSamplesRef.current = null;
      return;
    }
    const r = resRef.current;
    const entry = diffEntryRef.current;
    if (!ready || !r || !entry) return;
    let cancelled = false;
    // Clear the old metric's numbers immediately on a kernel switch, then settle
    // to the new metric's values when the readback resolves — no user gesture.
    diffSamplesRef.current = null;
    setDiffOverlayVersion((v) => v + 1);
    ensureDiffResultReadback(r.device, entry)
      .then((arr) => {
        if (cancelled) return;
        diffSamplesRef.current = arr;
        setDiffOverlayVersion((v) => v + 1);
      })
      .catch(() => {
        /* readback failure: leave numbers blank (non-fatal, display-only) */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, compareMode, resolvedKernelId, uploadVersion]);

  // ---- TEV samplers ------------------------------------------------------
  // A side is EITHER u8 (`ImageData`) or FLOAT (`CompareFloatSource`); the
  // sampler checks the float ref FIRST (a float side has no `ImageData`), then
  // falls back to the u8 `ImageData`. Float values use the `"unit"` float
  // formatting (0–1 = SDR white; the notation toggle switches 0–1 ↔ 0–255) and a
  // mid-grey luminance fallback — mirroring the HDR image panes (`GpuImagePane`'s
  // `hdrMode` branch / `CpuHdrImagePane`), so both sides show numbers and float
  // sides read as floats.
  const makeSampler =
    (dataRef: React.RefObject<ImageData | null>, floatRef: React.RefObject<CompareFloatSource | null>) =>
    (px: number, py: number, notationArg: PixelValueNotation): PixelSample | null => {
      const fl = floatRef.current;
      if (fl) {
        const { data, width, height, channels } = fl;
        if (px < 0 || py < 0 || px >= width || py >= height) return null;
        const base = (py * width + px) * channels;
        // F16 pipeline: widen the touched sample lazily (single pixel).
        const readV =
          fl.precision === "f16-bits"
            ? (k: number) => halfToFloat(data[k] ?? 0)
            : (k: number) => data[k] ?? 0;
        const luminance = 0.5; // GPU-rendered: no CPU-tonemapped buffer retained
        const values =
          channels === 1
            ? [readV(base)]
            : [readV(base), readV(base + 1), readV(base + 2)];
        return buildChannelSample(values, "unit", notationArg, luminance);
      }
      const d = dataRef.current;
      if (!d || px < 0 || py < 0 || px >= d.width || py >= d.height) return null;
      const i = (py * d.width + px) * 4;
      const r = d.data[i]!;
      const g = d.data[i + 1]!;
      const b = d.data[i + 2]!;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return buildChannelSample(r === g && g === b ? [r] : [r, g, b], "uint8", notationArg, luminance);
    };
  const sampleFg = useMemo(() => makeSampler(fgDataRef, fgFloatRef), []);
  const sampleRef = useMemo(() => makeSampler(refDataRef, refFloatRef), []);

  // Diff-mode sampler: reads the RESULT readback (the computed metric), NOT a
  // source image. A `"scalar"` kernel (FLIP) prints ONE untinted line (the raw
  // metric, in "unit" float formatting); a `"per-channel"` kernel prints three
  // channel-tinted lines. Reads `diffSamplesRef` live, so it needn't depend on
  // the (frequently-bumped) readback array itself.
  const sampleDiff = useMemo(() => {
    return (px: number, py: number, notationArg: PixelValueNotation): PixelSample | null => {
      const arr = diffSamplesRef.current;
      if (!arr || !dims) return null;
      const { w, h } = dims;
      if (px < 0 || py < 0 || px >= w || py >= h) return null;
      const base = (py * w + px) * 4;
      const output = getDiffKernel(resolvedKernelId)?.output ?? "per-channel";
      const luminance = 0.5; // GPU-rendered diff: no CPU-tonemapped buffer retained
      // FLIP & friends ("scalar") replicate the metric across R/G/B — read R and
      // print one untinted line; per-channel kernels print three tinted lines.
      const values =
        output === "scalar"
          ? [arr[base] ?? 0]
          : [arr[base] ?? 0, arr[base + 1] ?? 0, arr[base + 2] ?? 0];
      return buildChannelSample(values, "unit", notationArg, luminance);
    };
  }, [dims, resolvedKernelId]);

  const imgRendering = interpolation === "auto" ? undefined : interpolation;

  // The viewport interaction, the double-click reset, the PlotToolbar +
  // `useImageController` wiring (with `requestRender: renderPass`) and the
  // notation leading button all live in the shared `ImagePaneShell` — this
  // compare pane keeps only its own render pass / metrics / split overlays.

  // C1 fix (whole-branch review) — engine bailout: on any activation/render
  // hard failure, self-heal to the LEGACY compare pane using the SAME props
  // this component already received — `mode:"diff"` mirrors
  // `compositor.tsx`'s own "normal"|"diff" branch (`ImagePane` with
  // `diffMode`), `mode:"split"|"blend"` mirrors its split/blend branch
  // (`MediaComparePane`) — so the image still renders — never a blank card.
  // Placed after every hook above runs unconditionally (rules-of-hooks) but
  // before this component paints its own GPU canvas.
  if (engineFailed) {
    // A float side can't self-heal to a CPU pane — the legacy panes take only
    // URL sources (`rgba32float` is GPU-only). Surface the standard clear error
    // instead of a blank pane (Task point 3).
    if (imageFloat != null || baselineFloat != null) {
      return <CompareFloatUnsupportedError />;
    }
    if (compareMode === "diff") {
      return (
        <CpuImagePane
          imageUrl={imageUrl}
          baselineUrl={baselineUrl}
          // FLIP is GPU-only (spec: CPU compare keeps its pointwise modes) —
          // if the GPU pane fell back, map the selected kernel to a valid CPU
          // DiffMode (the pointwise ids are 1:1; `flip` degrades to `absolute`).
          diffMode={(getDiffKernel(resolvedKernelId)?.kind === "pointwise" ? resolvedKernelId : "absolute") as DiffMode}
          interpolation={interpolation}
          colormap={colormapState}
          showAxes={false}
          zoom={zoom}
          pan={pan}
          onViewportChange={onViewportChange}
          label={label}
          pixelValueNotation={pixelValueNotation}
        />
      );
    }
    return (
      <MediaComparePane
        imageUrl={imageUrl}
        baselineUrl={baselineUrl}
        mode={compareMode as Extract<CompareMode, "split" | "blend">}
        splitPosition={splitPosition}
        blendAlpha={blendAlpha}
        onSplitPositionChange={onSplitPositionChange}
        zoom={zoom}
        pan={pan}
        onViewportChange={onViewportChange}
        interpolation={interpolation}
        label={label}
        pixelValueNotation={pixelValueNotation}
      />
    );
  }

  // The canvas is the FULL viewport (`w-full h-full` of the shell's wrapper,
  // no inline size / object-fit — only its device-pixel backing store is set
  // imperatively in the render pass). The image quads are placed inside it by
  // `viewportToUvRect`; the split divider below is positioned as a percentage
  // of that SAME wrapper, so the divider and the shader's `split` boundary
  // agree at any zoom/aspect by construction (Q23), no coordinate conversion.
  const surface = (
    <>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ imageRendering: imgRendering }}
        data-gpu-compare-canvas
      />
      {/* Full-height, gapless split divider — drives the `split` uniform. */}
      {compareMode === "split" && (
        <div
          className="absolute top-0 bottom-0 z-20 flex items-center"
          style={{ left: `${splitPosition * 100}%`, transform: "translateX(-50%)", cursor: "col-resize" }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onSplitPositionChange?.(0.5);
          }}
          onPointerDown={(ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            const container = ev.currentTarget.parentElement!;
            const rect = container.getBoundingClientRect();
            const onMoveEvt = (me: PointerEvent) => {
              onSplitPositionChange?.(Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width)));
            };
            const onUpEvt = () => {
              window.removeEventListener("pointermove", onMoveEvt);
              window.removeEventListener("pointerup", onUpEvt);
            };
            window.addEventListener("pointermove", onMoveEvt);
            window.addEventListener("pointerup", onUpEvt);
          }}
        >
          <div className="w-1 h-full bg-accent/80 rounded-full" />
        </div>
      )}
    </>
  );

  return (
    <ImagePaneShell
      paneAttrs={{ "data-gpu-compare-pane": "", "data-gpu-compare-ready": ready }}
      viewportAttrs={{ "data-gpu-compare-viewport": "" }}
      toolbar
      paneRef={paneRef}
      wrapperRef={wrapperRef}
      zoom={zoom}
      pan={pan}
      onViewportChange={onViewportChange}
      naturalDims={dims}
      checkerboard="pane"
      wrapperClassName="relative w-full h-full flex items-center justify-center"
      viewportPadding={0}
      surface={surface}
      showAxes={false}
      notationSeed={pixelValueNotation}
      onReset={resetViewSelections}
      extraModified={viewSelectionsModified}
      exportCanvasRef={canvasRef}
      requestRender={renderPass}
      leadingMenus={leadingMenus}
      // EXPOSURE / OFFSET sliders: in split/blend they adjust the compose pass;
      // in DIFF they adjust the colormap SENSITIVITY (value * 2^EV + offset fed
      // to the LUT, `renderDiffDisplay`'s `exposureEV`/`offset`). Either way it's
      // display-only — a slider drag re-blits the cached diff, never recomputes
      // it — so the row is shown in ALL modes now.
      displayAdjust={{
        exposureEV: displayEV,
        offset: displayOffset,
        onExposureChange: setDisplayEV,
        onOffsetChange: setDisplayOffset,
      }}
      label=""
      showLabelChip={false}
      // Per-side TEV overlays. split -> each side clipped at the divider, LEFT
      // (x<split) = reference, RIGHT (x>=split) = foreground (matching the
      // texA=reference / texB=foreground binding + legacy compositor.tsx);
      // blend/diff -> single foreground overlay. The shell owns the notation /
      // active state and passes them in here.
      overlay={{
        render: ({ notation, setOverlayActive }) =>
          compareMode === "split" ? (
            <>
              {hasBaseline && dims && (
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  style={{ clipPath: `inset(0 ${(1 - splitPosition) * 100}% 0 0)` }}
                >
                  <PixelValueOverlay
                    imageElRef={canvasRef}
                    naturalWidth={dims.w}
                    naturalHeight={dims.h}
                    zoom={zoom}
                    pan={pan}
                    sourceWindow={overlayWindow}
                    sample={sampleRef}
                    notation={notation}
                    version={pixelDataVersion}
                  />
                </div>
              )}
              {hasBaseline && dims && (
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  style={{ clipPath: `inset(0 0 0 ${splitPosition * 100}%)` }}
                >
                  <PixelValueOverlay
                    imageElRef={canvasRef}
                    naturalWidth={dims.w}
                    naturalHeight={dims.h}
                    zoom={zoom}
                    pan={pan}
                    sourceWindow={overlayWindow}
                    sample={sampleFg}
                    notation={notation}
                    version={pixelDataVersion}
                    onActiveChange={setOverlayActive}
                  />
                </div>
              )}
            </>
          ) : (
            dims && (
              <PixelValueOverlay
                imageElRef={canvasRef}
                naturalWidth={dims.w}
                naturalHeight={dims.h}
                zoom={zoom}
                pan={pan}
                sourceWindow={overlayWindow}
                // diff -> the computed METRIC values; blend -> the foreground.
                sample={compareMode === "diff" ? sampleDiff : sampleFg}
                notation={notation}
                version={compareMode === "diff" ? diffOverlayVersion : pixelDataVersion}
                onActiveChange={setOverlayActive}
              />
            )
          ),
      }}
      extraChips={
        <>
          {/* REF chip (Change 1): shown ONLY when BOTH images are visible on
              screen — i.e. `split`/slide (the left-of-divider side IS the
              reference). Hidden for `blend` (images fused, no distinct reference
              side) and every `diff` kernel (a derived error map has no reference
              side). `side` shows its own REF chip on the reference pane. */}
          {compareMode === "split" && (
            <span className="absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm">
              REF
            </span>
          )}
          {label ? (
            <span className="absolute bottom-1 right-1 z-10 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm">
              {label}
            </span>
          ) : null}
          {metrics && (
            <span
              // §requirement C: the diff metrics live in the LOWER-RIGHT corner.
              // When a label chip also occupies bottom-right (`label` truthy,
              // bottom-1 right-1), stack the metrics directly ABOVE it (bottom-7);
              // otherwise pin it to bottom-1. z-30 keeps it ABOVE the split
              // divider (z-20) so dragging the divider never occludes it.
              className={`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${label ? "bottom-7" : "bottom-1"}`}
              data-gpu-compare-metrics
            >
              MSE {metrics.mse.toExponential(2)} · PSNR {Number.isFinite(metrics.psnr) ? metrics.psnr.toFixed(1) : "∞"} dB · MAE{" "}
              {metrics.mae.toExponential(2)}
            </span>
          )}
        </>
      }
    />
  );
}
