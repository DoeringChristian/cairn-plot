/**
 * STRESS harness — rapid image↔diff flipping present-coherency proof.
 *
 * Sibling of `stacked-diff-flip.browser.ts` (which proves the SLOW-flip
 * invariants: 0 recompute / 0 re-upload on a settled flip-back). This one drives
 * the SAME reused `GpuImagePane` through image↔diff flips FASTER than the frame
 * rate — flipping every rAF (and sometimes twice within one rAF) in a randomized
 * pattern, hundreds of iterations — and inspects EVERY actual GPU present via the
 * pool's per-present render log (`engine/test-hooks`'s `startPaneRenderLog`),
 * NOT flaky mid-present canvas readback.
 *
 * WHY the render log and not fingerprints. An in-DOM canvas rotates its swapchain
 * back-buffer mid-present (the documented `gpu-image-diff` readback gotcha), so
 * sampling the presented pixels per-frame is unreliable. The pool render log
 * instead records the GROUND TRUTH of what textures were BOUND at each present
 * (`entry.sourceKey`/`sourceBKey` + `params.contentOpId` + mode). Each present
 * must be one of exactly two SELF-CONSISTENT shapes:
 *   - VALID IMAGE: mode "image", identity op (contentOpId falsy), primary UNKEYED
 *     (`sourceKey === undefined`) — the plain image, no `b`.
 *   - VALID DIFF:  mode "cached-diff", `sourceKey === "flip:ref"`,
 *     `sourceBKey === "flip:fg"`, `hasSrcB` — the FLIP over its two operands.
 * ANY present matching NEITHER is INCOHERENT: a mixed/stale combination — e.g. an
 * image blit while the pool's primary is still the diff's keyed reference
 * (`sourceKey === "flip:ref"`), or a diff blit whose operand keys hadn't caught
 * up. That is the objective artefact signal (the "flicker").
 *
 * The op transition (image↔diff) is deliberately the stress axis: it flips
 * `diffMode`/`contentOpId`/the display encoding/`compareSource` together, and
 * those flow through different React effects — so under fast flipping a present
 * can slip through with a mismatched combination. A same-kind CONTROL
 * (image↔image) is run first and must stay 0 (matching the field report that
 * same-kind flips never flicker).
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import GpuImagePane from "../GpuImagePane";
import { urlSource } from "../image-backend";
import { getSharedDevice } from "../../engine/device";
import {
  startPaneRenderLog,
  stopPaneRenderLog,
  getPaneRenderLog,
  type PaneRenderRecord,
} from "../../engine/test-hooks";

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
  document.title = pass ? "STACKED DIFF FLIP STRESS PASS" : "STACKED DIFF FLIP STRESS FAIL";
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function raf(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
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
const PLAIN2_URL = makeImageUrl((x, y) => [128, x * 3, y * 3]);

const STACK_KEYS = { a: "flip:ref", b: "flip:fg" };

function imageProps(url = PLAIN_URL): Record<string, unknown> {
  return { source: urlSource(url), zoom: 1, pan: { x: 0, y: 0 }, label: "" };
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

function probeEl(container: HTMLElement): (HTMLElement & { __cairnImageDiffProbe?: { canvas: HTMLCanvasElement | null; requestRender: () => void } }) | null {
  return container.querySelector("[data-gpu-image-viewport]") as never;
}
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

/** Classify one present. Returns null if coherent, else a reason string. */
function incoherentReason(r: PaneRenderRecord): string | null {
  const isDiffOp = !!r.contentOpId; // nonzero contentOpId = a direct op (unused for FLIP, which is cached)
  if (r.mode === "cached-diff") {
    // A FLIP present: the RESULT of the two keyed operands.
    if (r.sourceKey !== STACK_KEYS.a || r.sourceBKey !== STACK_KEYS.b || !r.hasSrcB) {
      return `cached-diff bound to (a=${r.sourceKey}, b=${r.sourceBKey}, hasSrcB=${r.hasSrcB}); want (${STACK_KEYS.a}, ${STACK_KEYS.b}, true)`;
    }
    return null;
  }
  // mode "image": the plain image path (identity). VALID only when the primary is
  // the UNKEYED plain image and no diff op / operand lingers.
  if (isDiffOp) return `image-mode present with a nonzero contentOpId=${r.contentOpId}`;
  if (r.sourceKey !== undefined) return `image present but primary is keyed "${r.sourceKey}" (stale diff reference)`;
  if (r.hasSrcB || r.sourceBKey !== undefined) return `image present with a lingering b slot (sourceBKey=${r.sourceBKey}, hasSrcB=${r.hasSrcB})`;
  return null;
}

function analyze(records: PaneRenderRecord[]): { total: number; incoherent: PaneRenderRecord[]; reasons: Map<string, number> } {
  const incoherent: PaneRenderRecord[] = [];
  const reasons = new Map<string, number>();
  for (const r of records) {
    const why = incoherentReason(r);
    if (why) {
      incoherent.push(r);
      reasons.set(why, (reasons.get(why) ?? 0) + 1);
    }
  }
  return { total: records.length, incoherent, reasons };
}

