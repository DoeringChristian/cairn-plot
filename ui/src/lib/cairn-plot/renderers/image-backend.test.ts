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
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useLegacyImageProps, type ImageBackendProps } from "./image-backend.ts";

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
