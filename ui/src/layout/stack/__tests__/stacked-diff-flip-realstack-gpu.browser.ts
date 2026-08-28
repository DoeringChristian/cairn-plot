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
 * ONLY by the lazy `plot-gpu-image-addon` bundle, which a source harness never
 * loads. THE FIX (below): register the seam ourselves, exactly as the addon does
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
 *   carries its scalar colormap encoding; the
 *   non-anchor plain image adopts the group snapshot via `applyRemoteSettings`,
 *   which applies that LUT encoding unconditionally to the light image.
 *   This is precisely the timing the pane-level FSYNC probe missed: it formed the
 *   group at MOUNT (before the diff resolved its display default), so the anchor
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
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../../plots/register-core";
import type { PlotSpec } from "../../../host/descriptor-resolver";
import { getSharedWebGpuDevice } from "../../../engines/webgpu/device-provider.ts";
import { registerRuntimeEntries } from "../../../resources/data/runtime-store";
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
} from "../../../plots/image/engine/test-hooks";
import {
  getGlobalSelectionStore,
  __resetGlobalSelectionStoreForTest,
} from "../../../state/selection/selection-store";
import { getRegisteredPane } from "../../../state/selection/pane-registry";
import { createHarness, sleep, waitFor } from "../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "REALSTACK GPU" });

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

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

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
  type: "image",
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

function sideBySideGrid(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      children: [imageLeaf("runtime:img", "Image"), diffCompare("Diff")],
    },
  } as unknown as PlotSpec;
}
function stackedGrid(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode: "stacked",
      children: [imageLeaf("runtime:img", "Image"), diffCompare("Diff")],
    },
  } as unknown as PlotSpec;
}
// A stacked grid whose slot 0 is a k=1 SCALAR float image AUTHORED with colormap
// "magma" (the reported OFFICIAL-FLIP slot) and slot 1 a plain RGB image — flipping
// to slot 0 must NEVER paint a frame without magma (the encoding-generation lag).
const magmaScalarLeaf = (label: string) => ({
  kind: "plot" as const,
  type: "image",
  data: imghdr("runtime:scalar"),
  props: { toolbar: true, label, colormap: "magma" },
});
function stackedScalarMagmaGrid(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode: "stacked",
      children: [magmaScalarLeaf("Magma scalar"), imageLeaf("runtime:img", "Image")],
    },
  } as unknown as PlotSpec;
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
function singleCompareGrid(mode: "diff" | "split"): PlotSpec {
  return {
    mode: "local",
    root: { kind: "grid", cols: 1, gap: 8, children: [compareNode(mode, "Cmp")] },
  } as unknown as PlotSpec;
}
// A plain SCALAR float image (k=1) with NO authored colormap (its default curve).
const scalarPlainLeaf = (label: string) => ({
  kind: "plot" as const,
  type: "image",
  data: imghdr("runtime:scalar"),
  props: { toolbar: true, label },
});
// Two scalar slots with DISTINCT authored defaults (slot0 magma, slot1 none) — the
// stack-shared-settings test (reg 2): a pick applies to BOTH, HOME on a slot adopts
// THAT slot's authored default stack-wide, exit to grid restores per-image defaults.
function stackedTwoScalarGrid(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode: "stacked",
      children: [magmaScalarLeaf("Magma scalar"), scalarPlainLeaf("Plain scalar")],
    },
  } as unknown as PlotSpec;
}
// Two scalar slots with DISTINCT authored PEAK values — the "shares settings BEYOND
// encoding" test (reg b): peak is a viewport setting too, so a pick persists across
// flips (post-fix) where the pre-fix per-flip reseed would reset it to each slot's
// authored peak.
const peakScalarLeaf = (label: string, peak: number) => ({
  kind: "plot" as const,
  type: "image",
  data: imghdr("runtime:scalar"),
  props: { toolbar: true, label, peak },
});
function stackedTwoPeakGrid(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode: "stacked",
      children: [peakScalarLeaf("Peak 8", 8), peakScalarLeaf("Peak 3", 3)],
    },
  } as unknown as PlotSpec;
}
// The SAME two distinct-default scalar slots, but a NORMAL side-by-side grid — TWO
// separate cells (each its own settings), for the HOME-while-selected locality
// test (reg a): multi-select syncs settings BETWEEN them, but HOME on one is LOCAL.
function sideBySideTwoScalarGrid(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      children: [magmaScalarLeaf("Magma scalar"), scalarPlainLeaf("Plain scalar")],
    },
  } as unknown as PlotSpec;
}
// A DIFF compare authored with a specific kernel + NO colormap prop (so its display
// colormap uses the shared diff default). Two side-by-side DIFF cells with
// distinct kernels drive the state-
// unification scenario 1: the diff colormap is the viewport's ONE display encoding,
// so HOME (double-click) on one resets it to the shared diff default while a
// multi-select neighbour keeps the mirrored pick.
const diffCompareKernel = (label: string, submode: string) => ({
  kind: "compare" as const,
  mode: "diff" as const,
  a: imghdr("runtime:ref"),
  b: imghdr("runtime:fg"),
  diffSubmode: submode,
  props: { toolbar: true, label },
});
function sideBySideTwoDiffGrid(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      children: [diffCompareKernel("FLIP", "flip"), diffCompareKernel("Abs", "absolute")],
    },
  } as unknown as PlotSpec;
}
// THREE side-by-side DIFF cells with DISTINCT kernels (flip → magma, ssim →
// magma, absolute → turbo) — the served report's exact `FLIP vs SSIM vs absolute`
// grid. Drives PHASE L: under the settings-model simplification (ruling 3) a
// page-wide 3-diff multi-select MIRRORS the first viewport's kernel to the others
// on formation — the diff-face `settingsSnapshot` carries `diffKernel` by value
// and every receiver adopts it. This phase pins that at THREE distinct kernels.
function sideBySideThreeDiffGrid(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 3,
      gap: 8,
      children: [
        diffCompareKernel("FLIP", "flip"),
        diffCompareKernel("SSIM", "ssim"),
        diffCompareKernel("Abs", "absolute"),
      ],
    },
  } as unknown as PlotSpec;
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
  diffKernel: string;
  changeCompareMode: (m: "diff" | "split" | "blend") => void;
  changeColormap: (id: string) => void;
  changeDiffKernel: (id: string) => void;
  home: () => void;
}
interface ImgProbe {
  encodingId: string;
  colormap: string;
  peak: number;
  changeEncoding: (id: string) => void;
  changePeak: (v: number) => void;
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
// ALL compare-pane seams under a host (normal grid of diffs → one per cell), DOM order.
function allDiffProbes(hostId: string): DiffProbe[] {
  const host = document.getElementById(hostId);
  if (!host) return [];
  const out: DiffProbe[] = [];
  for (const el of Array.from(host.querySelectorAll("*")) as unknown as Array<Record<string, unknown>>) {
    if (el.__cairnImageDiffProbe) out.push(el.__cairnImageDiffProbe as DiffProbe);
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
    await getSharedWebGpuDevice();
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
      }, 12000, 30);
      const bootPresents = getPaneRenderLog().length;
      stopPaneRenderLog();

