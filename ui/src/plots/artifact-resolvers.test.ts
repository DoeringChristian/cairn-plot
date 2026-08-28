/**
 * Adapter float-resolution unit tests — the HDR seam that lets a host hand the
 * viewport adapter an `.exr` / float-`.npy` artifact and get a decoded
 * `CompareFloatSource` (true-HDR panes/compare) instead of an LDR URL.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/viewport/data-sources.test.ts
 *
 * DOM-free: the float branch never touches a canvas (the u8 → `data:` URL path
 * needs a DOM and is exercised only in the browser). EXR fixtures are the
 * repo's committed `image/decoders/fixtures/*.exr`; float `.npy` buffers are
 * built in-process by `makeF32Npy`.
 */
import { test } from "node:test";
import { floatPixelsLength } from "./image/runtime/pixel-buffer.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  decodeImageSource,
  decodedFloatToCompareSource,
  isFloatCandidateArtifact,
  resolveImageArtifactsAsync,
} from "./artifact-resolvers.ts";
import {
  createEndpointDataSource,
  type DataSource,
} from "../resources/data/data-source.ts";

test("createEndpointDataSource uses the host fetch implementation", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const payload = new Uint8Array([1, 2, 3]);
  const source = createEndpointDataSource(
    (hash) => `/artifacts/${hash}`,
    {
      requestInit: { headers: { Authorization: "Bearer test" } },
      fetch: async (input, init) => {
        calls.push({ url: String(input), init });
        return new Response(payload);
      },
    },
  );

  assert.deepEqual(new Uint8Array(await source.bytes("abc")), payload);
  assert.equal(calls[0]?.url, "/artifacts/abc");
  assert.deepEqual(calls[0]?.init, { headers: { Authorization: "Bearer test" } });
});

