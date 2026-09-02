import test from "node:test";
import assert from "node:assert/strict";
import { ExpandedUploadCache } from "./expanded-upload-cache.ts";

const upload = (bytes: number) => ({
  width: bytes / 4,
  height: 1,
  format: "rgba8unorm" as const,
  data: new Uint8Array(bytes),
});

test("expanded uploads are shared by content identity with exact refs", () => {
  const cache = new ExpandedUploadCache(100);
  let builds = 0;
  const a = cache.acquire("artifact|rgba", () => { builds++; return upload(40); });
  const b = cache.acquire("artifact|rgba", () => { builds++; return upload(40); });
  assert.equal(builds, 1);
  assert.equal(a.upload, b.upload);
  assert.deepEqual(cache.snapshot(), { bytes: 40, entries: 1, refs: 2, overBudget: false });
  a.release();
  assert.equal(cache.snapshot().refs, 1);
  b.release();
});

test("expanded upload cache evicts zero-ref LRU by bytes but never referenced data", () => {
  const cache = new ExpandedUploadCache(50);
  const a = cache.acquire("a", () => upload(40));
  const b = cache.acquire("b", () => upload(40));
  assert.equal(cache.snapshot().bytes, 80);
  assert.equal(cache.snapshot().overBudget, true);
  a.release();
  assert.deepEqual(cache.snapshot(), { bytes: 40, entries: 1, refs: 1, overBudget: false });
  b.release();
});
