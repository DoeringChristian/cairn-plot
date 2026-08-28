// node --experimental-strip-types --test
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describeExr, resolvePartIndex } from "./exr-describe.ts";
import { groupChannels, resolveGroup } from "../../definition/channel-groups.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (n: string): ArrayBuffer => {
  const b = readFileSync(join(FIXTURES, n));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

test("single-part RGB file: one part, three channels, not deep", () => {
  const d = describeExr(load("rgb-zip-half-64x48.exr"));
  assert.equal(d.multiPart, false);
  assert.equal(d.parts.length, 1);
  const p = d.parts[0]!;
  assert.equal(p.width, 64);
  assert.equal(p.height, 48);
  assert.equal(p.deep, false);
  assert.deepEqual(p.channels.map((c) => c.name).sort(), ["B", "G", "R"]);
});

test("layered AOV file: all 11 channels described", () => {
  const d = describeExr(load("layers-aov-64x48.exr"));
  assert.equal(d.parts.length, 1);
  const names = d.parts[0]!.channels.map((c) => c.name);
  assert.equal(names.length, 11);
  for (const n of ["R", "G", "B", "A", "diffuse.R", "specular.B", "Z"]) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
});

test("multi-part file: two named parts with their own channels", () => {
  const d = describeExr(load("multipart-2part-64x48.exr"));
  assert.equal(d.multiPart, true);
  assert.equal(d.parts.length, 2);
  assert.equal(d.parts[0]!.name, "beauty");
  assert.equal(d.parts[1]!.name, "aux");
  assert.deepEqual(d.parts[0]!.channels.map((c) => c.name).sort(), ["B", "G", "R"]);
  assert.deepEqual(d.parts[1]!.channels.map((c) => c.name).sort(), ["Z", "mask"]);
  assert.equal(d.parts[1]!.deep, false);
  // Part selection: by index, by name, and a helpful error on a miss.
  assert.equal(resolvePartIndex(d, undefined), 0);
  assert.equal(resolvePartIndex(d, 1), 1);
  assert.equal(resolvePartIndex(d, "aux"), 1);
  assert.throws(() => resolvePartIndex(d, "nope"), /beauty, aux/);
  assert.throws(() => resolvePartIndex(d, 5), /out of range/);
});

test("deep file: deep flag set from the version bit", () => {
  const d = describeExr(load("deep-rgba-32x32.exr"));
  assert.equal(d.parts[0]!.deep, true);
});

test("non-EXR bytes throw", () => {
  assert.throws(() => describeExr(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer), /bad magic/);
});

test("groupChannels: layered AOV groups as tev would", () => {
  const d = describeExr(load("layers-aov-64x48.exr"));
  const groups = groupChannels(d.parts[0]!.channels);
  const byName = new Map(groups.map((g) => [g.name, g]));
  // Default RGBA color group first.
  assert.equal(groups[0]!.name, "");
  assert.equal(groups[0]!.kind, "color");
  assert.deepEqual(groups[0]!.channels, ["R", "G", "B", "A"]);
  assert.deepEqual(byName.get("diffuse")?.channels, ["diffuse.R", "diffuse.G", "diffuse.B"]);
  assert.deepEqual(byName.get("specular")?.channels, ["specular.R", "specular.G", "specular.B"]);
  assert.deepEqual(byName.get("Z"), { name: "Z", kind: "scalar", channels: ["Z"] });
});

test("groupChannels: XY(Z) sets form a color group; odd sets become scalars", () => {
  const groups = groupChannels(["normal.X", "normal.Y", "normal.Z", "id", "crypto.00"]);
  const byName = new Map(groups.map((g) => [g.name, g]));
  assert.deepEqual(byName.get("normal")?.channels, ["normal.X", "normal.Y", "normal.Z"]);
  assert.equal(byName.get("normal")?.kind, "color");
  assert.deepEqual(byName.get("id"), { name: "id", kind: "scalar", channels: ["id"] });
  assert.deepEqual(byName.get("crypto.00"), { name: "crypto.00", kind: "scalar", channels: ["crypto.00"] });
});

test("resolveGroup: group name, full channel name, default, and a helpful miss", () => {
  const d = describeExr(load("layers-aov-64x48.exr"));
  const groups = groupChannels(d.parts[0]!.channels);
  assert.equal(resolveGroup(groups, undefined).name, "");
  assert.equal(resolveGroup(groups, "diffuse").kind, "color");
  // A FULL channel name isolates that channel as a scalar view.
  const single = resolveGroup(groups, "diffuse.G");
  assert.deepEqual(single, { name: "diffuse.G", kind: "scalar", channels: ["diffuse.G"] });
  assert.throws(() => resolveGroup(groups, "beauty"), /available: \(default\).*diffuse.*specular/);
});
