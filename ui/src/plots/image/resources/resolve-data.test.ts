import test from "node:test";
import assert from "node:assert/strict";
import { resolveImageData } from "./resolve-data.ts";
import type { DataSource } from "../../../resources/data/data-source.ts";
import type { DataSpec } from "../../../../../packages/spec/src/spec.ts";

const source: DataSource = {
  artifactUrl: (hash) => `https://artifacts.invalid/${hash}.png`,
  bytes: async () => new ArrayBuffer(0),
};

test("ordinary immutable artifact images carry stable shareable content keys", async () => {
  const data = { kind: "image", hash: "sha256:abc" } as Extract<DataSpec, { kind: "image" }>;
  const a = await resolveImageData(data, source);
  const b = await resolveImageData({ ...data }, source);
  assert.equal((a.source as { contentKey?: string }).contentKey, "image:sha256:abc|part:|layer:");
  assert.equal(
    (a.source as { contentKey?: string }).contentKey,
    (b.source as { contentKey?: string }).contentKey,
  );
});
