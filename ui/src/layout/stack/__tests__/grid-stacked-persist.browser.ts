/**
 * STACKED GRID — single-renderer model. A `cp.Grid(mode="stacked")` renders ONE
 * reused renderer and SWAPS its source when you flip tabs; it does NOT mount N
 * panes. So display + compare settings (incl. DIFF MODE) are shared BY
 * CONSTRUCTION — there is nothing to re-sync, and a flip cannot "reset" them.
 *
 * This harness proves that end to end with the ENGINE compare pane: mount a
 * stacked grid of three compares, set `diff`+`squared`, then flip through the
 * tabs and assert (a) exactly ONE compare pane is ever rendered, (b) diff/squared
 * persist across every flip, and (c) the renderer INSTANCE is reused — the same
 * canvas DOM nodes survive a flip (no remount / park-restore → no flicker).
 * Engine compare panes need WebGPU, so this is a Chromium page; `npm run
 * test:harness` runs it in the default set and skips-loud with no adapter.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../../plots/register-core";
import type { PlotDescriptor } from "../../../host/descriptor-resolver";
import { createHarness, waitFor } from "../../../testing/harness";

interface CompareProbe {
  compareMode: string;
  diffKernel: string;
  changeCompareMode: (m: "split" | "blend" | "diff") => void;
  changeDiffKernel: (id: string) => void;
}

const { report, setOverallStatus } = createHarness({ title: "GRID-STACKED-PERSIST", colors: { pass: "#6f6", fail: "#f66" } });

function imgUrl(color: string): string {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "#000";
  ctx.fillRect(4, 4, 8, 8);
  return c.toDataURL("image/png");
}
function compareChild(fg: string, ref: string): unknown {
  return {
    kind: "compare",
    mode: "split",
    a: { kind: "url", src: imgUrl(fg) },
    b: { kind: "url", src: imgUrl(ref) },
    props: { toolbar: true },
  };
}

const mountEl = () => document.getElementById("mount")!;
const tabs = () => Array.from(mountEl().querySelectorAll<HTMLButtonElement>('[role="tab"]'));
const activeIdx = (): number => {
  const v = mountEl().querySelector("[data-cairn-stack-active]")?.getAttribute("data-cairn-stack-active");
  return v == null ? -1 : parseInt(v, 10);
};
// The single reused stacked-pane slot — pane-type-AGNOSTIC: it holds the slide/
// blend `GpuComparePane` OR (post Phase 2c routing) the diff `GpuImagePane`.
const stackPane = () => mountEl().querySelector<HTMLElement>('[data-cairn-stacked-pane="active"]');
const stackPaneCount = () => mountEl().querySelectorAll('[data-cairn-stacked-pane]').length;
/** The (single) compare/diff probe — `__cairnImageDiffProbe`, exposed by the
 *  unified `GpuImagePane` in diff mode; the stacked grid renders ONE reused
 *  pane, so a diff-mode compare swaps its lowering to the image pane. */
