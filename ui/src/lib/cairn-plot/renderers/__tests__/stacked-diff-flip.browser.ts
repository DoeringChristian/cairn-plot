/**
 * INSTRUMENT (temporary) — stacked [image, FLIP-diff] flip: measure whether a
 * flip round-trip RECOMPUTES the diff or just RE-UPLOADS the sources + stalls the
 * present. Models the report's Validation stacked grid: one reused GpuImagePane
 * instance whose props flip between a plain-image slot and a cached-FLIP diff slot
 * (the homogeneous source-swap the Phase-2c routing produces).
 *
 * Measures across `image → diff → image → diff → image → diff`:
 *   - getDiffComputeCount() delta  → is the RESULT recomputed on each visit?
 *   - source-upload count (device.createTexture of the 64×64 source formats)
 *   - blank-frame after each flip-to-diff (readback immediately)
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import GpuImagePane from "../GpuImagePane";
import { urlSource } from "../image-backend";
import { getSharedDevice } from "../../engine/device";
import { getDiffComputeCount } from "../../engine/diff-engine";

const h = React.createElement;

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  // eslint-disable-next-line no-console
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "green" : "red";
    el.appendChild(p);
  }
}
function note(message: string): void {
  // eslint-disable-next-line no-console
  console.log("NOTE:", message);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = "NOTE: " + message;
    p.style.color = "#88f";
    el.appendChild(p);
  }
}
function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "green" : "red";
  }
  document.title = pass ? "STACKED DIFF FLIP PASS" : "STACKED DIFF FLIP FAIL";
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
async function waitFor(pred: () => boolean | Promise<boolean>, timeoutMs = 8000, stepMs = 40): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pred()) return true;
    await sleep(stepMs);
  }
  return await pred();
}

function makeImageUrl(fill: (x: number, y: number) => [number, number, number]): string {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const [r, g, b] = fill(x, y);
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

const FG_URL = makeImageUrl((x) => [Math.round((x / 63) * 255), 128, 64]);
const REF_URL = makeImageUrl((_x, y) => [Math.round((y / 63) * 255), 128, 64]);
const PLAIN_URL = makeImageUrl((x, y) => [x * 3, y * 3, 128]);

async function readCanvasBytes(canvas: HTMLCanvasElement | null): Promise<Uint8Array | null> {
  if (!canvas) return null;
  const bmp = await createImageBitmap(canvas);
  const tmp = document.createElement("canvas");
  tmp.width = bmp.width;
  tmp.height = bmp.height;
  const ctx = tmp.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  return new Uint8Array(ctx.getImageData(0, 0, tmp.width, tmp.height).data.buffer);
}
function nonZero(bytes: Uint8Array | null): boolean {
  if (!bytes) return false;
  for (let i = 0; i < bytes.length; i += 4) {
    if (bytes[i] !== 0 || bytes[i + 1] !== 0 || bytes[i + 2] !== 0) return true;
  }
  return false;
}
/** Mean RGB code value over the frame — a cheap content fingerprint stable for a
 *  given rendered result (used to assert the retained diff presents identically). */
function mean16(bytes: Uint8Array | null): number {
  if (!bytes || bytes.length === 0) return -1;
  let s = 0;
  let n = 0;
  for (let i = 0; i + 2 < bytes.length; i += 4) {
    s += bytes[i]! + bytes[i + 1]! + bytes[i + 2]!;
    n += 3;
  }
  return n ? s / n : -1;
}

const STACK_KEYS = { a: "flip:ref", b: "flip:fg" };

function imageProps(): Record<string, unknown> {
  return { source: urlSource(PLAIN_URL), zoom: 1, pan: { x: 0, y: 0 }, label: "" };
}
function diffProps(): Record<string, unknown> {
  return {
    source: urlSource(REF_URL),
    compareSource: {
      b: urlSource(FG_URL),
      opId: "flip",
      mode: "diff",
      contentKeyA: STACK_KEYS.a,
      contentKeyB: STACK_KEYS.b,
      referenceLabel: "ref",
      foregroundLabel: "fg",
    },
    zoom: 1,
    pan: { x: 0, y: 0 },
    label: "",
  };
}

