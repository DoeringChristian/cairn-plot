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
 * (`entry.sourceKey`/`sourceBKey` + `params.imageOperation` + mode). Each present
 * must be one of exactly two SELF-CONSISTENT shapes:
 *   - VALID IMAGE: mode "image", identity op (imageOperation falsy), primary UNKEYED
 *     (`sourceKey === undefined`) — the plain image, no `b`.
 *   - VALID DIFF:  mode "cached-diff", `sourceKey === "flip:ref"`,
 *     `sourceBKey === "flip:fg"`, `hasSrcB` — the FLIP over its two operands.
 * ANY present matching NEITHER is INCOHERENT: a mixed/stale combination — e.g. an
 * image blit while the pool's primary is still the diff's keyed reference
 * (`sourceKey === "flip:ref"`), or a diff blit whose operand keys hadn't caught
 * up. That is the objective artefact signal (the "flicker").
 *
 * The op transition (image↔diff) is deliberately the stress axis: it flips
 * `diffMode`/`imageOperation`/the display encoding/`compareSource` together, and
 * those flow through different React effects — so under fast flipping a present
 * can slip through with a mismatched combination. A same-kind CONTROL
 * (image↔image) is run first and must stay 0 (matching the field report that
 * same-kind flips never flicker).
 */
import { floatValues } from "../../../plots/image/runtime/pixel-buffer.ts";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import GpuImagePane from "../../../plots/image/webgpu/view";
import { urlSource, hdrSource, type FloatImageData } from "../../../plots/image/runtime/contracts";
import { getSharedWebGpuDevice } from "../../../plots/image/webgpu/device/device-provider.ts";
import {
  startPaneRenderLog,
  stopPaneRenderLog,
  getPaneRenderLog,
  setDeepColorDetectorForTest,
  getHueAnomalies,
  getDeepColorStats,
  type PaneRenderRecord,
} from "../../../plots/image/webgpu/test-hooks";
import { createHarness, sleep, waitFor } from "../../harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({ title: "STACKED DIFF FLIP STRESS" });

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

