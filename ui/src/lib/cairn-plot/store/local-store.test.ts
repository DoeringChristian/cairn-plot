/**
 * Round-trip tests for the LOCAL content store's deflate seam. No test runner
 * is configured in this package, so this runs under Node's built-in test runner
 * with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/viewport/local-store.test.ts
 *
 * `createLocalDataSource` is exercised with an EXPLICIT store (no `window`),
 * so this is DOM-free. `DecompressionStream`, `atob`, and `Response` are all
 * Node globals (18+), matching what the browser provides.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { createLocalDataSource, type PlotStoreEntry, type PlotStore } from "./local-store.ts";

/** base64 of a raw-DEFLATE (wbits -15) of `bytes` — mirrors the Python emitter
 *  (`cairn_plot.shapers._store_entry`, zlib wbits -15). */
function deflateEntry(bytes: Uint8Array, mime = "application/octet-stream"): PlotStoreEntry {
  const packed = deflateRawSync(bytes);
  return { mime, encoding: "deflate", b64: Buffer.from(packed).toString("base64") };
}

function rawEntry(bytes: Uint8Array, mime = "application/octet-stream"): PlotStoreEntry {
  return { mime, b64: Buffer.from(bytes).toString("base64") };
}

// A compressible f32-like payload (repeated gradient — what real HDR bytes are).
function sampleBytes(n = 4096): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 7) % 251;
  return out;
}

test("bytes() inflates a deflate-tagged entry back to the original", async () => {
  const original = sampleBytes();
  const store: PlotStore = { "sha256:x": deflateEntry(original) };
  const src = createLocalDataSource(store);
  const got = new Uint8Array(await src.bytes("sha256:x"));
  assert.deepEqual(got, original);
});

test("deflate shrinks a compressible payload", () => {
  const original = sampleBytes();
  const entry = deflateEntry(original);
  const packedLen = Buffer.from(entry.b64, "base64").length;
  assert.ok(packedLen < original.length, `deflated ${packedLen} < raw ${original.length}`);
});

test("bytes() returns a raw (untagged) entry verbatim — backward compat", async () => {
  const original = sampleBytes(64);
  const store: PlotStore = { "sha256:raw": rawEntry(original) };
  const src = createLocalDataSource(store);
  const got = new Uint8Array(await src.bytes("sha256:raw"));
  assert.deepEqual(got, original);
});

test("bytes() treats an explicit encoding:'raw' tag as raw", async () => {
  const original = sampleBytes(64);
  const store: PlotStore = {
    "sha256:r": { mime: "application/octet-stream", encoding: "raw", b64: Buffer.from(original).toString("base64") },
  };
  const got = new Uint8Array(await createLocalDataSource(store).bytes("sha256:r"));
  assert.deepEqual(got, original);
});

test("artifactUrl() serves a raw image entry as a data: URL", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const store: PlotStore = { "sha256:png": rawEntry(png, "image/png") };
  const url = createLocalDataSource(store).artifactUrl("sha256:png");
  assert.equal(url, `data:image/png;base64,${Buffer.from(png).toString("base64")}`);
});

test("artifactUrl() throws on a deflate-encoded entry (sync path can't inflate)", () => {
  const store: PlotStore = { "sha256:d": deflateEntry(sampleBytes(64)) };
  const src = createLocalDataSource(store);
  assert.throws(() => src.artifactUrl("sha256:d"), /deflate-encoded/);
});
