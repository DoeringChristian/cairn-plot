/**
 * The display-space `processing` block as a per-pixel pass (the CPU backend's
 * replacement for the old CSS/SVG filter chain on the `<img>` surface). Node has
 * no `ImageData` global, so the fixtures are plain objects with the same shape —
 * `processing.ts` builds its result the same way when the global is missing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyProcessingToImageData, isIdentityProcessing } from "./processing.ts";

const IDENTITY = { brightness: 0, contrast: 0, gamma: 1, exposure: 0, offset: 0, flipSign: false };
const px = (r: number, g: number, b: number, a = 255) =>
  ({ data: new Uint8ClampedArray([r, g, b, a]), width: 1, height: 1 }) as ImageData;

test("identity processing returns the same object", () => {
  const src = px(10, 20, 30);
  assert.equal(isIdentityProcessing(IDENTITY), true);
  assert.equal(applyProcessingToImageData(src, IDENTITY), src);
});

test("brightness, contrast and flipSign follow applyDisplayAdjust1", () => {
  const out = applyProcessingToImageData(px(128, 128, 128), { ...IDENTITY, brightness: 0.5 });
  assert.equal(out.data[0], 192); // 128/255*1.5 = 0.7529 -> 192
  const inv = applyProcessingToImageData(px(0, 255, 100), { ...IDENTITY, flipSign: true });
  assert.deepEqual([...inv.data.slice(0, 3)], [255, 0, 155]);
  const con = applyProcessingToImageData(px(255, 0, 128), { ...IDENTITY, contrast: 1 });
  assert.deepEqual([...con.data.slice(0, 3)], [255, 0, 128]); // (x-0.5)*2+0.5 clamps at the ends, 128 stays ~128
});

test("gamma and offset follow feComponentTransfer gamma (amplitude 1, exponent 1/gamma)", () => {
  const out = applyProcessingToImageData(px(64, 64, 64), { ...IDENTITY, gamma: 2, offset: 0.1 });
  const expected = Math.round(255 * (Math.pow(64 / 255, 1 / 2) + 0.1));
  assert.equal(out.data[0], expected);
  assert.equal(out.data[3], 255);
});

test("exposure folds into the brightness gain, alpha passes through", () => {
  const out = applyProcessingToImageData(px(60, 60, 60, 128), { ...IDENTITY, exposure: 1 });
  assert.equal(out.data[0], 120);
  assert.equal(out.data[3], 128);
  assert.equal(out.width, 1);
  assert.equal(out.height, 1);
});
