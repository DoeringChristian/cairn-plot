/**
 * Regression tests for the ONE image-backend prop fan-out
 * (`useLegacyImageProps`) — the seam that reconstructs each pane's internal
 * {@link LegacyImageProps} from the unified {@link ImageBackendProps}, keyed on
 * `source.dtype`.
 *
 * BUG PINNED HERE: the FLOAT branch dropped `colormap`, so an authored
 * `cp.Image(float_scalar, colormap="magma")` reached the pane as `propColormap
 * === "none"` and the DISPLAY encoding seeded to sRGB grayscale (the authored
 * LUT was silently lost). The unified float surface honours named colormaps, so
 * BOTH dtype branches must forward `colormap`. These run under Node's
 * type-stripping runner via `react-dom/server` (no DOM, no JSX — the hook is
 * exercised inside a real render so `useMemo` behaves).
 *
 * SAME-SHAPE BUG (M7), pinned below: the FLOAT branch also dropped
 * `overlay`/`overlaySettings`, so an authored detection overlay (boxes/masks)
 * drew on a uint8 PNG but rendered NOTHING on an EXR/float image. Detection
 * overlays composite over any dtype (a display-space CSS layer), so BOTH dtype
 * branches must forward them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useLegacyImageProps, type ImageBackendProps } from "../backends/contracts.ts";
import {
  DEFAULT_OVERLAY_SETTINGS,
  type ImageOverlayData,
  type ImageOverlaySettings,
} from "../../types.ts";

/** Render `useLegacyImageProps(backend)` and surface the fanned-out props'
 *  `{surface}:{colormap}` so a test can assert what the pane body would read. */
function fanOut(backend: ImageBackendProps): { surface: "hdr" | "sdr"; colormap: string } {
  let captured!: { surface: "hdr" | "sdr"; colormap: string };
  function Probe() {
    const legacy = useLegacyImageProps(backend) as { hdr?: unknown; colormap?: string };
    captured = {
      surface: legacy.hdr != null ? "hdr" : "sdr",
      colormap: legacy.colormap ?? "<unset>",
    };
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return captured;
}

/** Fan out and surface `{surface}` plus whether `overlay`/`overlaySettings`
 *  survived — what the pane's `overlayNode` gate reads. */
function fanOutOverlay(backend: ImageBackendProps): {
  surface: "hdr" | "sdr";
  overlay: ImageOverlayData | undefined;
  overlaySettings: ImageOverlaySettings | undefined;
} {
  let captured!: {
    surface: "hdr" | "sdr";
    overlay: ImageOverlayData | undefined;
    overlaySettings: ImageOverlaySettings | undefined;
  };
  function Probe() {
    const legacy = useLegacyImageProps(backend) as {
      hdr?: unknown;
      overlay?: ImageOverlayData;
      overlaySettings?: ImageOverlaySettings;
    };
    captured = {
      surface: legacy.hdr != null ? "hdr" : "sdr",
      overlay: legacy.overlay,
      overlaySettings: legacy.overlaySettings,
    };
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return captured;
}

const sampleOverlay = (): ImageOverlayData => ({
  boxes: [
    {
      class_id: 1,
      position: { minX: 0.1, minY: 0.1, maxX: 0.5, maxY: 0.5 },
      domain: "fraction",
    },
  ],
});
const sampleOverlaySettings = (): ImageOverlaySettings => ({ ...DEFAULT_OVERLAY_SETTINGS });

const floatSource = (): ImageBackendProps["source"] => ({
  dtype: "float",
  data: new Float32Array([0, 0.25, 0.5, 0.75, 1, 0.5]),
  shape: [2, 3],
  numpyDtype: "<f4",
});

test("useLegacyImageProps forwards colormap on a FLOAT (HDR) source", () => {
  // The unified float surface honours a named LUT — the authored colormap must
  // survive the fan-out so the pane seeds DISPLAY to it (was dropped → grayscale).
  const out = fanOut({ source: floatSource(), colormap: "magma", label: "err" });
  assert.equal(out.surface, "hdr");
  assert.equal(out.colormap, "magma");
});

test("useLegacyImageProps forwards colormap on a UINT8 (SDR) source", () => {
  const out = fanOut({ source: { dtype: "uint8", url: "data:," }, colormap: "turbo", label: "x" });
  assert.equal(out.surface, "sdr");
  assert.equal(out.colormap, "turbo");
});

test("useLegacyImageProps leaves colormap unset when the descriptor omits it", () => {
  // Unset stays unset on both surfaces (renderer default = plain sRGB grayscale
  // scalar / light RGB) — the fan-out must not invent a colormap.
  assert.equal(fanOut({ source: floatSource(), label: "f" }).colormap, "<unset>");
  assert.equal(
    fanOut({ source: { dtype: "uint8", url: "data:," }, label: "u" }).colormap,
    "<unset>",
  );
});

test("useLegacyImageProps forwards overlay/overlaySettings on a FLOAT (HDR) source", () => {
  // M7 REGRESSION: the float branch used to omit overlay/overlaySettings, so a
  // detection overlay authored on an EXR/float image reached the pane as
  // undefined and the `overlayNode` gate rendered NOTHING — no boxes, no masks,
  // no warning. Both must survive the fan-out on the float surface.
  const overlay = sampleOverlay();
  const overlaySettings = sampleOverlaySettings();
  const out = fanOutOverlay({ source: floatSource(), overlay, overlaySettings, label: "err" });
  assert.equal(out.surface, "hdr");
  assert.deepEqual(out.overlay, overlay);
  assert.deepEqual(out.overlaySettings, overlaySettings);
});

test("useLegacyImageProps forwards overlay/overlaySettings on a UINT8 (SDR) source", () => {
  const overlay = sampleOverlay();
  const overlaySettings = sampleOverlaySettings();
  const out = fanOutOverlay({
    source: { dtype: "uint8", url: "data:," },
    overlay,
    overlaySettings,
    label: "x",
  });
  assert.equal(out.surface, "sdr");
  assert.deepEqual(out.overlay, overlay);
  assert.deepEqual(out.overlaySettings, overlaySettings);
});

test("useLegacyImageProps leaves overlay unset when the descriptor omits it", () => {
  // The fan-out must not invent an overlay on either surface.
  const f = fanOutOverlay({ source: floatSource(), label: "f" });
  assert.equal(f.overlay, undefined);
  assert.equal(f.overlaySettings, undefined);
  const u = fanOutOverlay({ source: { dtype: "uint8", url: "data:," }, label: "u" });
  assert.equal(u.overlay, undefined);
  assert.equal(u.overlaySettings, undefined);
});