function probe(): CompareProbe | undefined {
  const sp = stackPane();
  if (!sp) return undefined;
  type SeamEl = HTMLElement & {
    __cairnImageDiffProbe?: CompareProbe;
  };
  const seam = (el: SeamEl) => el.__cairnImageDiffProbe;
  if (seam(sp as SeamEl)) return seam(sp as SeamEl);
  for (const n of Array.from(sp.querySelectorAll("*")) as SeamEl[]) {
    const p = seam(n);
    if (p) return p;
  }
  return undefined;
}
const canvasTags = () => {
  const sp = stackPane();
  return sp ? Array.from(sp.querySelectorAll("canvas")) : [];
};

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  const w = window as unknown as Record<string, unknown>;
  w.__cairnPlotRenderMode = "gpu";
  // EVERY compare mode lowers to the unified image pane (`GpuImagePane` +
  // `compareSource`) — `GpuComparePane` is deleted (Phase 4). Wire it so
  // `resolveImageRenderer("gpu")` finds it when the active slot flips.

  const roots: Root[] = [];
  const root = createRoot(mountEl());
  root.render(
    createElement(PlotApp, {
      descriptor: {
        mode: "local",
        root: {
          kind: "grid",
          cols: 3,
          gap: 8,
          mode: "stacked",
          children: [
            compareChild("#c0392b", "#2980b9"),
            compareChild("#27ae60", "#8e44ad"),
            compareChild("#e67e22", "#16a085"),
          ],
        },
      } as unknown as PlotDescriptor,
    }),
  );
  roots.push(root);

  const up = await waitFor(() => tabs().length === 3 && !!probe(), 15000, 25);
  report(up, `stacked grid mounts with 3 tabs; the ONE reused compare pane mounts (probe ${!!probe()})`);
  ok = ok && up;
  if (!up) {
    roots.forEach((r) => r.unmount());
    return false;
  }

  // Single-renderer model: exactly ONE stacked-pane slot rendered, never N.
  const onePane = stackPaneCount() === 1;
  report(onePane, `exactly ONE pane rendered — a stack is ONE reused renderer (got ${stackPaneCount()})`);
  ok = ok && onePane;

  // Set diff + squared while on tab 0.
  probe()!.changeCompareMode("diff");
  probe()!.changeDiffKernel("squared");
  const t0diff = await waitFor(() => probe()?.compareMode === "diff" && probe()?.diffKernel === "squared", 8000, 25);
  report(t0diff, `set diff/squared (mode=${probe()?.compareMode}, kernel=${probe()?.diffKernel})`);
  ok = ok && t0diff;

  // Tag the pane's canvases NOW (after diff, so the count is settled) to prove the
  // INSTANCE is reused across the flip — the tagged nodes must SURVIVE (a remount
  // or park/restore would replace them). New canvases may appear; we only require
  // the tagged ones persist.
  const tagged = canvasTags();
  tagged.forEach((c, i) => c.setAttribute("data-persist-tag", `cv${i}`));
  const tagsBefore = tagged.map((_, i) => `cv${i}`);

  // Flip to tab 1 → the source swaps on the SAME instance; settings are shared BY
  // CONSTRUCTION (one instance), so diff/squared persist with nothing to re-sync.
  tabs()[1].click();
  const flipped = await waitFor(() => activeIdx() === 1, 8000, 25);
  report(flipped, `flip → active tab is 1 (got ${activeIdx()})`);
  const stillDiff1 = await waitFor(() => probe()?.compareMode === "diff" && probe()?.diffKernel === "squared", 8000, 25);
  report(stillDiff1, `after flip, STILL diff/squared (mode=${probe()?.compareMode}, kernel=${probe()?.diffKernel})`);

  // The renderer INSTANCE was reused — every previously-tagged canvas still in the
  // DOM (no remount, no park/restore → no flicker).
  const survivingTags = new Set(canvasTags().map((c) => c.getAttribute("data-persist-tag")));
  const reused = tagsBefore.length > 0 && tagsBefore.every((t) => survivingTags.has(t));
  report(reused, `the renderer INSTANCE is reused across the flip (all ${tagsBefore.length} tagged canvases survived)`);
  ok = ok && flipped && stillDiff1 && reused;

  // Flip to tab 2 and back to 0 → still diff throughout.
  tabs()[2].click();
  await waitFor(() => activeIdx() === 2, 8000, 25);
  const stillDiff2 = probe()?.compareMode === "diff";
  report(stillDiff2, `tab 2 still diff (mode=${probe()?.compareMode})`);
  tabs()[0].click();
  await waitFor(() => activeIdx() === 0, 8000, 25);
  const stillDiff0 = probe()?.compareMode === "diff";
  report(stillDiff0, `back to tab 0, still diff (mode=${probe()?.compareMode})`);
  ok = ok && stillDiff2 && stillDiff0;

  roots.forEach((r) => r.unmount());
  return ok;
}

async function main(): Promise<void> {
  report(true, "harness module loaded (boot marker)");
  try {
    const ok = await run();
    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