// ---------------------------------------------------------------------------
// A minimal `.npy` v1.0 encoder (float32) for building test buffers, mirroring
// `image/decoders.test.ts`'s `makeNpy`.
// ---------------------------------------------------------------------------
function makeF32Npy(shape: number[], values: number[]): ArrayBuffer {
  const descr = "<f4";
  const shapeStr = shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(", ")})`;
  let header = `{'descr': '${descr}', 'fortran_order': False, 'shape': ${shapeStr}, }`;
  const preamble = 6 + 2 + 2;
  const total = preamble + header.length + 1;
  const pad = (64 - (total % 64)) % 64;
  header = header + " ".repeat(pad) + "\n";
  const dataBytes = values.length * 4;
  const buf = new ArrayBuffer(preamble + header.length + dataBytes);
  const bytes = new Uint8Array(buf);
  [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59].forEach((b, i) => (bytes[i] = b));
  bytes[6] = 1;
  bytes[7] = 0;
  const dv = new DataView(buf);
  dv.setUint16(8, header.length, true);
  for (let i = 0; i < header.length; i++) bytes[10 + i] = header.charCodeAt(i);
  const dataView = new DataView(buf, preamble + header.length);
  values.forEach((v, i) => dataView.setFloat32(i * 4, v, true));
  return buf;
}

function readFixture(name: string): ArrayBuffer {
  const bytes = readFileSync(
    new URL(`./image/resources/decoders/fixtures/${name}`, import.meta.url),
  );
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

// ---------------------------------------------------------------------------
// isFloatCandidateArtifact — the detection gate.
// ---------------------------------------------------------------------------
test("isFloatCandidateArtifact: raw-buffer formats (exr/npy/npz) are candidates", () => {
  assert.ok(isFloatCandidateArtifact({ url: "/api/artifacts/h", mime: "image/x-exr" }));
  assert.ok(isFloatCandidateArtifact({ url: "frame.exr" }));
  assert.ok(isFloatCandidateArtifact({ url: "arr.npy" }));
  assert.ok(isFloatCandidateArtifact({ url: "arr.npz" }));
});

test("isFloatCandidateArtifact: browser-native + extension-less URLs are NOT candidates", () => {
  assert.equal(isFloatCandidateArtifact({ url: "/api/artifacts/h", mime: "image/png" }), false);
  assert.equal(isFloatCandidateArtifact({ url: "pic.jpg" }), false);
  // Extension-less, no mime (the app's `api.artifactUrl`) → left on the <img> path.
  assert.equal(isFloatCandidateArtifact({ url: "/api/artifacts/h" }), false);
});

// ---------------------------------------------------------------------------
// decodedFloatToCompareSource — the pure DecodedImage → CompareFloatSource map.
// ---------------------------------------------------------------------------
test("decodedFloatToCompareSource carries dims/channels/precision + content key", () => {
  const src = decodedFloatToCompareSource(
    { kind: "f32", data: new Float32Array([1, 2, 3, 4]), width: 2, height: 2, channels: 1, precision: "f32" },
    "content-key-1",
  );
  assert.equal(src.width, 2);
  assert.equal(src.height, 2);
  assert.equal(src.channels, 1);
  assert.equal(src.pixels.kind, "values"); // self-describing buffer (pixel-buffer.ts)
  assert.equal(src.contentKey, "content-key-1");
  assert.equal(floatPixelsLength(src.pixels), 4);
});

// ---------------------------------------------------------------------------
// decodeImageSource — fetch-less decode (bytes provided) → float source.
// ---------------------------------------------------------------------------
test("decodeImageSource: a float .npy decodes to a CompareFloatSource (url null)", async () => {
  const bytes = makeF32Npy([2, 3], [0, 0.5, 1, 1.5, 2, 2.5]);
  const r = await decodeImageSource({ url: "grad.npy", bytes });
  assert.equal(r.url, null);
  assert.ok(r.float, "float source present");
  assert.equal(r.float!.width, 3);
  assert.equal(r.float!.height, 2);
  assert.equal(r.float!.channels, 1);
  assert.equal(r.float!.pixels.kind, "values");
  // Content key is the source url when bytes are supplied (no redirect).
  assert.equal(r.float!.contentKey, "grad.npy");
});

test("decodeImageSource: a committed EXR fixture decodes to a float source", async () => {
  const r = await decodeImageSource({
    url: "rgb.exr",
    bytes: readFixture("rgb-zip-half-64x48.exr"),
    mime: "image/x-exr",
  });
  assert.equal(r.url, null);
  assert.ok(r.float);
  assert.equal(r.float!.width, 64);
  assert.equal(r.float!.height, 48);
  assert.equal(r.float!.channels, 3);
  // A half EXR keeps half precision through to the rgba16float upload — the
  // SELF-DESCRIBING buffer carries the representation with the bytes.
  assert.equal(r.float!.pixels.kind, "f16-bits");
});

// ---------------------------------------------------------------------------
// resolveImageArtifactsAsync — the adapter resolver end to end.
// ---------------------------------------------------------------------------
function fakeSource(bytesByHash: Record<string, ArrayBuffer>): DataSource & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    artifactUrl: (h) => `/api/artifacts/${h}`,
    async bytes(h) {
      fetched.push(h);
      const b = bytesByHash[h];
      if (!b) throw new Error(`no bytes for ${h}`);
      return b;
    },
  };
}

test("resolveImageArtifactsAsync: an EXR foreground resolves to a float item", async () => {
  const source = fakeSource({ fg: readFixture("rgb-zip-half-64x48.exr") });
  const res = await resolveImageArtifactsAsync(
    { hashes: ["fg"], referenceHashes: [null], metadata: [null], mimes: ["image/x-exr"] },
    source,
    () => null,
  );
  const item = res.items[0]!;
  assert.equal(item.url, null, "float item has no browser URL");
  assert.ok(item.float, "float source attached to the item");
  assert.equal(item.float!.channels, 3);
  assert.equal(res.isLoading, false);
});

test("resolveImageArtifactsAsync: a float .npy reference resolves to a float item", async () => {
  const source = fakeSource({ ref: makeF32Npy([1, 2], [10, 20]) });
  const res = await resolveImageArtifactsAsync(
    { hashes: [null], referenceHashes: ["ref"], metadata: [null], referenceMimes: ["application/x-npy"] },
    source,
    () => null,
  );
  const ref = res.referenceItems[0]!;
  assert.equal(ref.url, null);
  assert.ok(ref.float);
  assert.equal(ref.float!.width, 2);
});

test("resolveImageArtifactsAsync: a PNG artifact passes through as a plain URL (no fetch)", async () => {
  const source = fakeSource({});
  const res = await resolveImageArtifactsAsync(
    { hashes: ["png"], referenceHashes: [null], metadata: [null], mimes: ["image/png"] },
    source,
    () => null,
  );
  const item = res.items[0]!;
  assert.equal(item.url, "/api/artifacts/png");
  assert.equal(item.float ?? null, null, "no float decode for a browser-native artifact");
  assert.deepEqual(source.fetched, [], "browser-native artifacts are never fetched/decoded");
});

test("resolveImageArtifactsAsync: a null hash stays null", async () => {
  const source = fakeSource({});
  const res = await resolveImageArtifactsAsync(
    { hashes: [null], referenceHashes: [null], metadata: [null] },
    source,
    () => null,
  );
  assert.equal(res.items[0], null);
  assert.equal(res.referenceItems[0], null);
});