function raf(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
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

// LIGHT (near-white) fills so a scalar reduce of the RAW image lands high on the
// magma ramp (~orange) — the exact "image source through the diff's scalar magma
// display" artefact the user reported. A torn present that runs the LIGHT image
// through isScalar+magma is thus an orange-dominant frame by construction.
const FG_URL = makeImageUrl((x) => [Math.round((x / 63) * 255), 128, 64]);
const REF_URL = makeImageUrl((_x, y) => [Math.round((y / 63) * 255), 128, 64]);
const PLAIN_URL = makeImageUrl((x, y) => [200 + (x % 55), 200 + (y % 55), 210]);
const PLAIN2_URL = makeImageUrl((x, y) => [210, 200 + (x % 55), 200 + (y % 55)]);

const STACK_KEYS = { a: "flip:ref", b: "flip:fg" };

function imageProps(url = PLAIN_URL): Record<string, unknown> {
  return { source: urlSource(url), zoom: 1, pan: { x: 0, y: 0 }, label: "" };
}
// A CACHED FLIP diff (default): the RESULT (scalar error) is blit through magma.
function diffProps(): Record<string, unknown> {
  return {
    source: urlSource(REF_URL),
    compareSource: {
      b: urlSource(FG_URL),
      operationId: "flip",
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
// A DIRECT magnitude diff with an explicit MAGMA colormap. This is the path that
// exercises `attemptRender` (NOT the cached blit) with `isScalar + magma LUT +
// reduce mean` — the exact scalar-magma display the orange artefact rides. A
// torn present here that binds the LIGHT image primary while carrying these
// encode params is a logged orange frame.
function diffMagmaProps(): Record<string, unknown> {
  return {
    source: urlSource(REF_URL),
    compareSource: {
      b: urlSource(FG_URL),
      operationId: "absolute",
      mode: "diff",
      colormap: "magma",
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

// FLOAT (HDR) sources: a near-white float image so a scalar-magma false-color of
// it lands high on the ramp (orange). Unlike SDR (colormap CPU-baked → present
// isScalar false, invisible to the encode oracle), a float image false-colored
// through `enc` runs the GPU `isScalar` path — VISIBLE to the render-log oracle.
function floatHdr(fill: (x: number, y: number) => number): FloatImageData {
  const W = 32, H = 32;
  const data = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = fill(x, y);
      const i = (y * W + x) * 3;
      data[i] = v; data[i + 1] = v; data[i + 2] = v;
    }
  return { pixels: floatValues(data), shape: [H, W, 3], dtype: "<f4" };
}
const FLOAT_IMG = floatHdr((x) => 0.85 + 0.1 * (x / 31)); // light
const FLOAT_REF = floatHdr((_x, y) => 0.8 + 0.15 * (y / 31));
const FLOAT_FG = floatHdr((x) => 0.82 + 0.13 * (x / 31));
function floatImageProps(): Record<string, unknown> {
  return { hdr: FLOAT_IMG, zoom: 1, pan: { x: 0, y: 0 }, label: "" };
}
function floatDiffProps(): Record<string, unknown> {
  return {
    source: hdrSource(FLOAT_REF),
    compareSource: {
      b: hdrSource(FLOAT_FG),
      operationId: "flip",
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

/** A canonical string of a present's FULL (source + display-encode) state — the
 *  sharpened oracle. Two DIFFERENT settled combos (a light image vs a scalar
 *  magma diff) map to different strings; a TORN present (right source, stale
 *  encode — or vice-versa) maps to a string that matches NEITHER settled slot. */
function fullSig(r: PaneRenderRecord): string {
  return JSON.stringify({
    mode: r.mode,
    a: r.sourceKey ?? null,
    b: r.sourceBKey ?? null,
    hasSrcB: r.hasSrcB,
    op: r.imageOperation ?? 0,
    isScalar: !!r.isScalar,
    scalarMode: r.scalarMode ?? 0,
    hasColormap: !!r.hasColormap,
    cmapSig: r.colormapSig != null ? Math.round(r.colormapSig * 1000) : null,
    reduce: r.reduce ?? null,
    ch: r.channelCount ?? null,
    op2: r.operator ?? null,
    hdr: !!r.hdrOut,
  });
}

/** Would this present render ORANGE-dominant? The artefact is a LIGHT-content
 *  source (the plain image primary, or a direct-op primary whose `b` operand is
 *  missing so |a-b| ≈ a ≈ light) driven through a SCALAR colormap (isScalar +
 *  a bound LUT) — a near-white scalar lands on the magma UPPER ramp = orange.
 *  Derived from the ground-truth encode fingerprint (deterministic), not flaky
 *  mid-present pixel readback (an in-DOM canvas rotates its back-buffer). */
function isOrangeFrame(r: PaneRenderRecord, settled: Set<string>): boolean {
  if (settled.has(fullSig(r))) return false; // a settled slot is never orange
  if (!r.isScalar || !r.hasColormap) return false; // orange needs the scalar-LUT path
  // A scalar-LUT present that is NOT a settled diff means a light source is
  // being collapsed through the diff's magma — the orange flash.
  return true;
}

function probeEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-gpu-image-surface]");
}

/** Classify one present's SOURCE binding (the 9368ee2 oracle). Returns null if
 *  the bound textures match the present's mode/op, else a reason string. Accepts
 *  both a CACHED diff (imageOperation 0, RESULT blit) and a DIRECT diff op
 *  (imageOperation nonzero, samples both keyed operands). */
function incoherentReason(r: PaneRenderRecord): string | null {
  const isDiffOp = !!r.imageOperation; // nonzero imageOperation = a direct diff/compositor op
  if (r.mode === "cached-diff" || isDiffOp) {
    // A diff present (cached RESULT, or a direct op over both operands): the two
    // bound source keys must be the diff's keyed operands.
    if (r.sourceKey !== STACK_KEYS.a || r.sourceBKey !== STACK_KEYS.b || !r.hasSrcB) {
      return `diff present bound to (a=${r.sourceKey}, b=${r.sourceBKey}, hasSrcB=${r.hasSrcB}); want (${STACK_KEYS.a}, ${STACK_KEYS.b}, true)`;
    }
    return null;
  }
  // mode "image", identity op: the plain image path. VALID only when the primary
  // is the UNKEYED plain image and no diff operand lingers.
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
    await getSharedWebGpuDevice();

    const container = document.createElement("div");
    container.style.cssText = "width:128px;height:128px;position:absolute;left:0;top:0";
    document.body.appendChild(container);
    const mount = document.createElement("div");
    mount.style.cssText = "width:128px;height:128px";
    container.appendChild(mount);
    const root: Root = createRoot(mount);

    const renderProps = (p: Record<string, unknown>) => root.render(h(GpuImagePane, p as never));

    // ---- warm up + settled-fingerprint capture. LOG-BASED (the plain-image path
    // has no `__cairnImageDiffProbe`, only compare panes do), so we settle by
    // watching the pool's per-present render log for a COHERENT present of the
    // requested mode, then take the LAST (quiescent) present's full fingerprint —
    // renderPass fires only on a dep change, so after a short sleep the tail IS
    // the settled state. Any storm present whose fingerprint is not a captured
    // settled sig is a TORN frame; a scalar-LUT-over-light one is an ORANGE frame.
    renderProps(imageProps());
    await waitFor(() => !!probeEl(container), 8000, 40);
    const captureSettledSig = async (
      p: Record<string, unknown>,
      wantDiff: boolean,
    ): Promise<string[]> => {
      startPaneRenderLog();
      renderProps(p);
      await waitFor(() => {
        const log = getPaneRenderLog();
        return log.some(
          (r) =>
            incoherentReason(r) === null &&
            (wantDiff ? r.mode === "cached-diff" || !!r.imageOperation : r.mode === "image" && r.sourceKey === undefined && !r.imageOperation),
        );
      }, 8000, 40);
      await sleep(200); // quiesce
      const log = getPaneRenderLog();
      const sigs = new Set<string>();
      // The tail (post-quiesce) presents are the settled state; take the last few
      // COHERENT ones so both a possible cached-result AND its blit variants land.
      for (const r of log.slice(-4)) if (incoherentReason(r) === null) sigs.add(fullSig(r));
      stopPaneRenderLog();
      return [...sigs];
    };
    const imgSigs = await captureSettledSig(imageProps(), false);
    const flipSigs = await captureSettledSig(diffProps(), true);
    const magmaSigs = await captureSettledSig(diffMagmaProps(), true);
    await captureSettledSig(imageProps(), false); // leave settled on image + primes retention/cache
    note(
      `warm-up done — settled fingerprints image:${imgSigs.length} flip:${flipSigs.length} magma:${magmaSigs.length}`,
    );
    note(`  image settled sig: ${imgSigs[0] ?? "(none)"}`);
    note(`  flip  settled sig: ${flipSigs[0] ?? "(none)"}`);
    note(`  magma settled sig: ${magmaSigs[0] ?? "(none)"}`);

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

    // ---- Generic op-transition storm runner. Flips image↔diff every rAF,
    // randomly, occasionally twice per rAF (faster than a frame), so the async
    // source/refDims application for one slot lands while the pane's props already
    // describe another. Measures BOTH the source-coherency oracle (the 9368ee2
    // proof) AND the sharpened FULL-STATE oracle + orange-frame count. ----------
    const ITER = 400;
    const settledSet = new Set<string>([...imgSigs, ...flipSigs, ...magmaSigs]);
    const runStorm = async (
      diffFactory: () => Record<string, unknown>,
    ): Promise<{
      total: number;
      srcIncoherent: number;
      fullMismatch: number;
      orange: number;
      transitions: number;
      mismatchReasons: Map<string, number>;
    }> => {
      startPaneRenderLog();
      let prevDiff = false;
      let transitions = 0;
      for (let i = 0; i < ITER; i++) {
        const wantDiff: boolean = rnd() < 0.5;
        renderProps(wantDiff ? diffFactory() : imageProps());
        if (wantDiff !== prevDiff) transitions++;
        prevDiff = wantDiff;
        if (rnd() < 0.35) {
          const wantDiff2: boolean = !wantDiff;
          renderProps(wantDiff2 ? diffFactory() : imageProps());
          if (wantDiff2 !== prevDiff) transitions++;
          prevDiff = wantDiff2;
        }
        await raf();
      }
      await sleep(300);
      const records = getPaneRenderLog();
      stopPaneRenderLog();
      let srcIncoherent = 0;
      let fullMismatch = 0;
      let orange = 0;
      const mismatchReasons = new Map<string, number>();
      for (const r of records) {
        if (incoherentReason(r)) srcIncoherent++;
        if (!settledSet.has(fullSig(r))) {
          fullMismatch++;
          const key = fullSig(r);
          mismatchReasons.set(key, (mismatchReasons.get(key) ?? 0) + 1);
        }
        if (isOrangeFrame(r, settledSet)) orange++;
      }
      return { total: records.length, srcIncoherent, fullMismatch, orange, transitions, mismatchReasons };
    };

    // Run each storm variant 3× (the ≥3-repeat requirement). FLIP is the user's
    // reported path (cached magma); MAGMA is the DIRECT scalar-magma path that
    // exercises attemptRender with the scalar-LUT display (where the orange rides).
    const REPEATS = 3;
    let anyFullMismatch = 0;
    let anyOrange = 0;
    let anySrcIncoherent = 0;
    // DEEP-MODE (paneRenderLog=2) proof: arm the output-COLOR detector for the
    // storms so every present's actual color (the pool's extra 8×8 sample pass +
    // readback) is fingerprinted. A present of a settled slot whose color jumps —
    // the reported orange flash — would land in `getHueAnomalies()` regardless of
    // WHY (garbage texture / torn params / driver artefact). On real Metal here we
    // expect ZERO. This also proves the sampler holds up under a flip storm.
    setDeepColorDetectorForTest(true);
    for (const [name, factory] of [
      ["image↔FLIP(cached-magma)", diffProps],
      ["image↔absolute(direct-magma)", diffMagmaProps],
    ] as const) {
      for (let rep = 0; rep < REPEATS; rep++) {
        const res = await runStorm(factory);
        anySrcIncoherent += res.srcIncoherent;
        anyFullMismatch += res.fullMismatch;
        anyOrange += res.orange;
        note(
          `STORM ${name} rep${rep + 1}: ${res.total} presents, ${res.transitions} op-transitions — ` +
            `src-incoherent ${res.srcIncoherent}, FULL-STATE mismatch ${res.fullMismatch}, ORANGE ${res.orange}`,
        );
        if (res.fullMismatch) {
          const sample = [...res.mismatchReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
          for (const [sig, count] of sample) note(`    ×${count}  ${sig}`);
        }
      }
    }
    // Give the async 8×8 readbacks kicked off by the last storm's presents time
    // to resolve before reading the anomaly buffer.
    await sleep(400);
    const deepAnomalies = getHueAnomalies();
    const deepStats = getDeepColorStats();
    setDeepColorDetectorForTest(false);
    note(
      `DEEP color detector: ${deepStats.samples} presents sampled, ${deepStats.settledSlots} settled slot(s), ` +
        `${deepAnomalies.length} hue-anomaly present(s) across all storms`,
    );
    if (deepAnomalies.length) {
      for (const a of deepAnomalies.slice(0, 4)) {
        note(`    hue ${a.hue.toFixed(0)}° rgb(${(a.r * 255) | 0},${(a.g * 255) | 0},${(a.b * 255) | 0}) Δ=${a.distToOwnSettled.toFixed(2)} slot=${a.slot}`);
      }
    }
    // Non-vacuous: the 8×8 sample pass really ran (samples > 0, slots settled) AND
    // saw zero color jumps from any settled slot's fingerprint.
    report(deepStats.samples > 0 && deepStats.settledSlots > 0, `deep detector actually sampled the storm (${deepStats.samples} samples, ${deepStats.settledSlots} settled slots)`);
    report(deepAnomalies.length === 0, `deep output-color detector saw ZERO hue anomalies across the storms (${deepAnomalies.length})`);

    // ---- SYNCED-PAIR storm (the report's real shape): TWO panes in ONE
    // settings-sync selection group, flipped in OPPOSITE phase. A diff peer
    // publishes its scalar-magma `encoding` on the bus; if a plain-IMAGE peer
    // applies that encoding to its own light `enc`, it false-colors the light
    // image through magma → an ORANGE present (mode "image", isScalar + a bound
    // LUT over a NON-error source). This is the one path a diff's display params
    // reach a plain image. Measured via the SAME render-log full-state oracle. ---
    const SYNC = "stress-sync-grp";
    const syncImage = (url = PLAIN_URL, anchor = false): Record<string, unknown> => ({
      ...imageProps(url),
      settingsSyncGroupId: SYNC,
      syncIsAnchor: anchor,
    });
    const syncDiff = (anchor = false): Record<string, unknown> => ({
      ...diffProps(),
      settingsSyncGroupId: SYNC,
      syncIsAnchor: anchor,
    });
    const cB = document.createElement("div");
    cB.style.cssText = "width:128px;height:128px;position:absolute;left:140px;top:0";
    document.body.appendChild(cB);
    const mountB = document.createElement("div");
    mountB.style.cssText = "width:128px;height:128px";
    cB.appendChild(mountB);
    const rootB: Root = createRoot(mountB);
    const renderA = (p: Record<string, unknown>) => root.render(h(GpuImagePane, p as never));
    const renderB = (p: Record<string, unknown>) => rootB.render(h(GpuImagePane, p as never));
    // settle both on image first
    renderA(syncImage(PLAIN_URL, true));
    renderB(syncImage(PLAIN2_URL, false));
    await sleep(400);
    let syncedOrange = 0;
    let syncedTotal = 0;
    const syncedReasons = new Map<string, number>();
    for (let rep = 0; rep < REPEATS; rep++) {
      startPaneRenderLog();
      for (let i = 0; i < 200; i++) {
        // Opposite phase: when A is diff, B is image, and vice-versa.
        const aDiff = rnd() < 0.5;
        renderA(aDiff ? syncDiff(true) : syncImage(PLAIN_URL, true));
        renderB(aDiff ? syncImage(PLAIN2_URL, false) : syncDiff(false));
        await raf();
      }
      await sleep(300);
      const records = getPaneRenderLog();
      stopPaneRenderLog();
      for (const r of records) {
        syncedTotal++;
        if (isOrangeFrame(r, settledSet)) {
          syncedOrange++;
          const k = fullSig(r);
          syncedReasons.set(k, (syncedReasons.get(k) ?? 0) + 1);
        }
      }
    }
    note(`SYNCED-PAIR storm ×${REPEATS}: ${syncedTotal} presents, ORANGE(encode-oracle) ${syncedOrange}`);
    if (syncedOrange) {
      const sample = [...syncedReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      for (const [sig, count] of sample) note(`    ×${count}  ${sig}`);
    }

    // ---- FLOAT image peer synced with a DIFF ANCHOR. The diff anchor's
    // seed publishes its scalar-magma `encoding:"magma"` when the group forms; a
    // plain FLOAT image peer that adopts it into its light `enc` false-colors via
    // the GPU `isScalar` path — a present the render-log oracle SEES (isScalar +
    // magma LUT over a light float image). This is the exact "IMAGE source through
    // the DIFF's scalar magma display" the user reported. --------------------------
    const FSYNC = "stress-fsync-grp";
    const withSync = (p: Record<string, unknown>, anchor: boolean): Record<string, unknown> => ({
      ...p,
      settingsSyncGroupId: FSYNC,
      syncIsAnchor: anchor,
    });
    startPaneRenderLog();
    // A = DIFF ANCHOR (publishes scalar-magma on group form); B = FLOAT IMAGE peer.
    renderA(withSync(floatDiffProps(), true));
    renderB(withSync(floatImageProps(), false));
    await sleep(700);
    // Then flip B image↔diff a few times while A stays diff — the storm shape.
    for (let i = 0; i < 60; i++) {
      renderB(withSync(i % 2 === 0 ? floatImageProps() : floatDiffProps(), false));
      await raf();
    }
    await sleep(300);
    const frecords = getPaneRenderLog();
    stopPaneRenderLog();
    let floatOrange = 0;
    const floatReasons = new Map<string, number>();
    for (const r of frecords) {
      // A float IMAGE present carrying a scalar LUT (isScalar + hasColormap, op 0,
      // NOT a diff's keyed operands) = the light float image false-colored → orange.
      const isImagePresent = r.mode === "image" && !r.imageOperation;
      if (isImagePresent && r.isScalar && r.hasColormap) {
        floatOrange++;
        const k = fullSig(r);
        floatReasons.set(k, (floatReasons.get(k) ?? 0) + 1);
      }
    }
    note(`FLOAT synced (diff-anchor ⊕ image-peer): ${frecords.length} presents, ORANGE(float-image-scalar-LUT) ${floatOrange}`);
    if (floatOrange) {
      const sample = [...floatReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      for (const [sig, count] of sample) note(`    ×${count}  ${sig}`);
    }
    anyOrange += syncedOrange + floatOrange;
    rootB.unmount();
    cB.remove();

    report(anySrcIncoherent === 0, `source-coherency (9368ee2): ${anySrcIncoherent} incoherent presents across all storms`);
    report(anyFullMismatch === 0, `FULL-STATE coherency: ${anyFullMismatch} torn (source⊗encode) presents across all storms`);
    report(anyOrange === 0, `ORANGE frames: ${anyOrange} scalar-magma-over-light presents across all storms (incl. synced pair)`);

    // Sanity — NO DEADLOCK: the guard HOLDS the previous frame while sources are
    // incoherent, so prove it still eventually PRESENTS each slot coherently after
    // the storm (render-log oracle, not flaky canvas readback).
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

    const allOk =
      control.incoherent.length === 0 &&
      anySrcIncoherent === 0 &&
      anyFullMismatch === 0 &&
      anyOrange === 0 &&
      settledDiff &&
      settledImg;
    report(allOk, `stress: rapid image↔diff flipping is FULL-STATE coherent, orange-free + no deadlock`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
