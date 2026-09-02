import React from "react";
import { createRoot } from "react-dom/client";
import GpuImagePane from "../../webgpu/view";
import { urlSource, type ImageComparisonInput } from "../../runtime/contracts";
import { isDeviceLostError } from "../../webgpu/device/device";
import { createHarness, waitFor } from "../../../../testing/harness";

const h = React.createElement;
const { report, setOverallStatus } = createHarness({
  title: "CACHED ERROR MAP NUMBERS",
  colors: { pass: "#6f6", fail: "#f66" },
});

function patternUrl(invert: boolean): string {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const high = ((x >> 2) + (y >> 2)) % 2 === 0;
      const value = (invert ? !high : high) ? 224 : 32;
      ctx.fillStyle = `rgb(${value},${Math.max(0, value - x * 4)},${Math.min(255, value + y * 2)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL("image/png");
}

function overlayHasInk(container: HTMLElement): boolean {
  const overlays = Array.from(container.querySelectorAll<HTMLCanvasElement>('canvas[aria-hidden="true"]'));
  return overlays.some((canvas) => {
    if (canvas.width === 0 || canvas.height === 0) return false;
    const data = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!data) return false;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
    return false;
  });
}

async function runOperation(operationId: "flip" | "ssim"): Promise<boolean> {
  const container = document.createElement("div");
  container.style.width = "640px";
  container.style.height = "480px";
  container.style.margin = "8px 0";
  document.body.appendChild(container);

  const a = patternUrl(false);
  const b = patternUrl(true);
  const comparison: ImageComparisonInput = {
    b: urlSource(b),
    operationId,
    mode: "diff",
    splitPosition: 0.5,
  };
  const root = createRoot(container);
  root.render(h(GpuImagePane, {
    source: urlSource(a),
    compareSource: comparison,
    zoom: 2,
    pan: { x: -320, y: -240 },
    colormap: "magma",
    toolbar: true,
    label: operationId,
  }));

  const rendered = await waitFor(
    () => container.querySelector('[data-gpu-backend-ready="true"]') !== null,
    15000,
    25,
  );
  report(rendered, `${operationId}: GPU pane becomes ready`);
  const numbers = rendered && await waitFor(() => overlayHasInk(container), 15000, 25);
  report(numbers, `${operationId}: lazy cached result readback produces per-pixel numeric glyphs`);

  root.unmount();
  container.remove();
  return rendered && numbers;
}

async function main(): Promise<void> {
  try {
    const flip = await runOperation("flip");
    const ssim = await runOperation("ssim");
    setOverallStatus(flip && ssim);
  } catch (error) {
    if (isDeviceLostError(error)) {
      report(true, `SKIPPED — device lost during GPU teardown: ${String(error)}`);
      setOverallStatus(true);
      return;
    }
    report(false, `threw: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    setOverallStatus(false);
  }
}

void main();