async function main(): Promise<void> {
  try {
    await getSharedDevice();

    const container = document.createElement("div");
    container.style.cssText = "width:128px;height:128px;position:absolute;left:0;top:0";
    document.body.appendChild(container);
    const mount = document.createElement("div");
    mount.style.cssText = "width:128px;height:128px";
    container.appendChild(mount);
    const root: Root = createRoot(mount);

    const renderProps = (p: Record<string, unknown>) => root.render(h(GpuImagePane, p as never));

    // ---- warm up: settle image, then diff (populates retention + diff cache) --
    renderProps(imageProps());
    await waitFor(() => !!probeEl(container)?.__cairnImageDiffProbe?.canvas, 8000);
    const settle = async () => {
      await waitFor(async () => {
        const p = probeEl(container)?.__cairnImageDiffProbe;
        if (!p?.canvas) return false;
        p.requestRender();
        return nonZero(await readCanvasBytes(p.canvas));
      }, 8000, 60);
    };
    await settle();
    renderProps(diffProps());
    await settle();
    renderProps(imageProps());
    await settle();
    note("warm-up done (image + FLIP-diff both settled; retention + diff cache primed)");

    // A seeded PRNG so the randomized flip pattern is reproducible across runs.
    let seed = 0x9e3779b9 >>> 0;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    // ---- CONTROL: same-kind (image↔image) rapid flips — expect ZERO incoherent -
    startPaneRenderLog();
    for (let i = 0; i < 120; i++) {
      renderProps(imageProps(i % 2 === 0 ? PLAIN_URL : PLAIN2_URL));
      await raf();
      if (rnd() < 0.5) {
        // a second flip within the same rAF (coalescing stress)
        renderProps(imageProps(i % 2 === 0 ? PLAIN2_URL : PLAIN_URL));
      }
    }
    await sleep(200);
    const control = analyze(getPaneRenderLog());
    stopPaneRenderLog();
    note(`CONTROL image↔image: ${control.total} presents, ${control.incoherent.length} incoherent`);
    report(control.incoherent.length === 0, `same-kind (image↔image) flips are coherent (${control.incoherent.length}/${control.total} incoherent)`);

    // ---- MAIN: rapid image↔diff (op-transition) flips ------------------------
    // Flip every rAF, randomly choosing the kind and occasionally double-flipping
    // within one rAF, so the async source/refDims application for one slot lands
    // while the pane's props already describe another. Hundreds of transitions.
    const ITER = 400;
    startPaneRenderLog();
    let prevDiff = false;
    let transitions = 0;
    for (let i = 0; i < ITER; i++) {
      const wantDiff: boolean = rnd() < 0.5;
      renderProps(wantDiff ? diffProps() : imageProps());
      if (wantDiff !== prevDiff) transitions++;
      prevDiff = wantDiff;
      // Occasionally a second, opposite flip in the SAME rAF (faster than a frame).
      if (rnd() < 0.35) {
        const wantDiff2: boolean = !wantDiff;
        renderProps(wantDiff2 ? diffProps() : imageProps());
        if (wantDiff2 !== prevDiff) transitions++;
        prevDiff = wantDiff2;
      }
      await raf();
    }
    // Let any in-flight async source applications drain, then capture.
    await sleep(300);
    const mainRes = analyze(getPaneRenderLog());
    stopPaneRenderLog();

    note(`MAIN image↔diff: ${transitions} op-transitions over ${ITER} iterations, ${mainRes.total} presents captured`);
    const rate = mainRes.total ? (100 * mainRes.incoherent.length) / mainRes.total : 0;
    note(`INCOHERENT presents = ${mainRes.incoherent.length}/${mainRes.total} (${rate.toFixed(2)}% of presents)`);
    if (mainRes.incoherent.length) {
      const sample = [...mainRes.reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      for (const [why, count] of sample) note(`  ×${count}  ${why}`);
    }

    // The proof: ZERO incoherent presents. Pre-fix this is > 0 (the mismatch-triple
    // evidence above); the present-coherency guard must drive it to 0.
    const coherent = mainRes.incoherent.length === 0;
    report(coherent, `rapid image↔diff flips present NO stale/intermediate frame (${mainRes.incoherent.length} incoherent of ${mainRes.total})`);

    // Sanity — NO DEADLOCK: the guard HOLDS the previous frame while sources are
    // incoherent, so we must prove it still eventually PRESENTS each slot coherently
    // after the storm. Uses the render log as the oracle (a COHERENT present of the
    // requested kind must appear), not canvas readback — the `__cairnImageDiffProbe`
    // seam only exists in compare mode, and mid-present canvas readback is flaky.
    const settledPresent = async (want: "image" | "diff"): Promise<boolean> => {
      startPaneRenderLog();
      renderProps(want === "diff" ? diffProps() : imageProps());
      let ok = false;
      await waitFor(() => {
        ok = getPaneRenderLog().some(
          (r) =>
            incoherentReason(r) === null &&
            (want === "diff" ? r.mode === "cached-diff" : r.mode === "image" && r.sourceKey === undefined),
        );
        return ok;
      }, 8000, 60);
      stopPaneRenderLog();
      return ok;
    };
    const settledDiff = await settledPresent("diff");
    report(settledDiff, `pane still presents a coherent diff after the storm (no deadlock)`);
    const settledImg = await settledPresent("image");
    report(settledImg, `pane still presents a coherent image after the storm (no deadlock)`);

    const allOk = control.incoherent.length === 0 && coherent && settledDiff && settledImg;
    report(allOk, `stress: rapid image↔diff flipping is present-coherent + no deadlock`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
