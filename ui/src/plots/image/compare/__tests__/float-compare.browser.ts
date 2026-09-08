/**
 * FLOAT COMPARE — the regression this page exists for.
 *
 * Cairn emits a compare operand as `{kind:"image", hash, format:"npy"}`. The
 * compare path used to resolve operands with a PRIVATE resolver that ignored
 * `data.format`, so a float `.npy` operand became a bare
 * `/api/artifacts/<hash>` URL, the browser could not `<img>`-decode it, and the
 * pane painted NOTHING — a blank checkerboard with no error anywhere.
 *
 * Now every operand goes through `resolveImageData`, the ONE image leaf
 * resolver, so `format` is honoured exactly as it is for a single-image leaf.
 * This page pins:
 *
 *   1. float × float SPLIT      → the pane paints.
 *   2. float × float DIFFERENCE → the pane paints.
 *   3. png   × float SPLIT      → the mixed pair paints.
 *   4. a REJECTED foreground hash → a VISIBLE failure surface, not a blank pane.
 *   5. EXR   × EXR   SPLIT      → a `format:"exr"` operand paints too. This is
 *      also the first compare case whose operands decode in a POOL WORKER (the
 *      npy operands above take the same route), so it covers the worker reply
 *      being reassembled back into a compare-ready image.
 *   6. EXR   × npy   DIFFERENCE → the SAME pixels, widened out of the EXR's
 *      half bits and re-encoded as float32 `.npy`, differenced against their
 *      own source. A correct answer is ZERO, i.e. BLACK — which `isBlank`
 *      cannot tell apart from "nothing painted", so this case probes ALPHA
 *      (255 = the pane painted) plus RGB ≈ 0 (the difference really is zero).
 *
 * Run under forced `cpu`, then again under `gpu` when the host has WebGPU.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import CpuImagePane from "../../cpu/view.tsx";
import GpuImagePane from "../../webgpu/view.tsx";
import { comparisonMenuOptions } from "../../runtime/comparison-menu.ts";
import { CPU_CAPABILITIES } from "../../cpu/capabilities.ts";
import { resolveImageComparisonPair } from "../../resources/comparison-resolve.ts";
import { decodeImage } from "../../resources/decoders.ts";
import { halfToFloat } from "../../runtime/half.ts";
import type { DataSource } from "../../../../resources/data/data-source.ts";
import type { ImageSource } from "../../definition/content.ts";
import { createHarness, waitFor } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "FLOAT-COMPARE" });

const W = 64;
const H = 64;
const C = 3;

/**
 * The minimal `.npy` v1.0 encoder. Magic `\x93NUMPY`, version 1.0, a 2-byte
 * little-endian header length, then the dict padded with spaces so the TOTAL
 * (10 + len) is 16-byte aligned and the header ends in `\n`.
 */
function encodeNpy(data: Float32Array, shape: number[]): ArrayBuffer {
  const dict = `{'descr': '<f4', 'fortran_order': False, 'shape': (${shape.join(", ")},), }`;
  let headerLen = dict.length + 1; // the trailing "\n"
  const pad = (16 - ((10 + headerLen) % 16)) % 16;
  headerLen += pad;
  const header = dict + " ".repeat(pad) + "\n";
  const buffer = new ArrayBuffer(10 + headerLen + data.byteLength);
  const bytes = new Uint8Array(buffer);
  const magic = "\x93NUMPY";
  for (let i = 0; i < magic.length; i++) bytes[i] = magic.charCodeAt(i);
  bytes[6] = 1;
  bytes[7] = 0;
  new DataView(buffer).setUint16(8, headerLen, true);
  for (let i = 0; i < header.length; i++) bytes[10 + i] = header.charCodeAt(i);
  new Uint8Array(data.buffer, data.byteOffset, data.byteLength).forEach((b, i) => {
    bytes[10 + headerLen + i] = b;
  });
  return buffer;
}

