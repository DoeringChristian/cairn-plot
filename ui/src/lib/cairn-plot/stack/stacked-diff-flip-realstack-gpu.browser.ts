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
  isEncodingGenerationMismatch,
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
  // A k=1 SCALAR float source (a ramp) for the authored-colormap encoding-lag test.
  const scalar = new Float32Array(32 * 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) scalar[y * 32 + x] = x / 31;
  registerRuntimeEntries({
    "runtime:img": mk(lightRGB(0.85, (x) => 0.1 * (x / 31))),
    "runtime:img2": mk(lightRGB(0.88, (_x, y) => 0.09 * (y / 31))),
    "runtime:ref": mk(lightRGB(0.8, (_x, y) => 0.15 * (y / 31))),
    "runtime:fg": mk(lightRGB(0.82, (x) => 0.13 * (x / 31))),
    "runtime:scalar": { kind: "float" as const, data: scalar, shape: [32, 32], dtype: "<f4", precision: "f32" as const },
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
// A stacked grid whose slot 0 is a k=1 SCALAR float image AUTHORED with colormap
// "magma" (the reported OFFICIAL-FLIP slot) and slot 1 a plain RGB image — flipping
// to slot 0 must NEVER paint a frame without magma (the encoding-generation lag).
const magmaScalarLeaf = (label: string) => ({
  kind: "plot" as const,
  renderer: "image",
  data: imghdr("runtime:scalar"),
  props: { toolbar: true, label, colormap: "magma" },
});
function stackedScalarMagmaGrid(): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode: "stacked",
      children: [magmaScalarLeaf("Magma scalar"), imageLeaf("runtime:img", "Image")],
    },
  } as unknown as PlotDescriptor;
}
// A SINGLE compare in a given authored mode (reg 1: HOME must restore this mode
// after the user switches away).
const compareNode = (mode: "diff" | "split", label: string) => ({
  kind: "compare" as const,
  mode,
  a: imghdr("runtime:ref"),
  b: imghdr("runtime:fg"),
  diffSubmode: "flip",
  props: { toolbar: true, label },
});
function singleCompareGrid(mode: "diff" | "split"): PlotDescriptor {
  return {
    mode: "local",
    root: { kind: "grid", cols: 1, gap: 8, children: [compareNode(mode, "Cmp")] },
  } as unknown as PlotDescriptor;
}
// A plain SCALAR float image (k=1) with NO authored colormap (its default curve).
const scalarPlainLeaf = (label: string) => ({
  kind: "plot" as const,
  renderer: "image",
  data: imghdr("runtime:scalar"),
  props: { toolbar: true, label },
});
// Two scalar slots with DISTINCT authored defaults (slot0 magma, slot1 none) — the
// stack-shared-settings test (reg 2): a pick applies to BOTH, HOME on a slot adopts
// THAT slot's authored default stack-wide, exit to grid restores per-image defaults.
function stackedTwoScalarGrid(): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode: "stacked",
      children: [magmaScalarLeaf("Magma scalar"), scalarPlainLeaf("Plain scalar")],
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

