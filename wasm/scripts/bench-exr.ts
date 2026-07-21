/**
 * Benchmark: the existing TS EXR decoder (ui/.../decoders/exr-full.ts) vs the
 * Rust→WASM decoder (inline base64 module), on the committed 64x48 PIZ fixture
 * and a bigger synthetic 1024x1024 PIZ file (generated on demand via the crate's
 * gen_fixture bin — it is >1MB so it is NOT committed).
 *
 * Run:  node --experimental-strip-types wasm/scripts/bench-exr.ts
 *
 * Reports decode wall-times (median of N), speedup, and output equivalence
 * (WASM half-bits expanded to f32, compared to the TS f32 output).
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { decodeExrBuffer } from "../../ui/src/lib/cairn-plot/image/decoders/exr-full.ts";
import { loadExrDecoder } from "../exr-decode/inline/wasm-exr-inline.ts";

const here = dirname(fileURLToPath(import.meta.url));
const crate = resolve(here, "../exr-decode");
const fixtures = resolve(here, "../../ui/src/lib/cairn-plot/image/decoders/fixtures");

function halfToF32(bits: number): number {
  const s = (bits & 0x8000) >> 15;
  const e = (bits & 0x7c00) >> 10;
  const f = bits & 0x03ff;
  let val: number;
  if (e === 0) val = (f / 1024) * Math.pow(2, -14);
  else if (e === 0x1f) val = f ? NaN : Infinity;
  else val = (1 + f / 1024) * Math.pow(2, e - 15);
  return s ? -val : val;
}

/** Generate the big synthetic PIZ fixture via the native crate bin if absent. */
function ensureBigFixture(): string {
  const outDir = resolve(crate, "target", "bench");
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, "rgb-piz-half-1024x1024.exr");
  if (!existsSync(out)) {
    console.log("generating 1024x1024 PIZ fixture via cargo gen_fixture ...");
    execFileSync(
      "cargo",
      ["run", "--release", "--quiet", "--bin", "gen_fixture", "--", out, "1024"],
      { cwd: crate, stdio: "inherit" },
    );
  }
  return out;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function timeIt(fn: () => void, iters: number): number {
  const ts: number[] = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn();
    ts.push(performance.now() - t0);
  }
  return median(ts);
}

interface Row {
  name: string;
  px: string;
  tsMs: number;
  wasmMs: number;
  speedup: number;
  maxDiff: number;
  mismatches: number;
}

async function benchOne(name: string, path: string): Promise<Row> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const u8 = new Uint8Array(buf);
  const { decode_exr } = await loadExrDecoder();

  // Warm up + correctness/equivalence check.
  const tsOut = decodeExrBuffer(ab);
  const wImg = decode_exr(u8);
  const wHalf = wImg.halfBits!;
  const width = wImg.width;
  const height = wImg.height;
  const ch = wImg.channels;

  let maxDiff = 0;
  let mismatches = 0;
  const n = width * height * ch;
  for (let i = 0; i < n; i++) {
    const w = halfToF32(wHalf[i]!);
    const t = tsOut.data[i]!;
    const d = Math.abs(w - t);
    if (d > maxDiff) maxDiff = d;
    if (d !== 0) mismatches++;
  }
  wImg.free();

  const bytes = buf.byteLength;
  const iters = bytes < 200_000 ? 100 : 15;
  const tsMs = timeIt(() => void decodeExrBuffer(ab), iters);
  const wasmMs = timeIt(() => decode_exr(u8).free(), iters);

  return {
    name,
    px: `${width}x${height}x${ch}`,
    tsMs,
    wasmMs,
    speedup: tsMs / wasmMs,
    maxDiff,
    mismatches,
  };
}

async function main() {
  const rows: Row[] = [];
  rows.push(await benchOne("rgb-piz-half-64x48", resolve(fixtures, "rgb-piz-half-64x48.exr")));
  rows.push(await benchOne("rgb-piz-half-1024x1024 (synthetic)", ensureBigFixture()));

  console.log("\nEXR decode benchmark (median ms, lower is better)\n");
  const head = ["fixture", "dims", "TS ms", "WASM ms", "speedup", "maxDiff", "mismatch"];
  const fmt = (r: Row) => [
    r.name,
    r.px,
    r.tsMs.toFixed(3),
    r.wasmMs.toFixed(3),
    `${r.speedup.toFixed(2)}x`,
    r.maxDiff.toExponential(1),
    String(r.mismatches),
  ];
  const table = [head, ...rows.map(fmt)];
  const widths = head.map((_, c) => Math.max(...table.map((row) => row[c]!.length)));
  for (const row of table) {
    console.log(row.map((cell, c) => cell.padEnd(widths[c]!)).join("  "));
  }
  console.log();
}

await main();