      // Pane ids in DOM order: [image, diff].
      const ids = framePaneIds(hostId);
      const imageId = ids[0];
      const diffId = ids[1];

      // Difference operation and display encoding are independent. Give the
      // diff an explicit scalar encoding so this phase tests anchor adoption,
      // not a removed per-operation colormap default.
      allDiffProbes(hostId)[0]?.changeColormap("magma");
      await waitFor(() => allDiffProbes(hostId)[0]?.colormap === "magma", 4000, 30);

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
    // Settings-model simplification (ruling 3 + ruling 5): the FIRST viewport's
    // settings are applied to the others BY VALUE, and applicability is a RENDER
    // decision. A diff-anchored selection therefore MIRRORS the diff's scalar
    // colormap onto the plain image, which the GPU path reduces-and-false-colors
    // (isScalar:true → magma) — the former "non-adoption" oracle is retired.
    report(
      diffAnchor.orange > 0,
      `SYNC-ADOPTION diff-anchor selection: plain image ADOPTS the first viewport's (diff's) colormap by value (orange=${diffAnchor.orange})`,
    );
    if (diffAnchor.orange === 0) allOk = false;

    // ======================= PHASE B — STACKED FLIP STORM ===================
    const hostB = document.getElementById("m1")!;
    hostB.style.cssText = "width:520px;height:280px;background:#222";
    const rootB: Root = createRoot(hostB);
    rootB.render(createElement(PlotApp, { descriptor: stackedGrid() }));
    const upB = await waitFor(() => document.querySelectorAll("#m1 [role='tab']").length >= 2, 12000, 30);
    report(upB, `stacked [image, FLIP] grid renders a 2-tab strip`);
    // Hover so the stack keyboard is in scope.
    document
      .querySelector<HTMLElement>("#m1 [data-cairn-grid-root]")
      ?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
    // Warm both slots (resolve cache) so flips are synchronous hits.
    key("2");
    await waitFor(() => activeIdx("m1") === 1, 4000, 30);
    await sleep(200);
    key("1");
    await waitFor(() => activeIdx("m1") === 0, 4000, 30);
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

