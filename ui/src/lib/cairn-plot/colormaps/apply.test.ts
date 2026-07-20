/**
 * Node test: `applyColormap`'s exposure/offset fold — the sliders adjust the
 * value fed into the LUT (colormap SENSITIVITY) BEFORE the index mapping, so
 * exposure moves a given pixel along the ramp. DOM-free: a tiny `ImageData`
 * shim (node has no `ImageData` global).
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/colormaps/apply.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Minimal ImageData polyfill (data + width/height is all applyColormap uses).
class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(a: Uint8ClampedArray | number, b?: number, c?: number) {
    if (typeof a === "number") {
      this.width = a;
      this.height = b!;
      this.data = new Uint8ClampedArray(a * b! * 4);
    } else {
      this.data = a;
      this.width = b!;
      this.height = c!;
    }
  }
}
(globalThis as { ImageData?: unknown }).ImageData = FakeImageData;

const { applyColormap } = await import("./apply.ts");
const { getColormapLUT } = await import("./lut.ts");

function px(gray: number): InstanceType<typeof FakeImageData> {
  return new FakeImageData(new Uint8ClampedArray([gray, gray, gray, 255]), 1, 1);
}
function rgbOf(img: { data: Uint8ClampedArray }): [number, number, number] {
  return [img.data[0]!, img.data[1]!, img.data[2]!];
}

test("EV=0/offset=0 is identity vs. the no-arg call", () => {
  const a = applyColormap(px(100), "magma", "linear");
  const b = applyColormap(px(100), "magma", "linear", 0, 0);
  assert.deepEqual(rgbOf(a), rgbOf(b));
});

test("positive exposure pushes a mid pixel UP the ramp (brighter magma index)", () => {
  const base = applyColormap(px(64), "magma", "linear", 0, 0);
  const exposed = applyColormap(px(64), "magma", "linear", 2, 0); // *4 -> index ~255
  const lut = getColormapLUT("magma");
  // 64/255 * 4 = ~1.0 -> clamps to the LUT top (magma pale [252,253,191]).
  assert.deepEqual(rgbOf(exposed), [lut[255 * 3]!, lut[255 * 3 + 1]!, lut[255 * 3 + 2]!]);
  // and it is a HIGHER index than the un-exposed sample.
  assert.notDeepEqual(rgbOf(exposed), rgbOf(base));
});

test("exposure is applied BEFORE the LUT: EV maps value 32 to the same index as value 64 at EV-1", () => {
  // 32 * 2^1 == 64 * 2^0 in the [0,1] domain -> identical LUT index/color.
  const a = applyColormap(px(32), "viridis", "linear", 1, 0);
  const b = applyColormap(px(64), "viridis", "linear", 0, 0);
  assert.deepEqual(rgbOf(a), rgbOf(b));
});