// The compare (`__cairnImageDiffProbe`) / image (`__cairnImagePaneProbe`) test
// seams the ACTIVE reused pane publishes — re-queried each call so a getter reads
// the LIVE state (each render replaces the seam object with fresh closures).
interface DiffProbe {
  compareMode: "diff" | "split" | "blend";
  colormap: string;
  changeCompareMode: (m: "diff" | "split" | "blend") => void;
  changeColormap: (id: string) => void;
  home: () => void;
}
interface ImgProbe {
  encodingId: string;
  colormap: string;
  inStack: boolean;
  changeEncoding: (id: string) => void;
  home: () => void;
}
function findProbe<T>(hostId: string, key: string): T | null {
  const host = document.getElementById(hostId);
  if (!host) return null;
  for (const el of Array.from(host.querySelectorAll("*")) as unknown as Array<Record<string, unknown>>) {
    if (el[key]) return el[key] as T;
  }
  return null;
}
// ALL image-pane seams under a host (normal grid → one per cell), in DOM order.
function allImgProbes(hostId: string): ImgProbe[] {
  const host = document.getElementById(hostId);
  if (!host) return [];
  const out: ImgProbe[] = [];
  for (const el of Array.from(host.querySelectorAll("*")) as unknown as Array<Record<string, unknown>>) {
    if (el.__cairnImagePaneProbe) out.push(el.__cairnImagePaneProbe as ImgProbe);
  }
  return out;
}
const diffProbe = (hostId: string) => findProbe<DiffProbe>(hostId, "__cairnImageDiffProbe");
const imgProbe = (hostId: string) => findProbe<ImgProbe>(hostId, "__cairnImagePaneProbe");

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

    // ============ PHASE E — AUTHORED-COLORMAP ENCODING GENERATION ============
    // A stacked [magma-scalar image, plain image] grid: flipping to the authored-
    // magma slot must never paint a frame with NO colormap bound (the encoding
    // reseed landing a commit late = raw gray-none for one frame). The render-log
    // `isEncodingGenerationMismatch` tripwire asserts ZERO such presents now that the
    // encoding derivation is commit-synchronous.
    {
      const host = document.createElement("div");
      host.id = "rpE";
      host.style.cssText = "width:520px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: stackedScalarMagmaGrid() }));
      await waitFor(() => document.querySelectorAll("#rpE [role='tab']").length >= 2, 12000);
      host
        .querySelector<HTMLElement>("[data-cairn-grid-root]")
        ?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      key("2");
      await waitFor(() => activeIdx("rpE") === 1, 4000);
      await sleep(250);
      key("1");
      await waitFor(() => activeIdx("rpE") === 0, 4000);
      await sleep(250);
      startPaneRenderLog();
      for (let i = 0; i < 100; i++) {
        key(activeIdx("rpE") === 0 ? "2" : "1");
        await sleep(4);
      }
      await sleep(400);
      const log = getPaneRenderLog();
      stopPaneRenderLog();
      root.unmount();
      const encMiss = log.filter(isEncodingGenerationMismatch).length;
      const magmaPresents = log.filter((r) => r.mode === "image" && r.authoredColormap === true).length;
      note(`PHASE E magma-scalar flip storm: ${log.length} presents, magma-slot image presents=${magmaPresents}, encoding-gen mismatches=${encMiss}`);
      report(magmaPresents >= 5, `PHASE E exercised the authored-magma scalar slot (${magmaPresents} presents)`);
      report(encMiss === 0, `PHASE E: ZERO encoding-generation mismatches — authored magma never drops to gray-none on a flip (${encMiss})`);
      if (encMiss !== 0 || magmaPresents < 5) allOk = false;
    }

    // ============ PHASE F — HOME RESTORES THE AUTHORED COMPARE MODE (reg 1) ======
    // A compare authored `mode:"diff"`: the user switches to SPLIT, then HOME/dbl-
    // click. HOME must restore the DESCRIPTOR mode (diff). The view-mode is HOISTED
    // into `useCompareControl` (out of the pane's HOME reach), so pre-fix HOME left
    // it stuck in split. `__cairnDisableCompareHomeReset` toggles pre/post-fix in one
    // run: pre-fix HOME leaves split (bug), post-fix restores diff.
    const runHomeMode = async (
      hostId: string,
      authored: "diff" | "split",
      switchTo: "diff" | "split",
      disable: boolean,
    ): Promise<{ afterSwitch: string; afterHome: string }> => {
      (window as unknown as { __cairnDisableCompareHomeReset?: boolean }).__cairnDisableCompareHomeReset = disable;
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:420px;height:260px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: singleCompareGrid(authored) }));
      await waitFor(() => !!diffProbe(hostId), 12000);
      await sleep(200);
      diffProbe(hostId)!.changeCompareMode(switchTo);
      await waitFor(() => diffProbe(hostId)?.compareMode === switchTo, 4000);
      const afterSwitch = diffProbe(hostId)?.compareMode ?? "?";
      diffProbe(hostId)!.home();
      await sleep(400);
      await raf();
      const afterHome = diffProbe(hostId)?.compareMode ?? "?";
      root.unmount();
      host.remove();
      (window as unknown as { __cairnDisableCompareHomeReset?: boolean }).__cairnDisableCompareHomeReset = false;
      note(`PHASE F (authored=${authored}, switch→${switchTo}, ${disable ? "pre-fix" : "post-fix"}): afterSwitch=${afterSwitch}, afterHome=${afterHome}`);
      return { afterSwitch, afterHome };
    };

    const fPre = await runHomeMode("hfPre", "diff", "split", true);
    report(fPre.afterSwitch === "split", `PHASE F setup: mode switched diff→split (${fPre.afterSwitch})`);
    report(fPre.afterHome === "split", `PHASE F PRE-FIX: HOME does NOT restore the authored mode — stuck in split (bug reproduced: ${fPre.afterHome})`);
    const fPost = await runHomeMode("hfPost", "diff", "split", false);
    report(fPost.afterHome === "diff", `PHASE F POST-FIX: HOME restores the authored DIFF mode after a switch to split (${fPost.afterHome})`);
    const fPost2 = await runHomeMode("hfPost2", "split", "diff", false);
    report(fPost2.afterHome === "split", `PHASE F POST-FIX (reverse): authored SPLIT restored after a switch to diff + HOME (${fPost2.afterHome})`);
    if (fPost.afterHome !== "diff" || fPost2.afterHome !== "split") allOk = false;

    // ============ PHASE G — STACK-WIDE SHARED DISPLAY SETTINGS (reg 2) ===========
    // The stack owns ONE shared settings object: a pick anywhere applies to EVERY
    // slot + survives flips; each image's authored props are SEEDS only; HOME on a
    // slot makes the stack adopt THAT slot's authored defaults; leaving stacked mode
    // discards the shared settings (each pane reverts to its own authored defaults).
    // Grid: [magma-scalar (slot0, authored magma), plain-scalar (slot1, no colormap)].
    const clickGridMode = (hostId: string, m: "normal" | "stacked"): void => {
      document
        .querySelector<HTMLElement>(`#${hostId} [data-cairn-grid-mode="${m}"]`)
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    };
    interface GResult {
      seed0: string; // slot0 initial (its authored magma seeds the stack)
      slot1Shared: string; // flip to slot1 → the SHARED setting (magma), not slot1's own
      slot0AfterPick: string; // pick turbo on slot1, flip to slot0 → turbo (applies to all)
      slot1Back: string; // flip back to slot1 → turbo (survives)
      slot0Home: string; // HOME on slot0 → magma (slot0 authored)
      slot1AfterHome: string; // flip to slot1 → magma (shared = slot0 default post-HOME)
      exit0: string; // exit stacked → slot0 pane shows its authored magma
      exit1: string; // exit stacked → slot1 pane shows its own authored default (NOT magma)
    }
    const runG1 = async (hostId: string, disable: boolean): Promise<GResult> => {
      (window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared = disable;
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:460px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: stackedTwoScalarGrid() }));
      await waitFor(() => document.querySelectorAll(`#${hostId} [role='tab']`).length >= 2, 12000);
      host.querySelector<HTMLElement>("[data-cairn-grid-root]")?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      await waitFor(() => activeIdx(hostId) === 0 && !!imgProbe(hostId), 4000);
      await sleep(150);
      const seed0 = imgProbe(hostId)?.encodingId ?? "?";
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000);
      await sleep(200);
      const slot1Shared = imgProbe(hostId)?.encodingId ?? "?";
      imgProbe(hostId)!.changeEncoding("turbo"); // a pick on slot1
      await waitFor(() => imgProbe(hostId)?.encodingId === "turbo", 4000);
      key("1");
      await waitFor(() => activeIdx(hostId) === 0, 4000);
      await sleep(200);
      const slot0AfterPick = imgProbe(hostId)?.encodingId ?? "?";
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000);
      await sleep(150);
      const slot1Back = imgProbe(hostId)?.encodingId ?? "?";
      // HOME on slot0 → the stack adopts slot0's authored defaults (magma).
      key("1");
      await waitFor(() => activeIdx(hostId) === 0, 4000);
      await sleep(150);
      imgProbe(hostId)!.home();
      await sleep(250);
      const slot0Home = imgProbe(hostId)?.encodingId ?? "?";
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000);
      await sleep(150);
      const slot1AfterHome = imgProbe(hostId)?.encodingId ?? "?";
      // EXIT stacked → grid layout: each pane reverts to its OWN authored defaults.
      clickGridMode(hostId, "normal");
      await waitFor(() => allImgProbes(hostId).length >= 2, 8000);
      await sleep(250);
      const probes = allImgProbes(hostId);
      const exit0 = probes[0]?.encodingId ?? "?";
      const exit1 = probes[1]?.encodingId ?? "?";
      root.unmount();
      host.remove();
      (window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared = false;
      note(
        `PHASE G1 (${disable ? "pre-fix" : "post-fix"}): seed0=${seed0} slot1Shared=${slot1Shared} ` +
          `slot0AfterPick=${slot0AfterPick} slot1Back=${slot1Back} slot0Home=${slot0Home} ` +
          `slot1AfterHome=${slot1AfterHome} exit0=${exit0} exit1=${exit1}`,
      );
      return { seed0, slot1Shared, slot0AfterPick, slot1Back, slot0Home, slot1AfterHome, exit0, exit1 };
    };

    // -- G2: the diff colormap is a shared stack field too — it survives an
    // image↔diff flip (pick turbo on the diff, flip to the image and back). --
    const runG2 = async (hostId: string, disable: boolean): Promise<{ picked: string; afterFlip: string }> => {
      (window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared = disable;
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:460px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: stackedGrid() }));
      await waitFor(() => document.querySelectorAll(`#${hostId} [role='tab']`).length >= 2, 12000);
      host.querySelector<HTMLElement>("[data-cairn-grid-root]")?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      key("2");
      await waitFor(() => activeIdx(hostId) === 1 && !!diffProbe(hostId), 4000);
      await sleep(150);
      diffProbe(hostId)!.changeColormap("turbo");
      await waitFor(() => diffProbe(hostId)?.colormap === "turbo", 4000);
      const picked = diffProbe(hostId)?.colormap ?? "?";
      key("1");
      await waitFor(() => activeIdx(hostId) === 0, 4000);
      await sleep(150);
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000);
      await sleep(200);
      const afterFlip = diffProbe(hostId)?.colormap ?? "?";
      root.unmount();
      host.remove();
      (window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared = false;
      note(`PHASE G2 (${disable ? "pre-fix" : "post-fix"}): diff picked=${picked} afterFlip=${afterFlip}`);
      return { picked, afterFlip };
    };

    const g1Pre = await runG1("g1Pre", true);
    report(g1Pre.seed0 === "magma", `PHASE G1 setup: slot0's authored magma seeds the stack (${g1Pre.seed0})`);
    report(
      g1Pre.slot0AfterPick !== "turbo",
      `PHASE G1 PRE-FIX: a pick does NOT apply stack-wide — slot0 reseeds to its own authored (bug reproduced: ${g1Pre.slot0AfterPick})`,
    );
    const g1 = await runG1("g1Post", false);
    report(g1.slot1Shared === "magma", `PHASE G1: every slot renders under the SHARED setting (slot1 shows slot0's magma seed: ${g1.slot1Shared})`);
    report(g1.slot0AfterPick === "turbo", `PHASE G1: a pick on slot1 applies to ALL slots (slot0 now turbo: ${g1.slot0AfterPick})`);
    report(g1.slot1Back === "turbo", `PHASE G1: the pick SURVIVES flips (slot1 still turbo: ${g1.slot1Back})`);
    report(g1.slot0Home === "magma", `PHASE G1: HOME on slot0 → stack adopts slot0's authored default (${g1.slot0Home})`);
    report(g1.slot1AfterHome === "magma", `PHASE G1: post-HOME the shared setting is slot0's default everywhere (slot1: ${g1.slot1AfterHome})`);
    report(g1.exit0 === "magma", `PHASE G1: exit stacked → slot0 pane shows its authored magma (${g1.exit0})`);
    report(g1.exit1 !== "magma", `PHASE G1: exit stacked → slot1 pane reverts to its OWN authored default, not the shared magma (${g1.exit1})`);
    if (
      g1.slot1Shared !== "magma" || g1.slot0AfterPick !== "turbo" || g1.slot1Back !== "turbo" ||
      g1.slot0Home !== "magma" || g1.slot1AfterHome !== "magma" || g1.exit0 !== "magma" || g1.exit1 === "magma"
    ) allOk = false;

    const g2Pre = await runG2("g2Pre", true);
    report(g2Pre.afterFlip !== "turbo", `PHASE G2 PRE-FIX: the diff colormap pick is WIPED by an image↔diff flip (bug reproduced: ${g2Pre.afterFlip})`);
    const g2 = await runG2("g2Post", false);
    report(g2.afterFlip === "turbo", `PHASE G2 POST-FIX: the diff colormap pick SURVIVES an image↔diff flip (${g2.afterFlip})`);
    if (g2.afterFlip !== "turbo") allOk = false;

    report(allOk, `real-stack GPU: sync-adoption fixed + precisely scoped + stacked flip orange-free + real-path paint-atomic + authored-colormap stable + HOME restores compare mode + stack-wide shared display settings`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