/** Two DISTINCT float fields, so a difference is not identically zero. */
function floatField(phase: number): Float32Array {
  const out = new Float32Array(W * H * C);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const b = (y * W + x) * C;
      out[b] = (x + phase * 8) / W;
      out[b + 1] = y / H;
      out[b + 2] = 0.25 + 0.5 * phase;
    }
  }
  return out;
}

/** A 64×64 PNG data URL. */
function pngDataUrl(): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#204080");
  grad.addColorStop(1, "#e0a020");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  return c.toDataURL("image/png");
}

const NPY_A = encodeNpy(floatField(0), [H, W, C]);
const NPY_B = encodeNpy(floatField(1), [H, W, C]);
const PNG_URL = pngDataUrl();

/** A committed 64x48 half-float EXR — the `format:"exr"` compare operand. */
const EXR_URL = new URL(
  "../../resources/decoders/fixtures/rgb-piz-half-64x48.exr",
  import.meta.url,
).href;
/** Filled by `loadExrOperands()` before any case mounts. */
let EXR_A: ArrayBuffer | null = null;
/** The SAME pixels as `EXR_A`, widened to f32 and re-encoded as `.npy`. */
let NPY_FROM_EXR: ArrayBuffer | null = null;

/**
 * Fetch the EXR fixture and derive its `.npy` twin. The twin is built by
 * decoding the EXR (through the decode worker pool, like any other EXR) and
 * widening its half BIT PATTERNS to float — so the two operands hold
 * bit-identical values and case 6's difference is exactly zero.
 */
async function loadExrOperands(): Promise<void> {
  const res = await fetch(EXR_URL);
  if (!res.ok) throw new Error(`EXR fixture → HTTP ${res.status}`);
  EXR_A = await res.arrayBuffer();
  const decoded = await decodeImage({ bytes: EXR_A, ext: "exr" });
  if (decoded.kind !== "f32") throw new Error(`EXR fixture decoded to ${decoded.kind}, expected f32`);
  const wide =
    decoded.data instanceof Uint16Array
      ? Float32Array.from(decoded.data, (h) => halfToFloat(h))
      : new Float32Array(decoded.data);
  NPY_FROM_EXR = encodeNpy(wide, [decoded.height, decoded.width, decoded.channels]);
}

/** The host's artifact store: two float `.npy` blobs, one PNG, one bad hash. */
const source: DataSource = {
  artifactUrl(hash: string): string {
    if (hash === "png") return PNG_URL;
    return `/api/artifacts/${hash}`;
  },
  async bytes(hash: string): Promise<ArrayBuffer> {
    if (hash === "npyA") return NPY_A;
    if (hash === "npyB") return NPY_B;
    if (hash === "exrA" && EXR_A) return EXR_A;
    if (hash === "npyFromExr" && NPY_FROM_EXR) return NPY_FROM_EXR;
    throw new Error(`no artifact ${hash}`);
  },
};

/**
 * The mount point for one case. The page ships four `<div>`s; the EXR cases
 * create their own so the `.html` stays a plain four-slot page.
 */
function host(id: string): HTMLElement {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    (document.getElementById("mounts") ?? document.body).appendChild(el);
  }
  el.style.cssText = "width:280px;height:200px;position:relative;background:#222";
  return el;
}

/** Centre-pixel readback of the ONE presentation canvas — the paint probe. */
function paintedCentre(hostId: string): Uint8ClampedArray | undefined {
  const canvas = document
    .getElementById(hostId)
    ?.querySelector<HTMLCanvasElement>("canvas[data-cpu-image-canvas]");
  if (!canvas || canvas.width === 0 || canvas.height === 0) return undefined;
  return canvas
    .getContext("2d")
    ?.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
}

function isBlank(px: Uint8ClampedArray | undefined): boolean {
  return !px || px[3] === 0;
}

