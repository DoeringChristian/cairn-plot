// node --experimental-strip-types --test
// Selector decode coverage: `decodeExrBuffer(buffer, {part, layer})` against
// the constant-valued fixtures (layers-aov: channel i = (i+1)/16 with the file
// storing channels name-sorted A,B,G,R,Z,diffuse.B,.G,.R,specular.B,.G,.R;
// multipart-2part: beauty R/G/B = .1/.2/.3, aux Z = 7.5, mask = 1).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeExrBuffer } from "./exr-full.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (n: string): ArrayBuffer => {
  const b = readFileSync(join(FIXTURES, n));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
// half(1/16 · k) is exact for these k, so strict equality is safe.
const px = (d: Float32Array, ch: number, i = 0) => d[i * ch]!;

test("no selection: legacy default (base RGBA of part 0) unchanged", () => {
  const img = decodeExrBuffer(load("layers-aov-64x48.exr"));
  assert.equal(img.channels, 4);
  assert.equal(img.width, 64);
  // Base R=1/16, G=2/16, B=3/16, A=4/16 (constants).
  assert.deepEqual(Array.from(img.data.subarray(0, 4)), [1 / 16, 2 / 16, 3 / 16, 4 / 16]);
});

test("layer selection: diffuse group decodes its three planes in RGB order", () => {
  const img = decodeExrBuffer(load("layers-aov-64x48.exr"), { layer: "diffuse" });
  assert.equal(img.channels, 3);
  assert.deepEqual(Array.from(img.data.subarray(0, 3)), [5 / 16, 6 / 16, 7 / 16]);
  // Constant across the image (spot-check a far pixel).
  const last = (img.width * img.height - 1) * 3;
  assert.equal(img.data[last]!, 5 / 16);
});

test("single-channel selection: a FULL channel name isolates one scalar plane", () => {
  const g = decodeExrBuffer(load("layers-aov-64x48.exr"), { layer: "diffuse.G" });
  assert.equal(g.channels, 1);
  assert.equal(px(g.data, 1), 6 / 16);
  const z = decodeExrBuffer(load("layers-aov-64x48.exr"), { layer: "Z" });
  assert.equal(z.channels, 1);
  assert.equal(px(z.data, 1), 11 / 16);
});

test("part selection by name + index (multi-part)", () => {
  const beauty = decodeExrBuffer(load("multipart-2part-64x48.exr"), { part: "beauty" });
  assert.equal(beauty.channels, 3);
  const [r, g, b] = Array.from(beauty.data.subarray(0, 3));
  // 0.1/0.2/0.3 round-trip through half — compare with tolerance.
  assert.ok(Math.abs(r! - 0.1) < 1e-3 && Math.abs(g! - 0.2) < 1e-3 && Math.abs(b! - 0.3) < 1e-3);

  const z = decodeExrBuffer(load("multipart-2part-64x48.exr"), { part: 1, layer: "Z" });
  assert.equal(z.channels, 1);
  assert.equal(px(z.data, 1), 7.5); // FLOAT channel — exact
  const mask = decodeExrBuffer(load("multipart-2part-64x48.exr"), { part: "aux", layer: "mask" });
  assert.equal(px(mask.data, 1), 1);
});

test("selector misses throw with the available names", () => {
  assert.throws(
    () => decodeExrBuffer(load("multipart-2part-64x48.exr"), { part: "nope" }),
    /beauty, aux/,
  );
  assert.throws(
    () => decodeExrBuffer(load("layers-aov-64x48.exr"), { layer: "albedo" }),
    /no channel group or channel named "albedo"/,
  );
});

test("selection on a deep part is rejected explicitly", () => {
  assert.throws(
    () => decodeExrBuffer(load("deep-rgba-32x32.exr"), { layer: "Z" }),
    /DEEP parts is not supported/,
  );
});

test("ARBITRARY COMBO: up to 3 full channel names pack into R,G,B slots", () => {
  // diffuse.R=5/16, specular.G=9/16, Z=11/16 (constants — see fixture doc).
  const img = decodeExrBuffer(load("layers-aov-64x48.exr"), {
    layer: ["diffuse.R", "specular.G", "Z"],
  });
  assert.equal(img.channels, 3);
  assert.deepEqual(Array.from(img.data.subarray(0, 3)), [5 / 16, 9 / 16, 11 / 16]);
});

test("combo validation: >3 channels and unknown names throw", () => {
  assert.throws(
    () => decodeExrBuffer(load("layers-aov-64x48.exr"), { layer: ["R", "G", "B", "A"] }),
    /1\.\.3 channels/,
  );
  assert.throws(
    () => decodeExrBuffer(load("layers-aov-64x48.exr"), { layer: ["R", "nope"] }),
    /no channel named "nope"/,
  );
});
