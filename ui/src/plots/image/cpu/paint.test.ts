/**
 * The CPU backend's viewport paint: a pure texel-window clip plus ONE
 * `drawImage` into the presentation canvas's device-pixel backing store. Node
 * has no canvas, so the paint is exercised against a recording context object.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleTexelWindow, paintViewport } from "./paint.ts";
import { deriveImageViewport } from "../components/image-viewport.ts";

test("visibleTexelWindow clips to the texels intersecting the box", () => {
  const quad = { left: -437.83, top: -380.37, width: 1517.66, height: 1011.77 }; // 12x8 grid, ~126.5 px texels
  const w = visibleTexelWindow(quad, { width: 642, height: 250 }, { w: 12, h: 8 })!;
  assert.deepEqual(w, { x0: 3, y0: 3, x1: 9, y1: 5 });
  assert.equal(
    visibleTexelWindow({ left: 1000, top: 0, width: 10, height: 10 }, { width: 100, height: 100 }, { w: 2, h: 2 }),
    null,
  );
});

interface RecordedContext extends CanvasRenderingContext2D {
  calls: unknown[][];
}

function recordingContext(): RecordedContext {
  const calls: unknown[][] = [];
  return {
    calls,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "low",
    setTransform: (...a: unknown[]) => calls.push(["setTransform", ...a]),
    clearRect: (...a: unknown[]) => calls.push(["clearRect", ...a]),
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    beginPath: () => {},
    rect: (...a: unknown[]) => calls.push(["rect", ...a]),
    clip: () => calls.push(["clip"]),
    drawImage: (...a: unknown[]) => calls.push(["drawImage", ...a]),
  } as unknown as RecordedContext;
}

const ZOOMED = deriveImageViewport({
  box: { width: 642, height: 277.5 },
  backing: { width: 1284, height: 555 },
  view: { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } },
  natural: { w: 512, h: 512 },
  interpolation: "auto",
})!;

test("paintViewport issues one drawImage with integer source texels and device-px destination", () => {
  const ctx = recordingContext();
  paintViewport(ctx, ZOOMED, { bitmap: {} as CanvasImageSource, width: 512, height: 512 });
  const draw = ctx.calls.find((c) => c[0] === "drawImage")!;
  const [, , sx, sy, sw, sh, dx, dy, dw] = draw as [
    string, unknown, number, number, number, number, number, number, number, number,
  ];
  assert.ok(Number.isInteger(sx) && Number.isInteger(sy) && Number.isInteger(sw) && Number.isInteger(sh));
  assert.ok(Math.abs(dx - (ZOOMED.quad.left + sx * ZOOMED.pxPerTexel) * 2) < 1e-6);
  assert.ok(Math.abs(dy - (ZOOMED.quad.top + sy * ZOOMED.pxPerTexel) * 2) < 1e-6);
  assert.ok(dw <= 1284 + 2 * ZOOMED.pxPerTexel * 2 + 1);
  assert.equal(ctx.imageSmoothingEnabled, false); // nearest at this zoom
  assert.equal(ctx.calls.filter((c) => c[0] === "drawImage").length, 1);
});

test("paintViewport clears the whole backing store first, and only once per pass", () => {
  const ctx = recordingContext();
  paintViewport(ctx, ZOOMED, { bitmap: {} as CanvasImageSource, width: 512, height: 512 });
  assert.deepEqual(ctx.calls[0], ["setTransform", 1, 0, 0, 1, 0, 0]);
  assert.deepEqual(ctx.calls[1], ["clearRect", 0, 0, 1284, 555]);
  const second = recordingContext();
  paintViewport(second, ZOOMED, { bitmap: {} as CanvasImageSource, width: 512, height: 512 }, { clear: false });
  assert.equal(second.calls.filter((c) => c[0] === "clearRect").length, 0);
});

test("an off-screen quad clears but draws nothing", () => {
  const viewport = deriveImageViewport({
    box: { width: 100, height: 100 },
    backing: { width: 100, height: 100 },
    view: { zoom: 1, pan: { x: 10000, y: 0 } },
    natural: { w: 8, h: 8 },
    interpolation: "auto",
  })!;
  const ctx = recordingContext();
  paintViewport(ctx, viewport, { bitmap: {} as CanvasImageSource, width: 8, height: 8 });
  assert.equal(ctx.calls.filter((c) => c[0] === "drawImage").length, 0);
  assert.equal(ctx.calls.filter((c) => c[0] === "clearRect").length, 1);
});

test("clipFraction restricts the paint to a device-pixel band of the box", () => {
  const ctx = recordingContext();
  paintViewport(
    ctx,
    ZOOMED,
    { bitmap: {} as CanvasImageSource, width: 512, height: 512 },
    { clipFraction: [0.25, 1] },
  );
  const rect = ctx.calls.find((c) => c[0] === "rect")!;
  assert.deepEqual(rect, ["rect", 0.25 * 1284, 0, 0.75 * 1284, 555]);
  assert.ok(ctx.calls.some((c) => c[0] === "clip"));
  assert.ok(ctx.calls.some((c) => c[0] === "save"));
  assert.ok(ctx.calls.some((c) => c[0] === "restore"));
});

test("a foreground `grid` fills the reference quad with its own texel count", () => {
  const viewport = deriveImageViewport({
    box: { width: 200, height: 100 },
    backing: { width: 200, height: 100 },
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    natural: { w: 4, h: 4 },
    interpolation: "auto",
  })!;
  const ctx = recordingContext();
  paintViewport(ctx, viewport, { bitmap: {} as CanvasImageSource, width: 8, height: 8 }, { grid: { w: 8, h: 8 } });
  const draw = ctx.calls.find((c) => c[0] === "drawImage")! as unknown[];
  // The 8x8 foreground covers the SAME quad as the 4x4 reference: full source
  // rect, destination = the reference quad.
  assert.deepEqual(draw.slice(2, 6), [0, 0, 8, 8]);
  assert.deepEqual(draw.slice(6), [
    viewport.quad.left,
    viewport.quad.top,
    viewport.quad.width,
    viewport.quad.height,
  ]);
});
