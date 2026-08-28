/**
 * PAINT-ATOMIC harness — the FIRST PAINTED FRAME after an image↔diff flip.
 *
 * The prior oracles (`stacked-diff-flip-stress`) proved every GPU PRESENT is
 * source⊗encode-coherent. But the reported artefact lives BETWEEN presents: on a
 * fast image→diff flip the tab strip commits instantly while the pane's engine
 * render for the new slot ran in a POST-PAINT (passive) `useEffect` — so the FIRST
 * PAINTED FRAME still showed the HELD previous slot (the image, for one frame,
 * inside the diff tab). The pool render log CANNOT see this: the held frame is a
 * real PREVIOUS coherent present displayed during a paint window that contains NO
 * new present.
 *
 * WHY NOT canvas readback. The literal "sample the painted frame" is unreliable
 * here: an in-DOM WebGPU canvas rotates its swapchain back-buffer, so a
 * `createImageBitmap(canvas)` taken right after a flip returns a STALE/rotated
 * buffer (empirically: the pool render log shows the NEW slot rendered while the
 * synchronous canvas read still reports the OLD slot). And forcing the commit with
 * `flushSync` MASKS the artefact — it flushes passive effects synchronously
 * before paint, so even the pre-fix post-paint render lands "in time". Neither can
 * isolate the fix.
 *
 * THE RELIABLE SIGNAL — submit time vs PAINT boundaries. Under natural scheduling
 * (no `flushSync`) the pane records, per flip, a pre-paint COMMIT marker and the
 * new slot's first render SUBMIT, each timestamped; a free-running rAF loop records
 * every browser PAINT boundary. A flip is STALE iff a paint boundary falls strictly
 * between its commit and its new-slot submit — i.e. the browser painted the OLD
 * slot after the flip committed. This is robust to React's early passive-effect
 * flush (an early-flushed submit still lands before the paint → correctly atomic)
 * and to swapchain-rotation-unreliable canvas readback. Flips run FASTER than the
 * frame rate (a ~3ms task gap vs a ~16ms paint — the documented artefact condition),
 * so a render that lands in a POST-paint effect is displayed stale for a real paint.
 * Pre-fix this reproduces stale first-frames (measured ~15/240 image↔diff, ~8/239
 * same-kind); the fix (paint-atomic pre-paint render for resident flips) drives it
 * to ZERO. A settled render-log check frames correctness (the pane shows the target
 * slot once settled). Epoch granularity distinguishes even two same-kind images.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import GpuImagePane from "../../../../plots/image/backend/gpu";
import { urlSource } from "../../../../plots/image/backend/contracts";
import { getSharedDevice } from "../../../../plots/image/engine/device";
import {
  startPaneRenderLog,
  stopPaneRenderLog,
  getPaneRenderLog,
  startPaintPhaseLog,
  stopPaintPhaseLog,
  getPaintPhaseLog,
  type PaintPhaseRecord,
} from "../../../../plots/image/engine/test-hooks";
import { createHarness, sleep, waitFor } from "../../testing/harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({ title: "STACKED DIFF FLIP PAINT" });

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

const PLAIN_URL = makeImageUrl((x, y) => [200 + (x % 55), 200 + (y % 55), 210]);
const PLAIN2_URL = makeImageUrl((x, y) => [210, 200 + (x % 55), 40 + (y % 55)]);
const REF_URL = makeImageUrl((_x, y) => [Math.round((y / 63) * 255), 128, 64]);
const FG_URL = makeImageUrl((x) => [Math.round((x / 63) * 255), 128, 64]);

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

function getCanvas(container: HTMLElement): HTMLCanvasElement | null {
  return container.querySelector("canvas");
}

/** Settle on `p` and confirm (via the pool render log — the swapchain-rotation-safe
 *  ground truth) that the pane presents the requested kind. */