/**
 * Under `gpu` the presentation canvas is a WebGPU one: `paintedCentre` (a 2D
 * `getImageData`) can never read it, so every wait below would otherwise spin
 * out its full budget before the `gpuOk` branch decided the verdict — six
 * cases x 15 s overruns the runner's per-page timeout. A sized GPU canvas is
 * the positive signal that ends the wait early; it changes no verdict (the
 * `gpuOk` branch still decides), it only stops waiting for something that
 * cannot happen.
 */
function gpuCanvasReady(hostId: string): boolean {
  const c = document
    .getElementById(hostId)
    ?.querySelector<HTMLCanvasElement>("canvas[data-gpu-image-canvas]");
  return !!c && c.width > 0 && c.height > 0;
}

function unavailableText(hostId: string): string {
  const el = document.getElementById(hostId);
  const box = el?.querySelector("[data-cpu-image-error]") ?? el?.querySelector("[data-gpu-image-error]");
  return box?.textContent ?? "";
}

/** Exactly the nodes cairn emits for a compare. */
const NODE_NPY_A = { kind: "image", hash: "npyA", format: "npy" } as const;
const NODE_NPY_B = { kind: "image", hash: "npyB", format: "npy" } as const;
const NODE_PNG = { kind: "image", hash: "png" } as const;
const NODE_MISSING = { kind: "image", hash: "missing", format: "npy" } as const;
const NODE_EXR_A = { kind: "image", hash: "exrA", format: "exr" } as const;
const NODE_NPY_FROM_EXR = { kind: "image", hash: "npyFromExr", format: "npy" } as const;

interface Case {
  id: string;
  reference: unknown;
  foreground: unknown;
  presentation: "split" | "difference";
  settings?: Record<string, string>;
}

const CASES: Case[] = [
  { id: "m1", reference: NODE_NPY_A, foreground: NODE_NPY_B, presentation: "split" },
  {
    id: "m2",
    reference: NODE_NPY_A,
    foreground: NODE_NPY_B,
    presentation: "difference",
    settings: { "compare.operation": "absolute" },
  },
  { id: "m3", reference: NODE_PNG, foreground: NODE_NPY_B, presentation: "split" },
  { id: "m4", reference: NODE_NPY_A, foreground: NODE_MISSING, presentation: "split" },
  { id: "m5", reference: NODE_EXR_A, foreground: NODE_EXR_A, presentation: "split" },
  {
    id: "m6",
    reference: NODE_EXR_A,
    foreground: NODE_NPY_FROM_EXR,
    presentation: "difference",
    settings: { "compare.operation": "absolute" },
  },
];

async function mountCase(
  c: Case,
  Pane: typeof CpuImagePane | typeof GpuImagePane,
  roots: Root[],
): Promise<string | null> {
  let resolved: Record<string, unknown>;
  try {
    resolved = await resolveImageComparisonPair(
      c.reference as never,
      c.foreground as never,
      source,
    );
  } catch (err) {
    // The resolver itself rejected the operand: the surface must SAY so — the
    // pane can only render what it was given, so the host renders the error.
    const el = host(c.id);
    el.innerHTML = `<div data-cpu-image-error="">Image unavailable — ${
      err instanceof Error ? err.message : String(err)
    }</div>`;
    return err instanceof Error ? err.message : String(err);
  }
  const root = createRoot(host(c.id));
  root.render(
    createElement(Pane as never, {
      source: resolved.source as ImageSource,
      compareSource: {
        b: resolved.__diffB as ImageSource,
        operationId: c.settings?.["compare.operation"] ?? "absolute",
        operationOptions: comparisonMenuOptions(CPU_CAPABILITIES),
        mode: c.presentation === "split" ? "split" : "diff",
        referenceLabel: "reference",
        foregroundLabel: "foreground",
      },
      label: "",
    } as never),
  );
  roots.push(root);
  return null;
}

