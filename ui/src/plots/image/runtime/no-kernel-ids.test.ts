/**
 * Kernel ids are a PRIVATE implementation detail of the WebGPU backend.
 *
 * The public vocabulary is the operation registry (`definition/image-operations.ts`):
 * `flip`, `flip-hdr`, `ssim`, … Historic internal kernel names (`hdr-flip`,
 * `flip-sdr`) must not leak into the shared runtime, the CPU backend, the
 * settings layer or the compare chrome — a source-text pin, because a leak is a
 * naming regression, not a behavioural one, and no unit test would catch it.
 *
 * Comments are stripped before matching: prose that *mentions* the old kernel
 * file names (`hdr-flip.ts`) is documentation, not a live identifier.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|__tests__|\.bundle\./.test(p)) out.push(p);
  }
  return out;
}

test("kernel identifiers stay private to the WebGPU backend", () => {
  const root = new URL("../", import.meta.url).pathname; // ui/src/plots/image
  for (const file of walk(root)) {
    if (file.includes("/webgpu/")) continue;
    const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(src, /"hdr-flip"|"flip-sdr"/, file);
  }
});
