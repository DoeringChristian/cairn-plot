/**
 * RESOLVE-TRANSITION harness (Finding 2) — the LeafView resolve path under a
 * rapid stacked image↔diff flip, driven through the REAL descriptor tree
 * (`PlotApp` → `GridView` stacked → `NodeDispatch` → `LeafView`), CPU renderers
 * (URL sources ⇒ `CpuImagePane`, no WebGPU needed — the resolve logic is
 * renderer-agnostic).
 *
 * WHAT IT PROVES. A stacked `[image, diff]` grid reuses ONE `LeafView` instance across
 * the flip. `LeafView` reads its resolved value PURELY from the subscribable resolve-
 * cache keyed by the CURRENT `resolveKey` (no component `state` cell), so a WARM/
 * prefetched flip resolves the new slot SYNCHRONOUSLY in the flip commit — no
 * placeholder — and never holds the previous slot's resolution. The stale-diff / half-
 * built-`compareSource` window (a `compareSource` whose `b` is undefined) is now
 * structurally UNREPRESENTABLE — the leaf only builds a `compareSource` from a RESOLVED
 * diff pair — so its former `staleDiffHolds` witness is RETIRED. A COLD swap (cache
 * miss) shows a brief `"Loading…"` (accepted); the storm below is WARM (both slots pre-
 * visited), so it must NOT drop to a placeholder.
 *
 * `window.__cairnLeafResolveStats` exposes `placeholderMounts` (set in `plot-node.tsx`).
 * The harness warms the resolve cache for BOTH slots, resets the counter, storms the
 * flip, and asserts `placeholderMounts === 0` (no flash on warm flips).
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../../plot-renderers";
import type { PlotDescriptor } from "../../../../plot-descriptor";
import { createHarness, sleep, waitFor } from "../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "STACKED DIFF FLIP RESOLVE" });

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

// The report's Validation grid shape: a plain IMAGE leaf next to a DIFF compare,
// stacked → homogeneous (both lower to `plot:image`) → ONE reused LeafView.
function imageDiffGrid(): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode: "stacked",
      children: [
        { kind: "plot", renderer: "image", data: { kind: "url", src: imgUrl("#888") }, props: { toolbar: true, label: "Image" } },
        {
          kind: "compare",
          mode: "diff",
          a: { kind: "url", src: imgUrl("#c0392b") },
          b: { kind: "url", src: imgUrl("#2980b9") },
          diffSubmode: "absolute",
          props: { toolbar: true, label: "Diff" },
        },
      ],
    },
  } as unknown as PlotDescriptor;
}

interface LeafResolveStats { placeholderMounts: number; }
function stats(): LeafResolveStats {
  return (window as unknown as { __cairnLeafResolveStats: LeafResolveStats }).__cairnLeafResolveStats;
}
const q = (id: string, sel: string) => document.getElementById(id)!.querySelector<HTMLElement>(sel);
const qa = (id: string, sel: string) => Array.from(document.getElementById(id)!.querySelectorAll<HTMLElement>(sel));
const activePaneIndex = (id: string): number => {
  const el = q(id, "[data-cairn-stack-active]");
  const v = el?.getAttribute("data-cairn-stack-active");
  return v == null ? -1 : parseInt(v, 10);
};
const key = (k: string, extra: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));

async function main(): Promise<void> {
  try {
    registerCoreRenderers();
    (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
    (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;

    const hostEl = document.getElementById("m1")!;
    hostEl.style.cssText = "width:480px;height:320px;background:#222";
    const root: Root = createRoot(hostEl);
    root.render(createElement(PlotApp, { descriptor: imageDiffGrid() }));

    const up = await waitFor(() => qa("m1", "[role='tab']").length >= 2, 6000, 20);
    report(up, `stacked [image, diff] grid renders a 2-tab strip`);
    report(activePaneIndex("m1") === 0, `tab 0 (image) active initially (got ${activePaneIndex("m1")})`);

    // Hover so the stack keyboard is in scope.
    q("m1", "[data-cairn-grid-root]")!.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));

    // ---- WARM UP: visit BOTH slots so the resolve cache holds both keys, so the
    // storm's flips are cache HITS (the case Finding 2 is about — a synchronous
    // hit that still crosses the reused-instance stale window). ------------------
    key("2");
    await waitFor(() => activePaneIndex("m1") === 1, 6000, 20);
    await sleep(250);
    key("1");
    await waitFor(() => activePaneIndex("m1") === 0, 6000, 20);
    await sleep(250);
    key("2");
    await waitFor(() => activePaneIndex("m1") === 1, 6000, 20);
    await sleep(250);
    key("1");
    await waitFor(() => activePaneIndex("m1") === 0, 6000, 20);
    await sleep(250);
    note("warm-up done (both slots resolved + cached)");

    // ---- STORM: reset counters, then rapid image↔diff flips -------------------
    const s = stats();
    s.placeholderMounts = 0;

    const FLIPS = 40;
    let flipped = 0;
    for (let i = 0; i < FLIPS; i++) {
      const wantIdx = i % 2 === 0 ? 1 : 0; // 1 = diff, 0 = image
      key(wantIdx === 1 ? "2" : "1");
      if (await waitFor(() => activePaneIndex("m1") === wantIdx, 3000)) flipped++;
    }
    await sleep(200);

    note(`flip storm: ${flipped}/${FLIPS} flips landed`);
    note(`placeholder ("Loading…") mounts during the WARM storm = ${s.placeholderMounts}`);

    // NO placeholder flash on WARM flips: the pure resolve-cache read hits for both
    // pre-visited slots, so a reused-instance flip never drops to "loading". (A cold
    // swap would show a brief placeholder — accepted — but the storm is warm.)
    report(s.placeholderMounts === 0, `NO "Loading…" placeholder mounts across the warm flip storm (${s.placeholderMounts})`);

    // No error/placeholder is currently on screen (settled coherently after the storm).
    const settled = await waitFor(
      () => !q("m1", "[data-cairn-stacked-pane]")?.textContent?.includes("Loading") && activePaneIndex("m1") >= 0, 6000, 20);
    report(settled, `pane settled coherently after the storm (no lingering placeholder)`);

    const allOk = up && s.placeholderMounts === 0 && settled;
    report(allOk, `resolve: rapid stacked image↔diff flipping never flashes a placeholder / broken diff`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