async function runMode(mode: "cpu" | "gpu"): Promise<boolean> {
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = mode;
  const roots: Root[] = [];
  const failures = new Map<string, string | null>();
  for (const c of CASES) {
    host(c.id).innerHTML = "";
    failures.set(c.id, await mountCase(c, mode === "cpu" ? CpuImagePane : GpuImagePane, roots));
  }

  let ok = true;
  // 1-3: the three RESOLVABLE pairs must PAINT. Under `gpu` the presentation
  // canvas is the GPU one, so "painted" is probed by the pane having produced a
  // non-blank surface OR (GPU path) by the pane never showing the error box.
  const settled = (id: string) => (): boolean =>
    !isBlank(paintedCentre(id)) || (mode === "gpu" && gpuCanvasReady(id));
  for (const id of ["m1", "m2", "m3"]) {
    const resolveError = failures.get(id);
    await waitFor(settled(id), 15_000, 50);
    const painted = !isBlank(paintedCentre(id));
    const gpuOk = mode === "gpu" && !resolveError && unavailableText(id) === "";
    const pass = !resolveError && (painted || gpuOk);
    report(
      pass,
      `[${mode}] ${id} → the compare pane paints (resolve ${
        resolveError ?? "ok"
      }, centre ${JSON.stringify(paintedCentre(id) ? [...paintedCentre(id)!] : null)})`,
    );
    ok = ok && pass;
  }

  // 4: a rejected foreground is a VISIBLE failure, never a blank pane.
  const shown = await waitFor(() => /unavailable/i.test(unavailableText("m4")), 15_000, 50);
  report(shown, `[${mode}] m4 → a rejected operand surfaces a visible failure ("${unavailableText("m4").slice(0, 80)}")`);
  ok = ok && shown;

  // 5: a `format:"exr"` operand (decoded in a pool worker) paints like any
  // other. Same probe as 1-3, plus ALPHA: the split view is real image content,
  // so an opaque centre pixel is the honest "it painted" signal.
  {
    const resolveError = failures.get("m5");
    await waitFor(settled("m5"), 15_000, 50);
    const painted = !isBlank(paintedCentre("m5"));
    const px = paintedCentre("m5");
    const gpuOk = mode === "gpu" && !resolveError && unavailableText("m5") === "";
    const pass = !resolveError && (gpuOk || (painted && px?.[3] === 255));
    report(
      pass,
      `[${mode}] m5 → EXR × EXR split paints (resolve ${resolveError ?? "ok"}, centre ${
        JSON.stringify(px ? [...px] : null)
      })`,
    );
    ok = ok && pass;
  }

  // 6: EXR differenced against its OWN pixels re-encoded as float32 `.npy`.
  // The right answer is zero — i.e. BLACK — which `isBlank` reads as "nothing
  // painted", so alpha is the paint probe and RGB is the correctness probe.
  {
    const resolveError = failures.get("m6");
    await waitFor(
      () => paintedCentre("m6")?.[3] === 255 || (mode === "gpu" && gpuCanvasReady("m6")),
      15_000,
      50,
    );
    const px = paintedCentre("m6");
    const opaque = px?.[3] === 255;
    const zero = !!px && px[0]! <= 1 && px[1]! <= 1 && px[2]! <= 1;
    const gpuOk = mode === "gpu" && !resolveError && unavailableText("m6") === "";
    const pass = !resolveError && (gpuOk || (opaque && zero));
    report(
      pass,
      `[${mode}] m6 → EXR × (same pixels as npy) difference paints an opaque BLACK centre (resolve ${
        resolveError ?? "ok"
      }, centre ${JSON.stringify(px ? [...px] : null)})`,
    );
    ok = ok && pass;
  }

  roots.forEach((r) => r.unmount());
  return ok;
}

async function run(): Promise<boolean> {
  await loadExrOperands();
  let ok = await runMode("cpu");
  if ((navigator as unknown as { gpu?: unknown }).gpu) {
    ok = (await runMode("gpu")) && ok;
  } else {
    report(true, "no navigator.gpu — the GPU pass is skipped on this host");
  }
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