    // ============ PHASE C — BY-VALUE ADOPTION (no scoping) ====================
    // A plain image in a real sync group adopts ANY peer's colormap BY VALUE —
    // both a same-kind image pick AND a diff patch (ruling 5: no content-kind
    // scoping; applicability is a render decision). Drives the bus directly (an
    // external "peer" publish) against a live, selected, subscribed image pane.
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
        } as unknown as PlotSpec,
      }),
    );
    await waitFor(() => framePaneIds("m2").length >= 2, 12000, 30);
    const idsC = framePaneIds("m2");
    const storeC = getGlobalSelectionStore();
    // Select BOTH images (image[0] anchor). The non-anchor image[1] subscribes to
    // the group and is the receiver we probe.
    storeC.select(idsC[0], "replace");
    storeC.select(idsC[1], "toggle");
    await sleep(400);
    // OBJECT MODEL: an "external peer" is just another member — write through a
    // SELECTED pane's registered settings accessor; the group fan-out
    // delivers to the rest.
    const selectedPaneSet = (patch: Record<string, unknown>) => {
      const el = document.querySelector('[data-plot-pane-id][data-selected="true"]');
      const id = el?.getAttribute("data-plot-pane-id");
      const acc = id ? getRegisteredPane(id)?.settings : undefined;
      if (!acc) throw new Error("realstack: no selected pane to publish through");
      acc.set(patch);
    };

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
      selectedPaneSet({ "image.encoding": "magma" }),
    );
    note(`PHASE C same-kind image colormap patch: image presents=${sameKind.total}, ORANGE=${sameKind.orange}`);
    report(
      sameKind.orange > 0,
      `same-content-kind colormap sync STILL works (an image colormap pick is adopted): orange=${sameKind.orange}`,
    );
    if (sameKind.orange === 0) allOk = false;

    // (2) Reset to a light curve (same-kind) → image goes plain again.
    await observeAfter(() =>
      selectedPaneSet({ "image.encoding": "srgb" }),
    );
    // (3) DIFF patch (compareMode "diff") → adopted BY VALUE, same as any other
    // colormap (ruling 5: no scoping). The image false-colors → orange.
    const diffPatch = await observeAfter(() =>
      selectedPaneSet({
        "image.encoding": "magma",
        "compare.mode": "diff",
        "compare.kernel": "flip",
      }),
    );
    note(`PHASE C diff-patch (compareMode:diff): image presents=${diffPatch.total}, ORANGE=${diffPatch.orange}`);
    report(
      diffPatch.orange > 0,
      `a DIFF peer's scalar colormap IS adopted by a plain image, by value (orange=${diffPatch.orange})`,
    );
    if (diffPatch.orange === 0) allOk = false;
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
    // "diff" submit = a stale painted frame. `LeafView` now reads the resolve-cache
    // PURELY (`useSyncExternalStore`), so a warm/prefetched flip resolves the new slot
    // in the flip commit itself — there is ONE path (no `__cairnDisableSyncResolve`
    // pre/post toggle, no `staleDiffHolds` witness — the stale-operand frame is
    // structurally unrepresentable). The invariant is the "no stale-operand frame":
    // ZERO stale painted frames + ZERO pipeline-mismatch presents on resident flips.
    const measureRealPath = async (
      hostId: string,
    ): Promise<{ measured: number; stale: number; mismatch: number; presents: number }> => {
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:520px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: stackedGrid() }));
      await waitFor(() => document.querySelectorAll(`#${hostId} [role='tab']`).length >= 2, 12000, 30);
      host
        .querySelector<HTMLElement>("[data-cairn-grid-root]")
        ?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      // Warm BOTH slots (resident flips; also lets the diff-pair prefetch settle).
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000, 30);
      await sleep(250);
      key("1");
      await waitFor(() => activeIdx(hostId) === 0, 4000, 30);
      await sleep(250);

      const stats = (window as unknown as { __cairnLeafResolveStats?: { placeholderMounts: number } })
        .__cairnLeafResolveStats;
      if (stats) stats.placeholderMounts = 0;

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
      note(
        `PHASE D real-path (${hostId}): measured ${measured} img→diff flips, STALE painted frames=${stale}, ` +
          `pipeline-mismatch presents=${mismatch}, total presents=${renderLog.length}`,
      );
      return { measured, stale, mismatch, presents: renderLog.length };
    };

    // ONE path (subscribable resolve-cache). Acceptance: the storm exercises real
    // resident img→diff flips and paints NO stale-operand frame and NO pipeline
    // mismatch — the invariant that replaces the retired `staleDiffHolds` witness.
    const realPath = await measureRealPath("rpD");
    report(realPath.measured >= 20, `storm exercised real resident img→diff flips (${realPath.measured})`);
    report(
      realPath.stale === 0,
      `ZERO stale painted frames on real-path img→diff flips (${realPath.stale} of ${realPath.measured})`,
    );
    report(
      realPath.mismatch === 0,
      `ZERO pipeline-mismatch presents (identity blit while a compare is intended) (${realPath.mismatch})`,
    );
    if (realPath.stale !== 0 || realPath.mismatch !== 0 || realPath.measured < 20) allOk = false;

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
      await waitFor(() => document.querySelectorAll("#rpE [role='tab']").length >= 2, 12000, 30);
      host
        .querySelector<HTMLElement>("[data-cairn-grid-root]")
        ?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      key("2");
      await waitFor(() => activeIdx("rpE") === 1, 4000, 30);
      await sleep(250);
      key("1");
      await waitFor(() => activeIdx("rpE") === 0, 4000, 30);
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
      await waitFor(() => !!diffProbe(hostId), 12000, 30);
      await sleep(200);
      diffProbe(hostId)!.changeCompareMode(switchTo);
      await waitFor(() => diffProbe(hostId)?.compareMode === switchTo, 4000, 30);
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
      await waitFor(() => document.querySelectorAll(`#${hostId} [role='tab']`).length >= 2, 12000, 30);
      host.querySelector<HTMLElement>("[data-cairn-grid-root]")?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      await waitFor(() => activeIdx(hostId) === 0 && !!imgProbe(hostId), 4000, 30);
      await sleep(150);
      const seed0 = imgProbe(hostId)?.encodingId ?? "?";
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000, 30);
      await sleep(200);
      const slot1Shared = imgProbe(hostId)?.encodingId ?? "?";
      imgProbe(hostId)!.changeEncoding("turbo"); // a pick on slot1
      await waitFor(() => imgProbe(hostId)?.encodingId === "turbo", 4000, 30);
      key("1");
      await waitFor(() => activeIdx(hostId) === 0, 4000, 30);
      await sleep(200);
      const slot0AfterPick = imgProbe(hostId)?.encodingId ?? "?";
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000, 30);
      await sleep(150);
      const slot1Back = imgProbe(hostId)?.encodingId ?? "?";
      // HOME on slot0 → the stack adopts slot0's authored defaults (magma).
      key("1");
      await waitFor(() => activeIdx(hostId) === 0, 4000, 30);
      await sleep(150);
      imgProbe(hostId)!.home();
      await sleep(250);
      const slot0Home = imgProbe(hostId)?.encodingId ?? "?";
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000, 30);
      await sleep(150);
      const slot1AfterHome = imgProbe(hostId)?.encodingId ?? "?";
      // EXIT stacked → grid layout: each pane reverts to its OWN authored defaults.
      clickGridMode(hostId, "normal");
      await waitFor(() => allImgProbes(hostId).length >= 2, 8000, 30);
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
    const runG2 = async (hostId: string, disable: boolean): Promise<{ picked: string; imageShowsPick: string; afterFlip: string }> => {
      (window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared = disable;
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:460px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: stackedGrid() }));
      await waitFor(() => document.querySelectorAll(`#${hostId} [role='tab']`).length >= 2, 12000, 30);
      host.querySelector<HTMLElement>("[data-cairn-grid-root]")?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      key("2");
      await waitFor(() => activeIdx(hostId) === 1 && !!diffProbe(hostId), 4000, 30);
      await sleep(150);
      diffProbe(hostId)!.changeColormap("turbo");
      await waitFor(() => diffProbe(hostId)?.colormap === "turbo", 4000, 30);
      const picked = diffProbe(hostId)?.colormap ?? "?";
      key("1");
      await waitFor(() => activeIdx(hostId) === 0, 4000, 30);
      await sleep(150);
      // SCENARIO 2 (state-unification): while the SCALAR IMAGE slot is visible it must
      // show the SAME colormap the user picked on the diff — one viewport, one setting.
      // Pre-fix (two stores) the image slot keeps its own encoding; post-fix it adopts turbo.
      const imageShowsPick = imgProbe(hostId)?.colormap ?? "?";
      key("2");
      await waitFor(() => activeIdx(hostId) === 1, 4000, 30);
      await sleep(200);
      const afterFlip = diffProbe(hostId)?.colormap ?? "?";
      root.unmount();
      host.remove();
      (window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared = false;
      note(`PHASE G2 (${disable ? "pre-fix" : "post-fix"}): diff picked=${picked} imageShowsPick=${imageShowsPick} afterFlip=${afterFlip}`);
      return { picked, imageShowsPick, afterFlip };
    };

    // (The PRE-FIX reproduction runs are gone: `__cairnDisableStackShared` forced
    // the old controlled-reseed machinery, which the settings-store model deleted
    // — the bug can no longer be expressed, so only the contract is asserted.)
    const g1 = await runG1("g1Post", false);
    report(g1.seed0 === "magma", `PHASE G1 setup: slot0's authored magma seeds the stack (${g1.seed0})`);
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

    const g2 = await runG2("g2Post", false);
    report(g2.afterFlip === "turbo", `PHASE G2 POST-FIX: the diff colormap pick SURVIVES an image↔diff flip (${g2.afterFlip})`);
    report(
      g2.imageShowsPick === "turbo",
      `PHASE G2 POST-FIX (scenario 2): the SCALAR IMAGE slot SHOWS the colormap picked on the diff — one viewport, one setting (${g2.imageShowsPick})`,
    );
    if (g2.afterFlip !== "turbo" || g2.imageShowsPick !== "turbo") allOk = false;

    // ============ PHASE H — HOME IS A GROUP ACTION WHILE MULTI-SELECTED ==========
    // (User ruling — supersedes the old "HOME stays local" reg: HOME/double-click
    // sets the WHOLE GROUP to the clicked viewport's defaults.) Two SEPARATE
    // cells (side-by-side grid: slot0 authored magma, slot1 a curve default).
    // Multi-select forms ONE settings-sync group (slot0 = anchor). A pick on one
    // MIRRORS to the peer. HOME on ANY member publishes THAT member's defaults to
    // the group, so EVERY member adopts them — anchor or not.
    interface HResult {
      seed0: string; // slot0 authored default (magma)
      seed1: string; // slot1 authored default (a curve, NOT magma)
      syncedPeer: string; // after slot0 picks turbo → peer (slot1) follows to turbo
      homePeer1: string; // HOME slot1 → slot1's OWN default (the clicked pane's)
      homePeerKept0: string; // slot0 ADOPTS slot1's default too (group action)
      homeAnchor0: string; // re-sync turbo, HOME slot0 (anchor) → slot0's magma
      homeAnchorKept1: string; // slot1 ADOPTS slot0's magma too (group action)
    }
    const runH = async (hostId: string): Promise<HResult> => {
      __resetGlobalSelectionStoreForTest();
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:520px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: sideBySideTwoScalarGrid() }));
      await waitFor(() => allImgProbes(hostId).length >= 2, 12000, 30);
      await sleep(200);
      const p = () => allImgProbes(hostId);
      const seed0 = p()[0]?.encodingId ?? "?";
      const seed1 = p()[1]?.encodingId ?? "?";
      // Form the page-wide selection: slot0 first ⇒ anchor. The anchor seeds the
      // group, so slot1 adopts slot0's magma on join (expected mirror behaviour).
      const ids = framePaneIds(hostId);
      const store = getGlobalSelectionStore();
      store.select(ids[0], "replace");
      store.select(ids[1], "toggle");
      await sleep(300);
      // A pick on the anchor mirrors to the peer.
      p()[0]!.changeEncoding("turbo");
      await waitFor(() => p()[1]?.encodingId === "turbo", 4000, 30);
      const syncedPeer = p()[1]?.encodingId ?? "?";
      // HOME the NON-ANCHOR peer (slot1): local — back to slot1's OWN authored default.
      p()[1]!.home();
      await sleep(250);
      const homePeer1 = p()[1]?.encodingId ?? "?";
      const homePeerKept0 = p()[0]?.encodingId ?? "?";
      // Re-sync, then HOME the ANCHOR (slot0): also local — back to slot0's magma.
      p()[0]!.changeEncoding("turbo");
      await waitFor(() => p()[1]?.encodingId === "turbo", 4000, 30);
      p()[0]!.home();
      await sleep(250);
      const homeAnchor0 = p()[0]?.encodingId ?? "?";
      const homeAnchorKept1 = p()[1]?.encodingId ?? "?";
      root.unmount();
      host.remove();
      __resetGlobalSelectionStoreForTest();
      note(
        `PHASE H: seed0=${seed0} seed1=${seed1} syncedPeer=${syncedPeer} homePeer1=${homePeer1} ` +
          `homePeerKept0=${homePeerKept0} homeAnchor0=${homeAnchor0} homeAnchorKept1=${homeAnchorKept1}`,
      );
      return { seed0, seed1, syncedPeer, homePeer1, homePeerKept0, homeAnchor0, homeAnchorKept1 };
    };
    const h = await runH("hSel");
    report(h.seed0 === "magma" && h.seed1 !== "magma", `PHASE H setup: two cells with DISTINCT authored defaults (slot0=${h.seed0}, slot1=${h.seed1})`);
    report(h.syncedPeer === "turbo", `PHASE H: multi-select mirrors a pick between cells (peer→turbo: ${h.syncedPeer})`);
    report(h.homePeer1 === h.seed1, `PHASE H: HOME on a selected member resets it to the CLICKED pane's default (${h.homePeer1})`);
    report(h.homePeerKept0 === h.seed1, `PHASE H: HOME is a GROUP action — the neighbour ADOPTS the clicked pane's default too (${h.homePeerKept0})`);
    report(h.homeAnchor0 === "magma", `PHASE H: HOME on the anchor → the anchor's own default (${h.homeAnchor0})`);
    report(h.homeAnchorKept1 === "magma", `PHASE H: the neighbour adopts the anchor's default after the anchor's HOME (${h.homeAnchorKept1})`);
    if (
      h.seed0 !== "magma" || h.seed1 === "magma" || h.syncedPeer !== "turbo" ||
      h.homePeer1 !== h.seed1 || h.homePeerKept0 !== h.seed1 ||
      h.homeAnchor0 !== "magma" || h.homeAnchorKept1 !== "magma"
    ) allOk = false;

    // ============ PHASE I — A STACK SHARES SETTINGS BEYOND ENCODING (reg b) ======
    // The stack must share ALL settings across its slots, not only encoding/diff-
    // colormap. Sample PEAK (an image setting) and the diff KERNEL: a pick persists
    // across flips (a flip does NOT change viewport settings). PEAK has a pre/post
    // contrast — the pre-fix per-flip reseed resets it to each slot's authored peak.
    const runIPeak = async (hostId: string, disable: boolean): Promise<{ seed0: string; afterPick: string; afterFlip: string }> => {
      (window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared = disable;
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:460px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: stackedTwoPeakGrid() }));
      await waitFor(() => document.querySelectorAll(`#${hostId} [role='tab']`).length >= 2, 12000, 30);
      host.querySelector<HTMLElement>("[data-cairn-grid-root]")?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      await waitFor(() => activeIdx(hostId) === 0 && !!imgProbe(hostId), 4000, 30);
      await sleep(150);
      const seed0 = String(imgProbe(hostId)?.peak ?? "?"); // slot0 authored peak (8)
      imgProbe(hostId)!.changePeak(5); // a pick on slot0
      await waitFor(() => imgProbe(hostId)?.peak === 5, 4000, 30);
      const afterPick = String(imgProbe(hostId)?.peak ?? "?");
      key("2"); // flip to slot1 (authored peak 3)
      await waitFor(() => activeIdx(hostId) === 1, 4000, 30);
      await sleep(200);
      const afterFlip = String(imgProbe(hostId)?.peak ?? "?"); // post: 5 (shared); pre: 3
      root.unmount();
      host.remove();
      (window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared = false;
      note(`PHASE I peak (${disable ? "pre-fix" : "post-fix"}): seed0=${seed0} afterPick=${afterPick} afterFlip=${afterFlip}`);
      return { seed0, afterPick, afterFlip };
    };
    const iPost = await runIPeak("iPeakPost", false);
    report(iPost.seed0 === "8" && iPost.afterPick === "5", `PHASE I setup: slot0 authored peak 8, pick 5 (${iPost.seed0}/${iPost.afterPick})`);
    report(iPost.afterFlip === "5", `PHASE I: peak (a setting BEYOND encoding) is SHARED — the pick survives the flip (${iPost.afterFlip})`);
    if (iPost.afterFlip !== "5") allOk = false;

    // KERNEL: a diff-kernel pick survives an image↔diff flip (shared viewport setting).
    const runIKernel = async (hostId: string): Promise<{ picked: string; afterFlip: string }> => {
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:460px;height:280px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: stackedGrid() }));
      await waitFor(() => document.querySelectorAll(`#${hostId} [role='tab']`).length >= 2, 12000, 30);
      host.querySelector<HTMLElement>("[data-cairn-grid-root]")?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
      key("2");
      await waitFor(() => activeIdx(hostId) === 1 && !!diffProbe(hostId), 4000, 30);
      await sleep(150);
      diffProbe(hostId)!.changeDiffKernel("squared");
      await waitFor(() => diffProbe(hostId)?.diffKernel === "squared", 4000, 30);
      const picked = diffProbe(hostId)?.diffKernel ?? "?";
      key("1"); // flip to the image slot
      await waitFor(() => activeIdx(hostId) === 0, 4000, 30);
      await sleep(150);
      key("2"); // back to the diff
      await waitFor(() => activeIdx(hostId) === 1, 4000, 30);
      await sleep(200);
      const afterFlip = diffProbe(hostId)?.diffKernel ?? "?";
      root.unmount();
      host.remove();
      note(`PHASE I kernel: picked=${picked} afterFlip=${afterFlip}`);
      return { picked, afterFlip };
    };
    const iK = await runIKernel("iKernel");
    report(iK.picked === "squared", `PHASE I setup: diff kernel picked squared (${iK.picked})`);
    report(iK.afterFlip === "squared", `PHASE I: the diff KERNEL pick survives an image↔diff flip (shared: ${iK.afterFlip})`);
    if (iK.afterFlip !== "squared") allOk = false;

    // ============ PHASE J — DIFF-GRID HOME → SHARED DEFAULT (scenario 1) =========
    // A NORMAL side-by-side grid of TWO DIFF cells with DISTINCT kernels (slot0
    // FLIP and absolute, both with the same display default). Multi-select forms ONE
    // sync group; a colormap pick MIRRORS to the peer. Then HOME (double-click) on ONE
    // viewport resets its colormap to the shared diff default. Pre-unification
    // the diff colormap lived in a separate per-kernel override store, so HOME did NOT
    // reset it (the reported "no reset"). With the diff colormap merged into the
    // viewport's ONE display encoding, `enc.resetEncoding()` → the shared default.
    interface JResult {
      seed0: string; // slot0 FLIP default (turbo)
      seed1: string; // slot1 absolute default (turbo)
      home1Solo: string; // PART A: HOME slot1 (absolute, unselected) → turbo
      home0Solo: string; // PART A: HOME slot0 (FLIP, unselected) → turbo
      mirrored1: string; // PART B: after slot0 picks red-blue → peer (slot1) follows
      home0: string; // PART B: HOME slot0 (selected) → reset off the pick
      kept1: string; // PART B: slot1 UNTOUCHED by slot0's HOME (still red-blue)
    }
    const runJ = async (hostId: string): Promise<JResult> => {
      __resetGlobalSelectionStoreForTest();
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:560px;height:300px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: sideBySideTwoDiffGrid() }));
      await waitFor(() => allDiffProbes(hostId).length >= 2, 12000, 30);
      await sleep(250);
      const d = () => allDiffProbes(hostId);
      const seed0 = d()[0]?.colormap ?? "?";
      const seed1 = d()[1]?.colormap ?? "?";
      // -- PART A: HOME uses the same diff default regardless of kernel.
      d()[1]!.changeColormap("red-blue"); // slot1 = absolute
      await waitFor(() => d()[1]?.colormap === "red-blue", 4000, 30);
      d()[1]!.home();
      await sleep(250);
      const home1Solo = d()[1]?.colormap ?? "?"; // → turbo (absolute default)
      d()[0]!.changeColormap("red-blue"); // slot0 = FLIP
      await waitFor(() => d()[0]?.colormap === "red-blue", 4000, 30);
      d()[0]!.home();
      await sleep(250);
      const home0Solo = d()[0]?.colormap ?? "?"; // → turbo (shared default)
      // -- PART B: multi-select MIRROR + GROUP HOME (user ruling — supersedes the
      // old local-HOME reg). Select both (slot0 anchor); a colormap pick mirrors
      // to the peer; HOME on slot0 publishes slot0's visible-diff DEFAULT to the
      // GROUP, so BOTH cells adopt it.
      const ids = framePaneIds(hostId);
      const store = getGlobalSelectionStore();
      store.select(ids[0], "replace");
      store.select(ids[1], "toggle");
      await sleep(300);
      d()[0]!.changeColormap("red-blue");
      await waitFor(() => d()[1]?.colormap === "red-blue", 4000, 30);
      const mirrored1 = d()[1]?.colormap ?? "?";
      d()[0]!.home();
      await sleep(300);
      const home0 = d()[0]?.colormap ?? "?"; // reset to slot0's visible-diff default
      const kept1 = d()[1]?.colormap ?? "?"; // neighbour ADOPTS it too (group HOME)
      root.unmount();
      host.remove();
      __resetGlobalSelectionStoreForTest();
      note(`PHASE J: seed0=${seed0} seed1=${seed1} home1Solo=${home1Solo} home0Solo=${home0Solo} mirrored1=${mirrored1} home0=${home0} kept1=${kept1}`);
      return { seed0, seed1, home1Solo, home0Solo, mirrored1, home0, kept1 };
    };
    const j = await runJ("jDiffGrid");
    report(j.seed0 === "srgb" && j.seed1 === "srgb", `PHASE J setup: unauthored DIFF cells use the viewport image default (FLIP=${j.seed0}, absolute=${j.seed1})`);
    report(j.home1Solo === "srgb", `PHASE J (scenario 1): HOME on the absolute diff restores its viewport default (${j.home1Solo})`);
    report(j.home0Solo === "srgb", `PHASE J (scenario 1): HOME on the FLIP diff restores its viewport default (${j.home0Solo})`);
    report(j.mirrored1 === "red-blue", `PHASE J (scenario 1): multi-select mirrors a diff colormap pick between cells (peer→red-blue: ${j.mirrored1})`);
    report(j.home0 === "srgb", `PHASE J (scenario 1): HOME on a multi-selected diff restores the clicked viewport default (${j.home0})`);
    report(j.kept1 === "srgb", `PHASE J (scenario 1): HOME is a GROUP action — the neighbour adopts that default too (${j.kept1})`);
    if (j.seed0 !== "srgb" || j.seed1 !== "srgb" || j.home1Solo !== "srgb" || j.home0Solo !== "srgb" || j.mirrored1 !== "red-blue" || j.home0 !== "srgb" || j.kept1 !== "srgb") allOk = false;

    // ============ PHASE K — MULTI-SELECT KERNEL: FORMATION MIRRORS THE FIRST ===
    // Two side-by-side DIFF cells with DISTINCT kernels (slot0 FLIP, slot1
    // absolute). Multi-selecting them forms ONE sync group; the settings-model
    // simplification (ruling 3) applies the FIRST viewport's CURRENT values — the
    // kernel included — to the others, so slot1 ADOPTS the anchor's flip on
    // formation. An EXPLICIT kernel pick then mirrors to the peer like any change.
    interface KResult {
      seed0: string; // slot0 FLIP kernel
      seed1: string; // slot1 absolute kernel
      afterSelect0: string; // slot0 kernel AFTER multi-select forms (anchor stays flip)
      afterSelect1: string; // slot1 kernel AFTER multi-select forms (adopts anchor's flip)
      mirrored1: string; // slot1 kernel after slot0 picks "squared" (must mirror → squared)
    }
    const runK = async (hostId: string): Promise<KResult> => {
      __resetGlobalSelectionStoreForTest();
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:560px;height:300px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: sideBySideTwoDiffGrid() }));
      await waitFor(() => allDiffProbes(hostId).length >= 2, 12000, 30);
      await sleep(250);
      const d = () => allDiffProbes(hostId);
      const seed0 = d()[0]?.diffKernel ?? "?";
      const seed1 = d()[1]?.diffKernel ?? "?";
      const ids = framePaneIds(hostId);
      const store = getGlobalSelectionStore();
      store.select(ids[0], "replace"); // slot0 anchor
      store.select(ids[1], "toggle"); // + slot1 → ONE group
      await sleep(350); // let the anchor seed + joiner adopt run
      const afterSelect0 = d()[0]?.diffKernel ?? "?"; // anchor stays flip
      const afterSelect1 = d()[1]?.diffKernel ?? "?"; // adopts the anchor's flip (ruling 3)
      d()[0]!.changeDiffKernel("squared"); // explicit pick on the anchor
      await waitFor(() => d()[1]?.diffKernel === "squared", 4000, 30).catch(() => {});
      const mirrored1 = d()[1]?.diffKernel ?? "?";
      root.unmount();
      host.remove();
      __resetGlobalSelectionStoreForTest();
      note(`PHASE K: seed=[${seed0},${seed1}] afterSelect=[${afterSelect0},${afterSelect1}] mirrored1=${mirrored1}`);
      return { seed0, seed1, afterSelect0, afterSelect1, mirrored1 };
    };
    const k = await runK("kKernelGrid");
    report(k.seed0 === "flip" && k.seed1 === "absolute", `PHASE K setup: two DIFF cells with DISTINCT kernels (${k.seed0}/${k.seed1})`);
    report(
      k.afterSelect0 === "flip" && k.afterSelect1 === "flip",
      `PHASE K (ruling 3): multi-selecting mirrors the FIRST viewport's kernel to the peer on formation (${k.afterSelect0}/${k.afterSelect1})`,
    );
    report(k.mirrored1 === "squared", `PHASE K (ruling 4): an EXPLICIT kernel pick MIRRORS to the selected peer (peer→squared: ${k.mirrored1})`);
    if (k.seed0 !== "flip" || k.seed1 !== "absolute" || k.afterSelect0 !== "flip" || k.afterSelect1 !== "flip" || k.mirrored1 !== "squared") allOk = false;

    // ==== PHASE L — THREE-DIFF MULTI-SELECT: FORMATION MIRRORS THE FIRST (ruling 3) ====
    // The served-report's `FLIP vs SSIM vs absolute` grid. Under the settings-model
    // simplification the anchor SEEDS its CURRENT values (kernel included) on
    // formation, and every joiner adopts them BY VALUE — so a 3-diff multi-select
    // collapses the two non-anchor kernels (ssim, absolute) onto the anchor's flip.
    // This phase pins that by (a) capturing every bus patch on formation and
    // asserting the anchor SEED CARRIES `diffKernel`, and (b) asserting the three
    // kernels all become the anchor's; an explicit pick then mirrors likewise.
    interface LResult {
      seeds: string[]; // [flip, ssim, absolute]
      afterSelect: string[]; // all adopt the anchor's flip → [flip, flip, flip]
      seedPatchHadKernel: boolean; // the anchor seed on formation now CARRIES diffKernel
      formationPatchCount: number; // how many patches rode the bus on formation
      pickPatchHadKernel: boolean; // an explicit pick DOES publish {diffKernel}
      mirrored: string[]; // both peers after anchor picks "squared" → [squared, squared]
    }
    const runL = async (hostId: string): Promise<LResult> => {
      __resetGlobalSelectionStoreForTest();
      const host = document.createElement("div");
      host.id = hostId;
      host.style.cssText = "width:840px;height:300px;background:#222;position:relative";
      document.body.appendChild(host);
      const root: Root = createRoot(host);
      root.render(createElement(PlotApp, { descriptor: sideBySideThreeDiffGrid() }));
      await waitFor(() => allDiffProbes(hostId).length >= 3, 12000, 30);
      await sleep(250);
      const d = () => allDiffProbes(hostId);
      const seeds = [d()[0]?.diffKernel ?? "?", d()[1]?.diffKernel ?? "?", d()[2]?.diffKernel ?? "?"];
      // NOSTACK: patches no longer ride an EventTarget bus (subscribers re-read
      // their own registry entry), so the former dispatchEvent capture is
      // retired. The seed-carries-kernel proof is now the REGISTRY OBSERVABLE:
      // after formation the NON-ANCHOR cells' own entries must hold the
      // anchor's kernel (the fan-out wrote them — that IS the seed patch).
      const ids = framePaneIds(hostId);
      const store = getGlobalSelectionStore();
      store.select(ids[0], "replace"); // slot0 anchor (flip)
      store.select(ids[1], "toggle"); // + slot1 (ssim)
      store.select(ids[2], "toggle"); // + slot2 (absolute) → ONE 3-pane group
      await sleep(500); // let the anchor seed + every joiner adopt run
      const entryKernel = (paneId: string | undefined) => {
        const operation = paneId ? getRegisteredPane(paneId)?.settings?.get()?.["compare.operation"] : undefined;
        return operation === "split" ? undefined : operation;
      };
      const seedPatchHadKernel = entryKernel(ids[1]) === seeds[0] && entryKernel(ids[2]) === seeds[0];
      const formationPatchCount = [ids[1], ids[2]].filter((id) => entryKernel(id) !== undefined).length;
      const afterSelect = [d()[0]?.diffKernel ?? "?", d()[1]?.diffKernel ?? "?", d()[2]?.diffKernel ?? "?"];
      // Now a DEDICATED pick on the anchor: it MUST land {diffKernel} in both
      // peers' OWN entries and MIRROR to their probes (live fan-out).
      d()[0]!.changeDiffKernel("squared");
      await waitFor(() => d()[1]?.diffKernel === "squared" && d()[2]?.diffKernel === "squared", 4000, 30).catch(() => {});
      const pickPatchHadKernel = entryKernel(ids[1]) === "squared" && entryKernel(ids[2]) === "squared";
      const mirrored = [d()[1]?.diffKernel ?? "?", d()[2]?.diffKernel ?? "?"];
      root.unmount();
      host.remove();
      __resetGlobalSelectionStoreForTest();
      note(
        `PHASE L: seeds=[${seeds}] afterSelect=[${afterSelect}] formationPatches=${formationPatchCount} ` +
          `seedHadKernel=${seedPatchHadKernel} pickHadKernel=${pickPatchHadKernel} mirrored=[${mirrored}]`,
      );
      return { seeds, afterSelect, seedPatchHadKernel, formationPatchCount, pickPatchHadKernel, mirrored };
    };
    const l = await runL("lThreeKernelGrid");
    report(
      l.seeds[0] === "flip" && l.seeds[1] === "ssim" && l.seeds[2] === "absolute",
      `PHASE L setup: three DIFF cells with DISTINCT kernels (${l.seeds.join("/")})`,
    );
    report(
      l.formationPatchCount > 0 && l.seedPatchHadKernel,
      `PHASE L (ruling 3): the anchor SEED lands compare.operation in both peers' OWN entries (${l.formationPatchCount}/2 entries written)`,
    );
    report(
      l.afterSelect[0] === "flip" && l.afterSelect[1] === "flip" && l.afterSelect[2] === "flip",
      `PHASE L (ruling 3): multi-selecting THREE distinct-kernel diffs mirrors the first's kernel to all (${l.afterSelect.join("/")})`,
    );
    report(
      l.pickPatchHadKernel && l.mirrored[0] === "squared" && l.mirrored[1] === "squared",
      `PHASE L (ruling 4): an EXPLICIT operation pick mirrors to BOTH selected peers (${l.mirrored.join("/")})`,
    );
    if (
      l.seeds[0] !== "flip" || l.seeds[1] !== "ssim" || l.seeds[2] !== "absolute" ||
      !l.seedPatchHadKernel || l.formationPatchCount === 0 ||
      l.afterSelect[0] !== "flip" || l.afterSelect[1] !== "flip" || l.afterSelect[2] !== "flip" ||
      !l.pickPatchHadKernel || l.mirrored[0] !== "squared" || l.mirrored[1] !== "squared"
    ) allOk = false;

    report(allOk, `real-stack GPU: by-value adoption (no scoping) + stacked flip orange-free + real-path paint-atomic + authored-colormap stable + HOME restores compare mode + stack-wide shared display settings + HOME-local-while-selected + shares settings beyond encoding (peak/kernel) + diff colormap IS the viewport encoding (scenario 1 diff-grid HOME→shared default, scenario 2 image adopts diff colormap) + multi-select mirrors the FIRST viewport's kernel on formation (2-diff PHASE K + 3-diff PHASE L: seed carries kernel, all adopt anchor, pick mirrors to both peers)`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