async function settledPresentsKind(
  renderProps: (p: Record<string, unknown>) => void,
  p: Record<string, unknown>,
  want: "image" | "diff",
): Promise<boolean> {
  startPaneRenderLog();
  renderProps(p);
  const ok = await waitFor(() =>
    getPaneRenderLog().some((r) =>
      want === "diff"
        ? r.mode === "cached-diff" || !!r.contentOpId
        : r.mode === "image" && r.sourceKey === undefined && !r.contentOpId,
    ), 8000, 40);
  stopPaneRenderLog();
  return ok;
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
    const renderProps = (p: Record<string, unknown>): void => root.render(h(GpuImagePane, p as never));

    renderProps(imageProps());
    await waitFor(() => !!getCanvas(container), 8000, 40);
    await sleep(300);

    // PRIME residency: visit image + diff (+ the control's PLAIN2) so the pool
    // retains every texture (image / ref / fg / plain2 — 0bb636e LRU) AND warms the
    // FLIP diff-result cache + the URL decode caches. Every storm flip below is then
    // a RESIDENT flip (a genuinely-async first visit legitimately holds post-paint,
    // which is correct and would not be a fair paint-atomic test).
    const okImg = await settledPresentsKind(renderProps, imageProps(), "image");
    const okDiff = await settledPresentsKind(renderProps, diffProps(), "diff");
    await settledPresentsKind(renderProps, imageProps(PLAIN2_URL), "image");
    await settledPresentsKind(renderProps, imageProps(), "image");
    report(okImg && okDiff, `pane presents a coherent image AND diff when settled (priming residency)`);

    type Analysis = {
      residentFlips: number;
      staleFirstFrames: number; // resident flips with a PAINT between commit and first submit
      paintAtomic: number; // resident flips whose new slot submitted before the first post-commit paint
      byKindStale: Record<string, number>;
    };
    // Classify each RESIDENT flip epoch against real browser PAINT boundaries
    // (`paints`, rAF timestamps). Per epoch: `tCommit` (the pre-paint commit
    // marker), `tSubmit` (first actual submit). If a paint boundary lies strictly
    // between commit and submit, a browser paint occurred showing the OLD slot after
    // the flip committed = a STALE first frame. Otherwise the new slot was submitted
    // before the first post-commit paint = paint-atomic. This is robust to React's
    // early passive-effect flush (an early-flushed "post" submit lands before the
    // paint, so it correctly reads as atomic). Epoch granularity distinguishes even
    // two same-kind plain images.
    const analyze = (recs: PaintPhaseRecord[], paints: number[]): Analysis => {
      const a: Analysis = { residentFlips: 0, staleFirstFrames: 0, paintAtomic: 0, byKindStale: {} };
      const commitByEpoch = new Map<number, PaintPhaseRecord>();
      const firstSubmitByEpoch = new Map<number, PaintPhaseRecord>();
      const residentEpochs = new Set<number>();
      for (const r of recs) {
        if (r.phase === "commit") {
          if (!commitByEpoch.has(r.epoch)) commitByEpoch.set(r.epoch, r);
        } else if (r.submitted) {
          if (!firstSubmitByEpoch.has(r.epoch)) firstSubmitByEpoch.set(r.epoch, r);
        }
        if (r.resident) residentEpochs.add(r.epoch);
      }
      for (const [epoch, commit] of commitByEpoch) {
        if (!residentEpochs.has(epoch)) continue; // only RESIDENT flips are paint-atomic-eligible
        const submit = firstSubmitByEpoch.get(epoch);
        if (!submit) continue; // never rendered in-window (shouldn't happen post-storm)
        a.residentFlips++;
        // A browser paint strictly between the commit and the first submit means a
        // frame painted the OLD slot after the flip committed → stale first frame.
        const paintBetween = paints.some((p) => p > commit.t + 0.01 && p < submit.t - 0.01);
        if (paintBetween) {
          a.staleFirstFrames++;
          a.byKindStale[commit.kind] = (a.byKindStale[commit.kind] ?? 0) + 1;
        } else {
          a.paintAtomic++;
        }
      }
      return a;
    };

    // A free-running rAF loop records every PAINT boundary timestamp (a rAF fires
    // right before the browser paints) for the submit-vs-paint classification.
    let collecting = true;
    const paints: number[] = [];
    const paintLoop = (): void => {
      paints.push(performance.now());
      if (collecting) requestAnimationFrame(paintLoop);
    };
    requestAnimationFrame(paintLoop);

    // ---- image↔diff storm under NATURAL scheduling (no flushSync). Flip FASTER
    // than the frame rate (a ~3ms macrotask gap vs. a ~16ms paint), the documented
    // artefact condition: several commits fall between two paints, so a slot whose
    // render lands in a POST-paint effect is displayed stale for a real paint. Each
    // flip is a separate task (setTimeout), so React commits them individually. ----
    const ITER = 240;
    startPaintPhaseLog();
    const p0 = paints.length;
    for (let i = 0; i < ITER; i++) {
      renderProps(i % 2 === 0 ? diffProps() : imageProps());
      await sleep(3);
    }
    await sleep(300);
    const diffAnalysis = analyze(getPaintPhaseLog(), paints.slice(p0));
    stopPaintPhaseLog();
    note(
      `image↔diff storm: ${diffAnalysis.residentFlips} RESIDENT flips — ` +
        `paint-atomic ${diffAnalysis.paintAtomic}, STALE first-frame ${diffAnalysis.staleFirstFrames} ` +
        `${JSON.stringify(diffAnalysis.byKindStale)}`,
    );

    // ---- same-kind CONTROL (image↔image), same measurement --------------------
    startPaintPhaseLog();
    const p1 = paints.length;
    for (let i = 0; i < ITER; i++) {
      renderProps(imageProps(i % 2 === 0 ? PLAIN_URL : PLAIN2_URL));
      await sleep(3);
    }
    await sleep(300);
    const ctrlAnalysis = analyze(getPaintPhaseLog(), paints.slice(p1));
    stopPaintPhaseLog();
    collecting = false;
    note(
      `CONTROL image↔image storm: ${ctrlAnalysis.residentFlips} RESIDENT flips — ` +
        `paint-atomic ${ctrlAnalysis.paintAtomic}, STALE first-frame ${ctrlAnalysis.staleFirstFrames}`,
    );

    // Non-vacuous: the storms actually produced resident flips to measure (pre-fix
    // these were 94/94 and 119/119 post-paint = stale; the fix drives them to 0).
    report(diffAnalysis.residentFlips >= 20, `storm exercised real RESIDENT image↔diff flips (${diffAnalysis.residentFlips})`);
    report(ctrlAnalysis.residentFlips >= 20, `storm exercised real RESIDENT same-kind flips (${ctrlAnalysis.residentFlips})`);
    // The fix: ZERO resident flips render post-paint (every resident flip is paint-atomic).
    report(
      diffAnalysis.staleFirstFrames === 0,
      `ZERO stale first-painted-frames on RESIDENT image↔diff flips (${diffAnalysis.staleFirstFrames} post-paint of ${diffAnalysis.residentFlips})`,
    );
    report(
      ctrlAnalysis.staleFirstFrames === 0,
      `ZERO stale first-painted-frames on RESIDENT same-kind image↔image flips (${ctrlAnalysis.staleFirstFrames} post-paint of ${ctrlAnalysis.residentFlips})`,
    );

    // Correctness after the storm (render-log ground truth, swapchain-safe).
    const settledDiff = await settledPresentsKind(renderProps, diffProps(), "diff");
    const settledImg = await settledPresentsKind(renderProps, imageProps(), "image");
    report(settledDiff && settledImg, `pane still presents a coherent diff AND image after the storm (no deadlock)`);

    const allOk =
      okImg &&
      okDiff &&
      diffAnalysis.residentFlips >= 20 &&
      ctrlAnalysis.residentFlips >= 20 &&
      diffAnalysis.staleFirstFrames === 0 &&
      ctrlAnalysis.staleFirstFrames === 0 &&
      settledDiff &&
      settledImg;
    report(allOk, `paint-atomic: no image-frame flash inside the diff tab on resident image↔diff flips`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
