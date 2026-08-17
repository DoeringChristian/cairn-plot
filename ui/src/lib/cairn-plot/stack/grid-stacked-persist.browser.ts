/**
 * STACKED GRID — compare settings (incl. DIFF MODE) must PERSIST across tab
 * flips, even when a tab mounts LAZILY on its first reveal.
 *
 * The bug: in real (non-eager) usage a stacked grid's hidden tabs are
 * `display:none`, so their `LazyGate` IntersectionObserver never intersects and
 * the pane mounts FRESH only when the tab is first shown. A fresh compare pane
 * seeds its mode from the descriptor (`split`) — so unless it ADOPTS the group's
 * accumulated settings on join, flipping to it "resets" the diff mode the user
 * set on another tab. The eager `compare-settings-sync` harness cannot see this
 * (eager mounts every child up front); this one deliberately runs NON-eager and
 * drives the REAL tab strip.
 *
 * Flow: mount a `cp.Grid(mode="stacked")` of THREE engine compare panes, set
 * `diff` + `squared` on tab 0, then CLICK through tabs 1 and 2 (each mounts
 * lazily) and assert each shows `diff`/`squared`; finally flip back to tab 0 and
 * assert it is STILL `diff` (nothing reset it). Engine compare panes need
 * WebGPU, so this is a Chromium page; `npm run test:harness` runs it in the
 * default set and skips-loud with no adapter.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../plot-renderers";
import type { PlotDescriptor } from "../../../plot-descriptor";
import GpuComparePane from "../media-compare/GpuComparePane";
import { listDiffMenuModes } from "../engine/kernels";

interface CompareProbe {
  compareMode: string;
  diffKernel: string;
  changeCompareMode: (m: "split" | "blend" | "diff") => void;
  changeDiffKernel: (id: string) => void;
}

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  // eslint-disable-next-line no-console
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "#6f6" : "#f66";
    el.appendChild(p);
  }
}
function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "#6f6" : "#f66";
  }
  document.title = pass ? "GRID-STACKED-PERSIST PASS" : "GRID-STACKED-PERSIST FAIL";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred: () => boolean, timeoutMs = 8000, step = 25): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await sleep(step);
  }
  return pred();
}

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
const stackedPanes = () =>
  Array.from(mountEl().querySelectorAll<HTMLElement>("[data-cairn-stacked-pane]"));
const tabs = () => Array.from(mountEl().querySelectorAll<HTMLButtonElement>('[role="tab"]'));

/** The compare probe for stacked child `i` (undefined until that tab has mounted).
 *  The seam lives on the pane's INNER `paneRef` box, so walk the child subtree. */
function probeOfChild(i: number): CompareProbe | undefined {
  const paneWrap = stackedPanes()[i];
  if (!paneWrap) return undefined;
  const root = paneWrap.querySelector<HTMLElement>("[data-gpu-compare-pane]");
  if (!root) return undefined;
  type SeamEl = HTMLElement & { __cairnCompareProbe?: CompareProbe };
  if ((root as SeamEl).__cairnCompareProbe) return (root as SeamEl).__cairnCompareProbe;
  for (const n of Array.from(root.querySelectorAll("*")) as SeamEl[]) {
    if (n.__cairnCompareProbe) return n.__cairnCompareProbe;
  }
  return undefined;
}

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  const w = window as unknown as Record<string, unknown>;
  w.__cairnPlotRenderMode = "gpu";
  w.__cairnPlotUseGpuImage = true;
  w.__cairnPlotGpuComparePane = GpuComparePane;
  w.__cairnPlotDiffMenuModes = listDiffMenuModes();
  // NOTE: deliberately NOT setting __cairnPlotEagerMount — hidden tabs must mount
  // lazily on reveal, which is the whole point of this harness.

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

  const up = await waitFor(() => tabs().length === 3 && !!probeOfChild(0), 15000);
  report(up, `stacked grid mounts with 3 tabs; tab 0's compare pane mounts (probe ${!!probeOfChild(0)})`);
  ok = ok && up;
  if (!up) {
    roots.forEach((r) => r.unmount());
    return false;
  }

  // Only the ACTIVE tab (0) has mounted; the hidden tabs are lazy placeholders.
  const onlyOneMounted = !probeOfChild(1) && !probeOfChild(2);
  report(onlyOneMounted, "hidden tabs 1 & 2 are NOT yet mounted (lazy — the real condition)");

  // Set diff + squared on tab 0.
  probeOfChild(0)!.changeCompareMode("diff");
  probeOfChild(0)!.changeDiffKernel("squared");
  const t0diff = await waitFor(
    () => probeOfChild(0)?.compareMode === "diff" && probeOfChild(0)?.diffKernel === "squared",
  );
  report(t0diff, `tab 0 set to diff/squared (mode=${probeOfChild(0)?.compareMode}, kernel=${probeOfChild(0)?.diffKernel})`);
  ok = ok && t0diff;

  // Flip to tab 1 (mounts lazily NOW) → must adopt diff/squared, not reset.
  tabs()[1].click();
  const t1mounted = await waitFor(() => !!probeOfChild(1), 15000);
  report(t1mounted, "flip → tab 1 mounts on reveal");
  const t1diff = await waitFor(
    () => probeOfChild(1)?.compareMode === "diff" && probeOfChild(1)?.diffKernel === "squared",
  );
  report(t1diff, `tab 1 ADOPTS diff/squared on lazy mount (mode=${probeOfChild(1)?.compareMode}, kernel=${probeOfChild(1)?.diffKernel})`);
  ok = ok && t1mounted && t1diff;

  // Flip to tab 2 (also lazy) → same.
  tabs()[2].click();
  const t2mounted = await waitFor(() => !!probeOfChild(2), 15000);
  const t2diff = await waitFor(() => probeOfChild(2)?.compareMode === "diff");
  report(t2diff, `tab 2 ADOPTS diff on lazy mount (mode=${probeOfChild(2)?.compareMode})`);
  ok = ok && t2mounted && t2diff;

  // Flip BACK to tab 0 → still diff (nothing reset it).
  tabs()[0].click();
  await sleep(120);
  const t0still = probeOfChild(0)?.compareMode === "diff";
  report(t0still, `flip back → tab 0 is STILL diff (mode=${probeOfChild(0)?.compareMode})`);
  ok = ok && t0still;

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
