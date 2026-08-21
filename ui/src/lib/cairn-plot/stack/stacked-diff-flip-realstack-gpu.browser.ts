/**
 * REAL-STACK GPU harness — the descriptor-tree present-coherency + sync-adoption
 * oracle the prior investigation flagged as the one UNMEASURED path.
 *
 * WHY THIS EXISTS. The `stacked-diff-flip-stress` harness proved the PANE present
 * path (`GpuImagePane` driven directly with props) is source⊗encode coherent (0
 * orange). What it could NOT exercise is the REAL descriptor tree —
 * `PlotApp → GridView → NodeDispatch → LeafView → GpuImagePane` — running on the
 * GPU with (a) real page-wide SELECTION forming the settings-sync group, and (b)
 * the LeafView async-resolve + `diffSpec` cross-commit timing. A scratch harness
 * that tried this fell back to CPU headlessly (0 pool presents): `ImageStandalone`
 * resolves its backend through `resolveImageRenderer("gpu")`, which returns the
 * CPU pane unless `window.__cairnPlotGpuImagePane` is set — and that seam is set
 * ONLY by the lazy `plot-gpu-image-addon` bundle, which a source harness never
 * loads. THE FIX (below): register the seam ourselves, exactly as the addon does
 * (`getSharedDevice()` → assign `__cairnPlotGpuImagePane` = `GpuImagePane` +
 * `__cairnPlotUseGpuImage = true`), then force `render=gpu`. That makes the real
 * stack run on the GPU headlessly, so the pool per-present render-log oracle sees
 * real presents.
 *
 * WHAT IT MEASURES. Two phases, FLOAT sources throughout (an SDR colormap is
 * CPU-baked into the texture → the present is `isScalar:false`, INVISIBLE to the
 * encode oracle; a FLOAT image false-colored runs the GPU `isScalar` path, which
 * the render log SEES):
 *
 *   PHASE A — SYNC-ADOPTION (the hypothesis). A side-by-side `[image, FLIP-diff]`
 *   grid, both panes SETTLED, then a page-wide selection is formed with the DIFF
 *   as ANCHOR (select diff first, then add the image). The settled diff's snapshot
 *   carries `encoding:"magma"` (`deriveCompareEncodingId("scalar", …, magma)`); the
 *   non-anchor plain image adopts the group snapshot via `applyRemoteSettings`,
 *   which calls `enc.setEncoding("magma")` UNCONDITIONALLY. A light float image
 *   through magma (mean-reduced to a high scalar) = the magma UPPER RAMP = ORANGE.
 *   This is precisely the timing the pane-level FSYNC probe missed: it formed the
 *   group at MOUNT (before the diff resolved its magma default), so the anchor
 *   seed carried a curve, not magma. Selecting AFTER settle is what a user does.
 *   The IMAGE-ANCHOR order is the control (the image seeds srgb; the diff, being a
 *   diff, ignores the image's curve on its scalar face).
 *
 *   PHASE B — STACKED FLIP STORM (the user's exact config). A stacked `[image,
 *   FLIP-diff]` grid flipped image↔diff faster than the frame rate, through the
 *   REAL tree (one reused LeafView/GpuImagePane), measured with the SAME oracle —
 *   the source⊗encode coherence of every present.
 *
 * An ORANGE present here = an IMAGE-mode present (identity op, no `b`) that is
 * `isScalar` with a bound colormap LUT — a plain light image false-colored, the
 * reported artefact BY CONSTRUCTION.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../plot-renderers";
import type { PlotDescriptor } from "../../../plot-descriptor";
import { getSharedDevice } from "../engine/device";
import GpuImagePane from "../renderers/GpuImagePane";
import { registerRuntimeEntries } from "../viewport/runtime-store";
import {
  startPaneRenderLog,
  stopPaneRenderLog,
  getPaneRenderLog,
  startPaintPhaseLog,
  stopPaintPhaseLog,
  getPaintPhaseLog,
  isPipelineMismatch,
  type PaneRenderRecord,
  type PaintPhaseRecord,
} from "../engine/test-hooks";
import {
  getGlobalSelectionStore,
  __resetGlobalSelectionStoreForTest,
  GLOBAL_SELECTION_BASE,
} from "../viewport/selection-store";
import { publishImageSettings } from "../viewport/image-settings-sync";

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
  document.title = pass ? "REALSTACK GPU PASS" : "REALSTACK GPU FAIL";
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
async function waitFor(pred: () => boolean, timeoutMs = 8000, step = 30): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await sleep(step);
  }
  return pred();
}

// ---- FLOAT data (LIGHT / near-white so a scalar-magma false-color lands on the
// magma UPPER ramp = orange). RGB (k=3) so a plain image is isScalar:false until
// a colormap is adopted (isScalar:true) — the exact orange signal. -------------
function lightRGB(base: number, fill: (x: number, y: number) => number): Float32Array {
  const W = 32, H = 32;
  const d = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = base + fill(x, y);
      const i = (y * W + x) * 3;
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
  return d;
}
function registerFloatData(): void {
  const mk = (data: Float32Array) => ({
    kind: "float" as const,
    data,
    shape: [32, 32, 3],
    dtype: "<f4",
    precision: "f32" as const,
  });
  registerRuntimeEntries({
    "runtime:img": mk(lightRGB(0.85, (x) => 0.1 * (x / 31))),
    "runtime:img2": mk(lightRGB(0.88, (_x, y) => 0.09 * (y / 31))),
    "runtime:ref": mk(lightRGB(0.8, (_x, y) => 0.15 * (y / 31))),
    "runtime:fg": mk(lightRGB(0.82, (x) => 0.13 * (x / 31))),
  });
}

const imghdr = (hash: string) => ({ kind: "imghdr" as const, hash, meta: {} });
const imageLeaf = (hash: string, label: string) => ({
  kind: "plot" as const,
  renderer: "image",
  data: imghdr(hash),
  props: { toolbar: true, label },
});
const diffCompare = (label: string) => ({
  kind: "compare" as const,
  mode: "diff" as const,
  a: imghdr("runtime:ref"),
  b: imghdr("runtime:fg"),
  diffSubmode: "flip",
  props: { toolbar: true, label },
});

function sideBySideGrid(): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      children: [imageLeaf("runtime:img", "Image"), diffCompare("Diff")],
    },
  } as unknown as PlotDescriptor;
}
function stackedGrid(): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode: "stacked",
      children: [imageLeaf("runtime:img", "Image"), diffCompare("Diff")],
    },
  } as unknown as PlotDescriptor;
}

// ---- oracle ------------------------------------------------------------------
/** An IMAGE-mode present (identity op, no `b`) that is `isScalar` with a bound
 *  colormap LUT — a plain light image false-colored through a scalar colormap =
 *  the magma-upper-ramp ORANGE by construction. */
