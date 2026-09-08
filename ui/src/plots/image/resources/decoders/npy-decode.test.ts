import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeNpyBytes, npyPayloadToImage } from "./npy-decode.ts";

function npyFloat32(width: number, height: number, values: number[]): ArrayBuffer {
  const header = `{'descr': '<f4', 'fortran_order': False, 'shape': (${height}, ${width}), }`;
  const pad = 64 - ((10 + header.length + 1) % 64);
  const text = header + " ".repeat(pad) + "\n";
  const buf = new ArrayBuffer(10 + text.length + values.length * 4);
  const u8 = new Uint8Array(buf);
  u8.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]);
  new DataView(buf).setUint16(8, text.length, true);
  for (let i = 0; i < text.length; i++) u8[10 + i] = text.charCodeAt(i);
  new Float32Array(buf, 10 + text.length).set(values);
  return buf;
}

test("decodeNpyBytes decodes on the main thread when no Worker exists (node)", async () => {
  const img = await decodeNpyBytes(npyFloat32(2, 1, [0.25, 8]));
  assert.equal(img.kind, "f32");
  if (img.kind === "f32") { assert.deepEqual(Array.from(img.data as Float32Array), [0.25, 8]); assert.equal(img.width, 2); }
});

test("npyPayloadToImage reinterprets transferred buffers", () => {
  const f = npyPayloadToImage({ kind: "f32", data: Float32Array.from([1, 2]).buffer as ArrayBuffer, width: 2, height: 1, channels: 1, precision: "f32" });
  assert.equal(f.kind, "f32"); if (f.kind === "f32") assert.equal((f.data as Float32Array)[1], 2);
  const u = npyPayloadToImage({ kind: "u8", data: Uint8ClampedArray.from([9, 9, 9]).buffer as ArrayBuffer, width: 1, height: 1, channels: 3, precision: "f32" });
  assert.equal(u.kind, "u8"); if (u.kind === "u8") assert.equal((u.data as Uint8ClampedArray).length, 3);
});