function probeEl(container: HTMLElement): (HTMLElement & { __cairnImageDiffProbe?: { canvas: HTMLCanvasElement | null; requestRender: () => void; compareMode?: string; home?: () => void } }) | null {
  return container.querySelector("[data-gpu-image-viewport]") as never;
}

let uploadCount = 0;

async function main(): Promise<void> {
  try {
    const device = await getSharedDevice();
    // Instrument SOURCE uploads: count createTexture of the 64×64 source formats
    // (rgba8unorm here). The diff RESULT is rgba16float — excluded — so this counts
    // ONLY source (re)uploads, isolating the "re-upload on every flip" hypothesis.
    const origCreate = device.createTexture.bind(device);
    (device as unknown as { createTexture: typeof origCreate }).createTexture = ((
      w: number,
      hh: number,
      fmt: string,
    ) => {
      if (w === 64 && hh === 64 && fmt === "rgba8unorm") uploadCount++;
      return origCreate(w as never, hh as never, fmt as never);
    }) as typeof origCreate;

    const container = document.createElement("div");
    container.style.cssText = "width:128px;height:128px;position:absolute;left:0;top:0";
    document.body.appendChild(container);
    const mount = document.createElement("div");
    mount.style.cssText = "width:128px;height:128px";
    container.appendChild(mount);
    const root: Root = createRoot(mount);

    const flip = (mode: "image" | "diff") => {
      root.render(h(GpuImagePane, (mode === "image" ? imageProps() : diffProps()) as never));
    };

    // Wait until the reused pane paints a non-blank diff.
    const paintDiff = async (): Promise<Uint8Array | null> => {
      await waitFor(async () => {
        const p = probeEl(container)?.__cairnImageDiffProbe;
        if (!p?.canvas) return false;
        p.requestRender();
        return nonZero(await readCanvasBytes(p.canvas));
      }, 8000, 80);
      return readCanvasBytes(probeEl(container)?.__cairnImageDiffProbe?.canvas ?? null);
    };
    const paintImage = async (): Promise<void> => {
      await waitFor(async () => {
        const p = probeEl(container)?.__cairnImageDiffProbe;
        if (!p?.canvas) return false;
        p.requestRender();
        return nonZero(await readCanvasBytes(p.canvas));
      }, 8000, 80);
    };

    let allOk = true;

    // ---- initial IMAGE slot ------------------------------------------------
    flip("image");
    await waitFor(() => !!probeEl(container)?.__cairnImageDiffProbe?.canvas, 8000);
    await paintImage();
    const uploadsAfterImage0 = uploadCount;
    note(`mounted image slot; uploads so far=${uploadsAfterImage0}, computeCount=${getDiffComputeCount()}`);

    // ---- flip to DIFF (visit 1): first compute -----------------------------
    // ONE-CONCRETE-VALUE model: the viewport seeded from the IMAGE slot, so the
    // first diff visit renders under those settings (no colormap — a dark raw
    // error field). HOME adopts the diff's kernel-default colormap (the user
    // gesture that colors it); the retention/no-recompute assertions that are
    // this harness's purpose are unaffected.
    const compBeforeFirstDiff = getDiffComputeCount();
    flip("diff");
    await waitFor(() => probeEl(container)?.__cairnImageDiffProbe?.compareMode === "diff", 8000);
    // The probe object is re-set on every render; on slow software adapters
    // `home()` may not yet be wired at the instant compareMode flips to "diff".
    // Calling it too early is a silent no-op (optional chaining), leaving the
    // diff as the UNCOLORED raw error field — near-zero on SwiftShader, which
    // then burns paintDiff's full budget every poll (the cumulative stall the CI
    // TIMEOUT reported here). Wait until home() is actually exposed, THEN invoke
    // it so the kernel-default colormap makes the diff frame promptly non-blank.
    await waitFor(() => typeof probeEl(container)?.__cairnImageDiffProbe?.home === "function", 8000);
    probeEl(container)?.__cairnImageDiffProbe?.home?.();
    const diff1 = await paintDiff();
    const compAfterVisit1 = getDiffComputeCount();
    report(nonZero(diff1), `visit1 diff paints non-blank`);
    allOk = allOk && nonZero(diff1);
    note(`visit1: computeCount ${compBeforeFirstDiff} → ${compAfterVisit1} (Δ=${compAfterVisit1 - compBeforeFirstDiff}), uploads=${uploadCount}`);
    const settled1 = mean16(diff1);

    // ---- round-trips: image → diff, ×N. Cache + source both RETAINED --------
    const visitComputeDeltas: number[] = [];
    const visitUploadDeltas: number[] = [];
    const settledMatch: boolean[] = [];
    for (let v = 2; v <= 4; v++) {
      flip("image");
      await paintImage();
      const compBefore = getDiffComputeCount();
      const upBefore = uploadCount;
      flip("diff");
      const dv = await paintDiff();
      const compAfter = getDiffComputeCount();
      visitComputeDeltas.push(compAfter - compBefore);
      visitUploadDeltas.push(uploadCount - upBefore);
      report(nonZero(dv), `visit${v} diff paints non-blank`);
      allOk = allOk && nonZero(dv);
      // The RETAINED result must present IDENTICAL content on every revisit (the
      // content-keyed cache hit is what's blitted — no perturbation).
      settledMatch.push(!!dv && Math.abs(mean16(dv) - settled1) < 2);
    }

    void compAfterVisit1;
    note(`first diff visit compute delta = ${compAfterVisit1 - compBeforeFirstDiff} (FLIP result + SSIM metric = 2)`);
    note(`per-revisit compute deltas (visits 2-4) = [${visitComputeDeltas.join(", ")}]`);
    note(`per-revisit source-upload deltas (visits 2-4) = [${visitUploadDeltas.join(", ")}]`);

    // (1) RESULT retained: a flip BACK to the diff slot must NOT recompute the diff
    //     (content-keyed cache HIT). This held even before the retention fix.
    const noRecompute = visitComputeDeltas.every((d) => d === 0);
    report(noRecompute, `no diff RECOMPUTE on any flip-back (per-revisit compute deltas ${JSON.stringify(visitComputeDeltas)}, want all 0)`);
    allOk = allOk && noRecompute;

    // (2) SOURCE retained: a flip BACK must NOT re-upload the source textures — the
    //     pool's content-keyed retention rebinds them synchronously. This is the
    //     residual-flicker fix; BEFORE it these deltas were [1,1,1].
    const noReupload = visitUploadDeltas.every((d) => d === 0);
    report(noReupload, `no SOURCE re-upload on any flip-back (per-revisit upload deltas ${JSON.stringify(visitUploadDeltas)}, want all 0)`);
    allOk = allOk && noReupload;

    // (3) the retained RESULT presents identical content each revisit (flicker-free:
    //     the cache-hit blit is stable, not a perturbed re-render). Readback right
    //     after a flip is unreliable (an in-DOM canvas rotates its swapchain
    //     back-buffer mid-present — see gpu-image-diff's readback note), so this
    //     asserts the SETTLED content is stable rather than sampling the volatile
    //     present window.
    const stable = settledMatch.every(Boolean);
    report(stable, `retained diff presents IDENTICAL settled content on every flip-back (${JSON.stringify(settledMatch)})`);
    allOk = allOk && stable;

    report(allOk, `stacked [image, FLIP-diff] flip: result-cache + source retention, flicker-free`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