function isImageOrange(r: PaneRenderRecord): boolean {
  return (
    r.mode === "image" &&
    !r.contentOpId &&
    !r.hasSrcB &&
    r.isScalar === true &&
    r.hasColormap === true
  );
}
function fullSig(r: PaneRenderRecord): string {
  return JSON.stringify({
    mode: r.mode,
    a: r.sourceKey ?? null,
    b: r.sourceBKey ?? null,
    op: r.contentOpId ?? 0,
    isScalar: !!r.isScalar,
    scalarMode: r.scalarMode ?? 0,
    hasColormap: !!r.hasColormap,
    cmapSig: r.colormapSig != null ? Math.round(r.colormapSig * 1000) : null,
    reduce: r.reduce ?? null,
    ch: r.channelCount ?? null,
  });
}

const framePaneIds = (hostId: string): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`#${hostId} [data-plot-pane-id][data-selectable="true"]`),
  ).map((el) => el.getAttribute("data-plot-pane-id")!);

const key = (k: string) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const activeIdx = (hostId: string): number => {
  const el = document.querySelector<HTMLElement>(`#${hostId} [data-cairn-stack-active]`);
  const v = el?.getAttribute("data-cairn-stack-active");
  return v == null ? -1 : parseInt(v, 10);
};

async function main(): Promise<void> {
  try {
    registerCoreRenderers();
    registerFloatData();

    // THE CPU-FALLBACK FIX — register the GPU pane on the window seam exactly as
    // `plot-gpu-image-addon.tsx` does, so `resolveImageRenderer("gpu")` returns
    // the engine pane instead of the CPU fallback. (A source harness never loads
    // the lazy addon bundle that normally sets this.)
    await getSharedDevice();
    (window as unknown as { __cairnPlotGpuImagePane?: unknown }).__cairnPlotGpuImagePane = GpuImagePane;
    (window as unknown as { __cairnPlotUseGpuImage?: boolean }).__cairnPlotUseGpuImage = true;
    (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "gpu";
    (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;

    let allOk = true;

    // ======================= PHASE A — SYNC ADOPTION ========================
    // Prove the real stack runs on GPU (presents logged) AND measure whether a
    // diff-anchored selection false-colors a plain image (the orange).
    const runAdoption = async (
      hostId: string,
      anchorFirst: "diff" | "image",
    ): Promise<{ presents: number; imagePresents: number; orange: number; sigs: Set<string> }> => {
      const host = document.getElementById(hostId)!;
      host.style.cssText = "width:520px;height:280px;background:#222";
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: sideBySideGrid() }));

      // Settle: wait for a coherent present of BOTH a plain image (isScalar false)
      // and a cached diff — proves GPU is live and both panes rendered.
      startPaneRenderLog();
      const settled = await waitFor(() => {
        const log = getPaneRenderLog();
        const img = log.some((r) => r.mode === "image" && !r.contentOpId && !r.hasSrcB);
        const diff = log.some((r) => r.mode === "cached-diff" || !!r.contentOpId);
        return img && diff;
      }, 12000);
      const bootPresents = getPaneRenderLog().length;
      stopPaneRenderLog();

      // Pane ids in DOM order: [image, diff].
      const ids = framePaneIds(hostId);
      const imageId = ids[0];
      const diffId = ids[1];

      // Form the page-wide selection AFTER settle. Anchor = first-selected.
      const store = getGlobalSelectionStore();
      startPaneRenderLog();
      if (anchorFirst === "diff") {
        store.select(diffId, "replace");
        store.select(imageId, "toggle");
      } else {
        store.select(imageId, "replace");
        store.select(diffId, "toggle");
      }
      // Let the adoption + re-render + present settle.
      await sleep(600);
      await raf();
      await sleep(200);
      const log = getPaneRenderLog();
      stopPaneRenderLog();

      const imagePresents = log.filter((r) => r.mode === "image" && !r.contentOpId && !r.hasSrcB);
      const orange = imagePresents.filter(isImageOrange);
      const sigs = new Set<string>(imagePresents.map(fullSig));

      root.unmount();
      __resetGlobalSelectionStoreForTest();
      note(
        `PHASE A (${hostId}, anchor=${anchorFirst}-first): boot presents=${bootPresents} (settled=${settled}), ` +
          `post-select image presents=${imagePresents.length}, ORANGE=${orange.length}`,
      );
      for (const s of sigs) note(`    image-sig: ${s}`);
      return { presents: log.length, imagePresents: imagePresents.length, orange: orange.length, sigs };
    };

    const diffAnchor = await runAdoption("m1", "diff");
    report(
      diffAnchor.presents > 0 && diffAnchor.imagePresents >= 0,
      `real stack ran on GPU (pool logged ${diffAnchor.presents} presents post-select — NOT a CPU fallback)`,
    );
    const imageAnchor = await runAdoption("m2", "image");
    report(imageAnchor.orange === 0, `CONTROL image-anchor selection: image stays plain (orange=${imageAnchor.orange})`);
    report(
      diffAnchor.orange === 0,
      `SYNC-ADOPTION diff-anchor selection: plain image is NOT false-colored by the diff's magma (orange=${diffAnchor.orange})`,
    );
    if (diffAnchor.orange > 0) allOk = false;

    // ======================= PHASE B — STACKED FLIP STORM ===================
    const hostB = document.getElementById("m1")!;
    hostB.style.cssText = "width:520px;height:280px;background:#222";
    const rootB: Root = createRoot(hostB);
    rootB.render(createElement(PlotApp, { descriptor: stackedGrid() }));
    const upB = await waitFor(() => document.querySelectorAll("#m1 [role='tab']").length >= 2, 12000);
    report(upB, `stacked [image, FLIP] grid renders a 2-tab strip`);
    // Hover so the stack keyboard is in scope.
    document
      .querySelector<HTMLElement>("#m1 [data-cairn-grid-root]")
      ?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
    // Warm both slots (resolve cache) so flips are synchronous hits.
    key("2");
    await waitFor(() => activeIdx("m1") === 1, 4000);
    await sleep(200);
    key("1");
    await waitFor(() => activeIdx("m1") === 0, 4000);
    await sleep(200);

    let seed = 0x9e3779b9 >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 0x100000000);
    let stormOrange = 0;
    let stormTotal = 0;
    let stormImageScalar = 0;
    const REPEATS = 3;
    for (let rep = 0; rep < REPEATS; rep++) {
      startPaneRenderLog();
      for (let i = 0; i < 80; i++) {
        const wantIdx = rnd() < 0.5 ? 1 : 0;
        key(wantIdx === 1 ? "2" : "1");
        await raf();
        if (rnd() < 0.4) {
          key(activeIdx("m1") === 1 ? "1" : "2"); // a second flip inside a frame
        }
      }
      await sleep(300);
      const log = getPaneRenderLog();
      stopPaneRenderLog();
      stormTotal += log.length;
      const orange = log.filter(isImageOrange).length;
      stormOrange += orange;
      stormImageScalar += log.filter((r) => r.mode === "image" && r.isScalar === true).length;
      note(`PHASE B stacked storm rep${rep + 1}: ${log.length} presents, ORANGE=${orange}`);
    }
    rootB.unmount();
    report(
      stormTotal > 0,
      `stacked storm produced GPU presents (${stormTotal} across ${REPEATS} reps; image-scalar=${stormImageScalar})`,
    );
    report(stormOrange === 0, `stacked flip storm: no orange image presents (${stormOrange})`);
    if (stormOrange > 0) allOk = false;

    // ============ PHASE C — DIFFERENTIAL: the fix is PRECISELY scoped =========
    // A plain image in a real sync group must STILL adopt a SAME-KIND image
    // colormap pick (a patch with NO `compareMode`) — else the fix over-scoped and
    // broke same-content-kind sync. And it must IGNORE a DIFF patch (compareMode
    // "diff"). Drives the bus directly (an external "peer" publish) against a live,
    // selected, subscribed image pane.
    const hostC = document.getElementById("m2")!;
    hostC.style.cssText = "width:520px;height:280px;background:#222";
    const rootC: Root = createRoot(hostC);
    rootC.render(
      createElement(PlotApp, {
        descriptor: {
          mode: "local",
          root: {
            kind: "grid",
            cols: 2,
            gap: 8,
            children: [imageLeaf("runtime:img", "Image"), imageLeaf("runtime:img2", "Image2")],
          },
        } as unknown as PlotDescriptor,
      }),
    );
    await waitFor(() => framePaneIds("m2").length >= 2, 12000);
    const idsC = framePaneIds("m2");
    const storeC = getGlobalSelectionStore();
    // Select BOTH images (image[0] anchor). The non-anchor image[1] subscribes to
    // the group and is the receiver we probe.
    storeC.select(idsC[0], "replace");
    storeC.select(idsC[1], "toggle");
    await sleep(400);
    const grp = `${GLOBAL_SELECTION_BASE}-st`;

    const observeAfter = async (
      publish: () => void,
      settleMs = 400,
    ): Promise<{ orange: number; total: number }> => {
      startPaneRenderLog();
      publish();
      await sleep(settleMs);
      await raf();
      const log = getPaneRenderLog();
      stopPaneRenderLog();
      const img = log.filter((r) => r.mode === "image" && !r.contentOpId && !r.hasSrcB);
      return { orange: img.filter(isImageOrange).length, total: img.length };
    };

    // (1) SAME-KIND image colormap pick (no compareMode) → MUST adopt → orange.
    const sameKind = await observeAfter(() =>
      publishImageSettings(grp, "ext-image-peer", { encoding: "magma", colormap: "magma" }),
    );
    note(`PHASE C same-kind image colormap patch: image presents=${sameKind.total}, ORANGE=${sameKind.orange}`);
    report(
      sameKind.orange > 0,
      `same-content-kind colormap sync STILL works (an image colormap pick is adopted): orange=${sameKind.orange}`,
    );
    if (sameKind.orange === 0) allOk = false;

    // (2) Reset to a light curve (same-kind) → image goes plain again.
    await observeAfter(() =>
      publishImageSettings(grp, "ext-image-peer", { encoding: "srgb", colormap: "none" }),
    );
    // (3) DIFF patch (compareMode "diff") → MUST be ignored → stays plain.
    const diffPatch = await observeAfter(() =>
      publishImageSettings(grp, "ext-diff-peer", {
        encoding: "magma",
        colormap: "magma",
        compareMode: "diff",
        diffKernel: "flip",
      }),
    );
    note(`PHASE C diff-patch (compareMode:diff): image presents=${diffPatch.total}, ORANGE=${diffPatch.orange}`);
    report(
      diffPatch.orange === 0,
      `a DIFF peer's scalar colormap is NOT adopted by a plain image (orange=${diffPatch.orange})`,
    );
    if (diffPatch.orange > 0) allOk = false;
    rootC.unmount();
    __resetGlobalSelectionStoreForTest();

    // ============ PHASE D — REAL-PATH PAINT ATOMICITY (the acceptance metric) ===
    // Drive the REAL tree (PlotApp→GridView→NodeDispatch→LeafView→GpuImagePane)
    // through an image↔diff stacked flip storm FASTER than the frame rate and count
    // PAINTED FRAMES that show the outgoing slot after a flip committed — the
    // reported flash. Unlike the pane-level `stacked-diff-flip-paint` harness (which
    // drives the pane's props DIRECTLY = one commit, so it measured 0), THIS exercises
    // the LeafView async-resolve two-commit path where the flash actually lives.
    //
    // MEASUREMENT. The pane records (paint-phase log) a per-flip commit marker + the
    // new slot's first SUBMIT, `performance.now()`-stamped; a free-running rAF loop
    // records every browser PAINT boundary. For an image→DIFF flip (target kind
    // "diff", unambiguous) a paint strictly between the flip keydown and the first
    // "diff" submit = a stale painted frame. We measure PRE-FIX (sync-resolve toggled
    // OFF → the async two-commit resolve, the coordinator's mechanism) and POST-FIX
    // (sync-resolve during-render + diff-pair prefetch) with the SAME driver, plus
    // `staleDiffHolds` (LeafView's stale-window counter) and the render-log
    // pipeline-mismatch oracle. Acceptance of the USER's symptom remains the user's
    // own re-test — this proves the mechanism the pivot named is closed on the real
    // path, not that the pixel the user sees is fixed.
    const measureRealPath = async (
      hostId: string,
      disabled: boolean,
    ): Promise<{ measured: number; stale: number; preStale: number; holds: number; mismatch: number; presents: number }> => {
      (window as unknown as { __cairnDisableSyncResolve?: boolean }).__cairnDisableSyncResolve = disabled;
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:520px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: stackedGrid() }));
      await waitFor(() => document.querySelectorAll(`#${hostId} [role='tab']`).length >= 2, 12000);
      host
        .querySelector<HTMLElement>("[data-cairn-grid-root]")
        ?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      // Warm BOTH slots (resident flips; also lets the diff-pair prefetch settle).
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000);
      await sleep(250);
      key("1");
      await waitFor(() => activeIdx(hostId) === 0, 4000);
      await sleep(250);

      const stats = (window as unknown as { __cairnLeafResolveStats?: { staleDiffHolds: number; placeholderMounts: number } })
        .__cairnLeafResolveStats;
      if (stats) {
        stats.staleDiffHolds = 0;
        stats.placeholderMounts = 0;
      }

      let collecting = true;
      const paints: number[] = [];
      const paintLoop = (): void => {
        paints.push(performance.now());
        if (collecting) requestAnimationFrame(paintLoop);
      };
      requestAnimationFrame(paintLoop);

      startPaneRenderLog();
      startPaintPhaseLog();
      const flips: { t: number; target: "image" | "diff" }[] = [];
      const ITER = 120;
      for (let i = 0; i < ITER; i++) {
        const toDiff = activeIdx(hostId) === 0;
        flips.push({ t: performance.now(), target: toDiff ? "diff" : "image" });
        key(toDiff ? "2" : "1");
        await sleep(4); // ~4ms task gap vs ~16ms paint = the fast-flip artefact window
      }
      await sleep(400);
      collecting = false;
      const paintLog = getPaintPhaseLog();
      const renderLog = getPaneRenderLog();
      stopPaintPhaseLog();
      stopPaneRenderLog();
      root.unmount();
      (window as unknown as { __cairnDisableSyncResolve?: boolean }).__cairnDisableSyncResolve = false;

      // First submit per content epoch, time-ordered; then the diff-kind ones.
      const firstSubmit = new Map<number, PaintPhaseRecord>();
      for (const r of paintLog) if (r.submitted && !firstSubmit.has(r.epoch)) firstSubmit.set(r.epoch, r);
      const diffSubmits = [...firstSubmit.values()]
        .filter((s) => s.kind === "diff")
        .map((s) => s.t)
        .sort((a, b) => a - b);
      // Pair each image→diff flip with the next diff submit at/after its keydown;
      // a paint boundary strictly in that window is a stale first painted frame.
      let measured = 0;
      let stale = 0;
      let di = 0;
      for (const f of flips) {
        if (f.target !== "diff") continue;
        while (di < diffSubmits.length && diffSubmits[di] < f.t - 0.01) di++;
        if (di >= diffSubmits.length) break;
        const ready = diffSubmits[di];
        di++;
        measured++;
        if (paints.some((p) => p > f.t + 0.01 && p < ready - 0.01)) stale++;
      }
      const mismatch = renderLog.filter(isPipelineMismatch).length;
      const holds = stats ? stats.staleDiffHolds : -1;
      note(
        `PHASE D real-path (${hostId}, sync-resolve ${disabled ? "DISABLED=pre-fix" : "ENABLED=post-fix"}): ` +
          `measured ${measured} img→diff flips, STALE painted frames=${stale}, staleDiffHolds=${holds}, ` +
          `pipeline-mismatch presents=${mismatch}, total presents=${renderLog.length}`,
      );
      return { measured, stale, preStale: 0, holds, mismatch, presents: renderLog.length };
    };

    const preFix = await measureRealPath("rpD-pre", true);
    const postFix = await measureRealPath("rpD-post", false);

    // PRE-FIX must exercise the stale window (the harness detects the bug it guards):
    // the async two-commit resolve holds the previous slot at least once per
    // image→diff flip (`staleDiffHolds > 0`) and paints at least one stale frame.
    report(
      preFix.holds > 0,
      `PRE-FIX (sync-resolve OFF) exercises the stale-diff window: staleDiffHolds=${preFix.holds} (>0), stale painted frames=${preFix.stale}`,
    );
    // POST-FIX acceptance: zero stale painted frames, zero stale-diff holds on
    // resident flips, zero pipeline-mismatch presents.
    report(postFix.measured >= 20, `POST-FIX storm exercised real resident img→diff flips (${postFix.measured})`);
    report(
      postFix.stale === 0,
      `POST-FIX: ZERO stale painted frames on real-path img→diff flips (${postFix.stale} of ${postFix.measured}; pre-fix ${preFix.stale})`,
    );
    report(postFix.holds === 0, `POST-FIX: ZERO stale-diff holds on resident flips (${postFix.holds}; pre-fix ${preFix.holds})`);
    report(postFix.mismatch === 0, `POST-FIX: ZERO pipeline-mismatch presents (identity blit while a compare is intended) (${postFix.mismatch})`);
    if (postFix.stale !== 0 || postFix.holds !== 0 || postFix.mismatch !== 0 || postFix.measured < 20) allOk = false;

    report(allOk, `real-stack GPU: sync-adoption fixed + precisely scoped + stacked flip orange-free + real-path paint-atomic`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
