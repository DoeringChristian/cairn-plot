/**
 * COMPARE GRID INTERACTIONS — the CP4 regression harness for the compare
 * robustness plan (`docs/superpowers/plans/2026-09-09-compare-robustness.md`).
 *
 * WHAT IT GUARDS. A cairn comparison page is 18 runs × N iteration steps of
 * compare panes. The reported failure mode is not one broken pane: it is that
 * moving the step slider, changing the comparison operation, zooming, or opening
 * the settings panel (a host remount) leaves SOME pane blank, stale or frozen —
 * intermittently, and only at grid scale. Every fix in CP1-CP3 is a unit test
 * somewhere; this page is the only place they are proven together, through the
 * REAL host path cairn uses (`mountPlot` → `PlotHost` → `PlotSurface`), against
 * the committed EXR fixtures, with a live pane pool.
 *
 * THE SCENARIO (both backends: `cpu`, then `gpu` when the host has an adapter)
 *   - 18 compare children in one 6-column grid, each `{kind:"compare", id:"run<i>",
 *     operands:[reference(step), run i(step)], props.holdPreviousWhileLoading}`
 *     — byte-for-byte the node shape `cairn/ui/src/components/card-kit/
 *     build-plot-spec.ts` emits. The fixture varies per run so panes are
 *     distinguishable; the reference operand is one shared run, as in cairn.
 *   - 20 STEP CHANGES driven as `plot.update({ spec })` with fresh hashes. The
 *     hashes are namespaced PER BACKEND, so the second pass is genuinely cold
 *     rather than running off the first pass's resolution-cache entries.
 *   - OPERATION CHANGES split → difference → flip → split, driven exactly as
 *     cairn drives them (an authored `presentation` in the spec update PLUS a
 *     live `plot.patchSettings({"compare.operation"})`).
 *   - 10 WHEEL ZOOMS + a pan drag on pane 0 (synthetic events).
 *   - A full host UNMOUNT + REMOUNT (the settings-panel shape).
 *   - A window RESIZE.
 *
 * THREE PANES ARE DELIBERATELY BROKEN, because "nothing ever fails" would prove
 * only that the happy path works:
 *   - run 4 has NO artifact for steps < 5 (an authored `hash: null` pane, cairn's
 *     "no data for this step" cell) and must become a live compare at step 5;
 *   - run 9's step-7 hash resolves to a TRUNCATED EXR (a decode error);
 *   - run 13's step-9 REFERENCE hash REJECTS (`bytes()` throws) — the CP3-review
 *     case: a rejecting B operand must show a failure and then RECOVER on the
 *     next node change, never stay blank. (The page drives the rejection at the
 *     RESOLVE seam, the only half of H8 a page can reach; the upload-lease half
 *     is `webgpu/view.tsx`'s own `.catch`.)
 * Both error panes must be back to painting at the NEXT step.
 *
 * WHAT IS ASSERTED after every action (settle budget 3 s):
 *   1. no pane shows `"Loading…"` once it has painted once — read from the host's
 *      own `window.__cairnLeafResolveStats.placeholderMounts` counter (the
 *      placeholder is a COMMIT, so polling the DOM could miss it) AND from the
 *      DOM at each settle;
 *   2. no pane except the deliberate three shows an error surface
 *      (`PaneUnavailable` / the leaf's `Plot error:` message);
 *   3. every pane's canvas centre is NON-TRANSPARENT (`createImageBitmap` of the
 *      canvas). Whether a COMPOSITED WebGPU canvas can be read back at all is
 *      host-dependent, so the page probes that capability with a canvas it
 *      controls and says out loud which form the GPU pass ran (see
 *      `probeGpuCanvasReadback`); the CPU pass always carries the strict form;
 *   4. the PRESENTED key equals the REQUESTED key for every pane, read from the
 *      test-only `data-presented-key` attribute both views stamp on their canvas
 *      when they paint. This is the assertion that catches a STALE pane: two
 *      steps of one run decode to identical pixels, so pixels alone cannot tell
 *      "painted step N" from "still showing step N-1";
 *   5. no long task > 200 ms (a `PerformanceObserver` on `longtask`).
 * Per-action wall-clock timings are printed.
 *
 * PLUS the three DOM cases CP2/CP3 could not unit-test, as their own sections:
 *   - H2  a resolve that fails ONCE then succeeds recovers after
 *     `RESOLVE_ERROR_TTL_MS` with NO spec change, no scroll, no settings edit;
 *   - H13a a pane whose placeholder is not laid out when the lazy gate's effect
 *     first runs (the host is mounted DETACHED and attached a frame later) still
 *     mounts;
 *   - H13b a pane inside a `display:none` panel mounts once the panel is shown
 *     (the gate's `ResizeObserver` re-observes it).
 *
 * Self-driving (`data-cairn-harness` on the page's `<html>`), so
 * `npm run test:harness` runs it in the DEFAULT set.
 */
import { mountPlot, type MountedPlot } from "../../../../public/mountPlot.tsx";
import type { PlotSpec, PlotNode } from "../../../../../../packages/spec/src/spec.ts";
import type { DataSource } from "../../../../resources/data/data-source.ts";
import { getLiveSwapchainCount, isCanvasLive, MAX_LIVE_SWAPCHAINS } from "../../webgpu/pool.ts";
import { createHarness, sleep, waitFor } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({
  title: "COMPARE-GRID-INTERACTIONS",
  colors: { pass: "#6f6", fail: "#f66" },
});

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------
const RUNS = 18;
const STEPS = 20;
const COLS = 6;
/** Per-action settle budget (the plan's "wait for settle (poll ≤ 3 s)"). */
const SETTLE_MS = 3000;
/** The first mount of a cold grid is allowed longer than a step swap. */
const MOUNT_MS = 20_000;
/** The plan's responsiveness floor. */
const LONG_TASK_MS = 200;

/** The run with no artifact at all for steps < BLANK_UNTIL (cairn's `hash:null`). */
const BLANK_RUN = 4;
const BLANK_UNTIL = 5;
/** The run whose FOREGROUND bytes are a truncated EXR at this step. */
const DECODE_ERR_RUN = 9;
const DECODE_ERR_STEP = 7;
/** The run whose REFERENCE (B operand) hash rejects at this step. */
const REJECT_B_RUN = 13;
const REJECT_B_STEP = 9;

/** One fixture per 3 runs, so neighbouring panes hold visibly different pixels. */
const FIXTURES = [
  "rgb-piz-half-64x48.exr",
  "rgb-zip-half-64x48.exr",
  "tiled-zip-half-64x48.exr",
  "htj2k-half-64x48.exr",
  "luma-chroma-64x48.exr",
  "rgb-piz-float-64x48.exr",
] as const;
/** The shared reference run's fixture (cairn compares every run against one). */
const REFERENCE_FIXTURE = "rgb-piz-half-64x48.exr";

// ---------------------------------------------------------------------------
// The in-page artifact store (the host's `DataSource`)
// ---------------------------------------------------------------------------
const store = new Map<string, ArrayBuffer>();
/** Hashes whose `bytes()` REJECTS (the H8 / rejecting-operand case). */
const rejecting = new Set<string>();
/** Hashes that reject exactly ONCE and then succeed (the H2 backoff case). */
const failOnce = new Map<string, number>();

const source: DataSource = {
  artifactUrl(hash: string): string {
    // Never taken: every operand below carries `format:"exr"`, which routes
    // through `bytes()`. Present because the contract requires it.
    return `/__harness__/${hash}`;
  },
  async bytes(hash: string): Promise<ArrayBuffer> {
    if (rejecting.has(hash)) throw new Error(`artifact ${hash} is unavailable (simulated)`);
    const remaining = failOnce.get(hash);
    if (remaining !== undefined && remaining > 0) {
      failOnce.set(hash, remaining - 1);
      throw new Error(`artifact ${hash} failed once (simulated)`);
    }
    const bytes = store.get(hash);
    if (!bytes) throw new Error(`no artifact ${hash}`);
    return bytes;
  },
};

function fixtureUrl(name: string): string {
  return new URL(`../../resources/decoders/fixtures/${name}`, import.meta.url).href;
}

async function loadFixtures(): Promise<Map<string, ArrayBuffer>> {
  const loaded = new Map<string, ArrayBuffer>();
  for (const name of new Set<string>([...FIXTURES, REFERENCE_FIXTURE])) {
    const res = await fetch(fixtureUrl(name));
    if (!res.ok) throw new Error(`fixture ${name} → HTTP ${res.status}`);
    loaded.set(name, await res.arrayBuffer());
  }
  return loaded;
}

/**
 * Every hash is namespaced by the backend under test. The resolution cache is a
 * module-global keyed by content identity, so without this the SECOND pass would
 * run entirely off the FIRST pass's decoded payloads — every resolve warm, every
 * cold-miss path unexercised, and a cold-path regression invisible on whichever
 * backend happens to run second.
 */
let hashPrefix = "cpu-";
const fgHash = (run: number, step: number): string => `${hashPrefix}r${run}-s${step}`;
const refHash = (run: number, step: number): string =>
  run === REJECT_B_RUN && step === REJECT_B_STEP
    ? `${hashPrefix}refbad${run}-s${step}`
    : `${hashPrefix}ref-s${step}`;

/** Register every (run, step) hash, for every backend namespace, against the
 *  fixture bytes its run uses. */
function seedStore(fixtures: Map<string, ArrayBuffer>): void {
  const truncated = fixtures.get(FIXTURES[DECODE_ERR_RUN % FIXTURES.length]!)!.slice(0, 96);
  const previous = hashPrefix;
  for (const prefix of ["cpu-", "gpu-"]) {
    hashPrefix = prefix;
    for (let step = 0; step < STEPS; step++) {
      store.set(`${prefix}ref-s${step}`, fixtures.get(REFERENCE_FIXTURE)!);
      for (let run = 0; run < RUNS; run++) {
        const bytes = fixtures.get(FIXTURES[run % FIXTURES.length]!)!;
        const broken = run === DECODE_ERR_RUN && step === DECODE_ERR_STEP;
        store.set(fgHash(run, step), broken ? truncated : bytes);
      }
    }
    // The rejecting REFERENCE operand: registered as a hash the store REFUSES.
    rejecting.add(refHash(REJECT_B_RUN, REJECT_B_STEP));
  }
  hashPrefix = previous;
}

// ---------------------------------------------------------------------------
// The authored spec — cairn's own compare-node shape
// ---------------------------------------------------------------------------
type Operation = "split" | "absolute" | "flip";

function childNode(run: number, step: number, operation: Operation): PlotNode {
  if (run === BLANK_RUN && step < BLANK_UNTIL) {
    // cairn's "no data for this step" cell: the run keeps its grid slot with an
    // explicit unavailable pane rather than disappearing and re-keying the grid.
    return {
      kind: "plot",
      id: `run${run}`,
      type: "image",
      data: { kind: "image", hash: null },
      props: { holdPreviousWhileLoading: true, toolbar: false },
    };
  }
  return {
    kind: "compare",
    id: `run${run}`,
    type: "image",
    presentation: operation === "split" ? "split" : "difference",
    operands: [
      { kind: "image", hash: refHash(run, step), format: "exr" },
      { kind: "image", hash: fgHash(run, step), format: "exr" },
    ],
    strategy: "reference",
    referenceIndex: 0,
    settings: { "compare.operation": operation },
    props: {
      labelA: "reference",
      labelB: `run ${run}`,
      toolbar: false,
      holdPreviousWhileLoading: true,
    },
  };
}

function specFor(step: number, operation: Operation): PlotSpec {
  const children = Array.from({ length: RUNS }, (_, run) => childNode(run, step, operation));
  const rows = Math.ceil(RUNS / COLS);
  return {
    root: {
      kind: "grid",
      children,
      cols: COLS,
      // Explicit px rows: the harness page carries no Tailwind, so the grid must
      // size itself rather than inherit an `h-full` chain.
      rowHeights: Array.from({ length: rows }, () => "150px"),
      gap: "0.35rem",
      switchable: false,
      shared: { sync: { settings: false } },
    },
  };
}

// ---------------------------------------------------------------------------
// DOM probes
// ---------------------------------------------------------------------------
interface LeafResolveStats { placeholderMounts: number }
function placeholderMounts(): number {
  return (window as unknown as { __cairnLeafResolveStats?: LeafResolveStats })
    .__cairnLeafResolveStats?.placeholderMounts ?? 0;
}

function cellsOf(hostId: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`#${hostId} [data-plot-pane-id]`));
}
function canvasOf(cell: Element): HTMLCanvasElement | null {
  return cell.querySelector<HTMLCanvasElement>(
    "canvas[data-cpu-image-canvas], canvas[data-gpu-image-canvas]",
  );
}
function presentedKey(cell: Element): string {
  return canvasOf(cell)?.getAttribute("data-presented-key") ?? "";
}
/** Any visible failure surface: the overlay error box or the leaf's message. */
function errorText(cell: Element): string {
  const box = cell.querySelector("[data-cpu-image-error], [data-gpu-image-error]");
  if (box) return (box.textContent ?? "unavailable").trim();
  const text = (cell.textContent ?? "").trim();
  if (text.startsWith("Plot error:")) return text;
  if (/image unavailable|no image/i.test(text)) return text;
  return "";
}
function showsLoading(cell: Element): boolean {
  return (cell.textContent ?? "").includes("Loading…");
}

// ---------------------------------------------------------------------------
// "Loading…" ATTRIBUTION. `placeholderMounts` counts placeholder COMMITS, which
// a poll can miss entirely — a pane can blink through the placeholder between
// two settles. A MutationObserver over the grid names WHICH pane blinked and
// under WHICH action, so a failure reports a run and an action instead of a
// bare counter delta.
// ---------------------------------------------------------------------------
let currentAction = "mount";
const loadingBlinks: Array<{ action: string; run: number }> = [];
const seenBlinks = new Set<string>();
let loadingObserver: MutationObserver | null = null;

function observeLoading(hostId: string): void {
  loadingObserver?.disconnect();
  const host = document.getElementById(hostId);
  if (!host) return;
  loadingObserver = new MutationObserver(() => {
    const cells = cellsOf(hostId);
    for (let run = 0; run < cells.length; run++) {
      if (!showsLoading(cells[run]!)) continue;
      // One entry per (action, pane): a placeholder that stays up re-notifies on
      // every neighbouring mutation, and 24 records of one blink says nothing 24
      // times.
      const key = `${currentAction}|${run}`;
      if (seenBlinks.has(key)) continue;
      seenBlinks.add(key);
      loadingBlinks.push({ action: currentAction, run });
    }
  });
  loadingObserver.observe(host, { childList: true, subtree: true, characterData: true });
}

function blinksSince(mark: number): Array<{ action: string; run: number }> {
  return loadingBlinks.slice(mark);
}

/** Centre-pixel readback. `createImageBitmap` of the WHOLE canvas is the form
 *  the sibling GPU harnesses use and the only one proven to read a WebGPU
 *  canvas back (a `getContext("2d")` on one would conflict with its live webgpu
 *  context; a CROPPED `createImageBitmap` of a WebGPU canvas reads back empty). */
async function centrePixel(canvas: HTMLCanvasElement): Promise<Uint8ClampedArray | null> {
  if (!canvas.width || !canvas.height) return null;
  const bitmap = await createImageBitmap(canvas);
  const tmp = document.createElement("canvas");
  tmp.width = bitmap.width;
  tmp.height = bitmap.height;
  const ctx = tmp.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(tmp.width >> 1, tmp.height >> 1, 1, 1).data;
}

/**
 * CAN THIS HOST READ A WEBGPU CANVAS BACK AT ALL?
 *
 * The centre-pixel assertion below is the strongest evidence a pane painted, and
 * it is applied unconditionally on the CPU backend. On the WebGPU backend it is
 * only MEANINGFUL where the browser lets a page snapshot a WebGPU canvas: on
 * some headless hosts (verified: headless Chromium on macOS/Metal, where the
 * long-standing `testing/browser/renderers/gpu-image-pane` harness fails its own
 * "GPU canvas has non-blank rendered content" check for the same reason)
 * `createImageBitmap` of a WebGPU canvas returns a fully transparent bitmap no
 * matter what was presented.
 *
 * So the harness PROBES the capability with a canvas it controls completely — a
 * WebGPU canvas cleared to opaque red — and:
 *   - probe reads red  → the centre-pixel assertion runs on the GPU panes too;
 *   - probe reads blank → the page says so LOUDLY and falls back to the pane's
 *     own liveness signal (`data-gpu-backend-ready` + the presented key + no
 *     error surface), the same substitute `float-compare.browser.ts` uses.
 * It is never silently skipped, and the CPU pass always carries the strict form.
 */
async function probeGpuCanvasReadback(): Promise<boolean> {
  type GpuLike = {
    requestAdapter(): Promise<{ requestDevice(): Promise<GpuDeviceLike> } | null>;
    getPreferredCanvasFormat(): string;
  };
  interface GpuDeviceLike {
    createCommandEncoder(): {
      beginRenderPass(desc: unknown): { end(): void };
      finish(): unknown;
    };
    queue: { submit(buffers: unknown[]): void };
    destroy?(): void;
  }
  const gpu = (navigator as unknown as { gpu?: GpuLike }).gpu;
  if (!gpu) return false;
  let device: GpuDeviceLike | undefined;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    // IN THE DOCUMENT, like a pane's canvas: a detached WebGPU canvas is never
    // composited, so it answers "can I read the buffer I just drew" — which is
    // easier than, and different from, "can I read a canvas the compositor has
    // already taken", the question every pane readback below actually asks.
    canvas.style.cssText = "position:fixed;left:0;bottom:0;width:8px;height:8px";
    document.body.appendChild(canvas);
    const context = canvas.getContext("webgpu") as unknown as {
      configure(desc: unknown): void;
      getCurrentTexture(): { createView(): unknown };
    } | null;
    if (!context) return false;
    context.configure({ device, format: gpu.getPreferredCanvasFormat(), alphaMode: "opaque" });
    const encoder = device.createCommandEncoder();
    encoder
      .beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 1, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      })
      .end();
    device.queue.submit([encoder.finish()]);
    // Read back the way the panes are read back: SOME FRAMES LATER, after the
    // compositor has taken the frame. Reading inside the submitting task would
    // answer a different (and easier) question than the one asked of a pane.
    await nextFrame();
    await nextFrame();
    const px = await centrePixel(canvas);
    canvas.remove();
    return !!px && px[3] !== 0;
  } catch {
    return false;
  } finally {
    device?.destroy?.();
  }
}

/** Set once, before the WebGPU pass; see `probeGpuCanvasReadback`. */
let gpuReadbackWorks = false;

/** The GPU pane's positive liveness signal when its canvas cannot be read back. */
function gpuBackendReady(cell: Element): boolean {
  const el = cell.querySelector("[data-gpu-backend-ready]");
  return !!el && el.getAttribute("data-gpu-backend-ready") === "true";
}

// ---------------------------------------------------------------------------
// Expectations
// ---------------------------------------------------------------------------
type Expectation = "paints" | "unavailable";

function expectationFor(run: number, step: number): Expectation {
  if (run === BLANK_RUN && step < BLANK_UNTIL) return "unavailable";
  if (run === DECODE_ERR_RUN && step === DECODE_ERR_STEP) return "unavailable";
  if (run === REJECT_B_RUN && step === REJECT_B_STEP) return "unavailable";
  return "paints";
}

/** The pane has painted the exact operands the current spec asked it for. */
function keyMatches(cell: Element, run: number, step: number): boolean {
  const key = presentedKey(cell);
  return key.includes(`image:${refHash(run, step)}|`) && key.includes(`image:${fgHash(run, step)}|`);
}

interface CheckResult {
  ok: boolean;
  settleMs: number;
  failures: string[];
}

/**
 * Wait for the grid to settle on `step` and assert the whole invariant set.
 * The wait ends as soon as every pane that must paint has stamped the requested
 * key and every pane that must fail shows its failure surface.
 */
async function checkGrid(
  hostId: string,
  step: number,
  label: string,
  mode: "cpu" | "gpu" = "cpu",
): Promise<CheckResult> {
  const started = performance.now();
  const done = (): boolean => {
    const cells = cellsOf(hostId);
    if (cells.length !== RUNS) return false;
    return cells.every((cell, run) =>
      expectationFor(run, step) === "paints" ? keyMatches(cell, run, step) : errorText(cell) !== "",
    );
  };
  await waitFor(done, SETTLE_MS, 20);
  const settleMs = performance.now() - started;
  const measureFrom = performance.now();

  const failures: string[] = [];
  const cells = cellsOf(hostId);
  if (cells.length !== RUNS) {
    measurementWindows.push([measureFrom, performance.now()]);
    failures.push(`${label}: ${cells.length} panes mounted, expected ${RUNS}`);
    return { ok: false, settleMs, failures };
  }
  for (let run = 0; run < RUNS; run++) {
    const cell = cells[run]!;
    const expected = expectationFor(run, step);
    if (showsLoading(cell)) {
      failures.push(`${label}: run ${run} shows "Loading…" (step ${step})`);
    }
    if (expected === "unavailable") {
      if (errorText(cell) === "") {
        failures.push(`${label}: run ${run} was expected to be unavailable at step ${step}, but shows no failure surface`);
      }
      continue;
    }
    const error = errorText(cell);
    if (error !== "") {
      failures.push(`${label}: run ${run} shows a failure surface at step ${step}: ${error.slice(0, 120)}`);
      continue;
    }
    if (!keyMatches(cell, run, step)) {
      failures.push(
        `${label}: run ${run} presented "${presentedKey(cell) || "(nothing)"}" — expected the pair ` +
          `${refHash(run, step)} × ${fgHash(run, step)} (step ${step})`,
      );
      continue;
    }
    const canvas = canvasOf(cell);
    if (!canvas) {
      failures.push(`${label}: run ${run} has no presentation canvas (step ${step})`);
      continue;
    }
    if (mode === "gpu" && !gpuReadbackWorks) {
      // Substitute signal (see `probeGpuCanvasReadback`): the pane holds a live
      // pool handle, has stamped the requested key, and shows no error.
      if (!gpuBackendReady(cell)) {
        failures.push(`${label}: run ${run} has no live GPU backend (data-gpu-backend-ready, step ${step})`);
      }
      continue;
    }
    const px = await centrePixel(canvas);
    if (!px || px[3] === 0) {
      // On the GPU backend a blank canvas has one legitimate-looking cause worth
      // naming in the failure: the pool's LRU may have PARKED this pane's
      // swapchain (`MAX_LIVE_SWAPCHAINS`), even while it is on screen.
      const pool = mode === "gpu"
        ? ` [pool live ${getLiveSwapchainCount()}/${MAX_LIVE_SWAPCHAINS}, this canvas ${
            isCanvasLive(canvas) ? "LIVE" : "PARKED"
          }]`
        : "";
      failures.push(
        `${label}: run ${run} canvas centre is transparent (step ${step}, ` +
          `${canvas.width}x${canvas.height}, px ${px ? `[${[...px].join(",")}]` : "unreadable"})${pool}`,
      );
    }
  }
  measurementWindows.push([measureFrom, performance.now()]);
  return { ok: failures.length === 0, settleMs, failures };
}

// ---------------------------------------------------------------------------
// Long tasks
// ---------------------------------------------------------------------------
const longTasks: Array<{ duration: number; at: number; action: string }> = [];
/**
 * Wall-clock windows in which the HARNESS itself is doing the expensive work —
 * 18 `createImageBitmap` + `drawImage` readbacks per checkpoint. A long task
 * raised in one of these is the measurement's cost, not the product's, and
 * charging it to the pane would make the responsiveness budget meaningless.
 */
const measurementWindows: Array<[number, number]> = [];
const inMeasurement = (at: number): boolean =>
  measurementWindows.some(([from, to]) => at >= from && at <= to);
function observeLongTasks(): void {
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // `currentAction` at DELIVERY time: a long task is delivered in the next
        // idle period, so this names the action it belongs to or the one right
        // after it — enough to point a reader at the phase that stalled.
        longTasks.push({ duration: entry.duration, at: entry.startTime, action: currentAction });
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {
    /* no longtask support — the assertion below reports it as unobserved */
  }
}

// ---------------------------------------------------------------------------
// Gestures
// ---------------------------------------------------------------------------
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

function surfaceOf(cell: Element): HTMLElement | null {
  return cell.querySelector<HTMLElement>("[data-gpu-image-surface], [data-cpu-image-surface]");
}

async function wheelZooms(el: HTMLElement, count: number): Promise<void> {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    await nextFrame();
    el.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: i % 4 === 3 ? 60 : -60,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        clientX: cx,
        clientY: cy,
      }),
    );
  }
}

async function panDrag(el: HTMLElement): Promise<void> {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const opts = (x: number, y: number) => ({
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  el.dispatchEvent(new PointerEvent("pointerdown", opts(cx, cy)));
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 0) await nextFrame();
    el.dispatchEvent(new PointerEvent("pointermove", opts(cx + i * 3, cy + i * 2)));
  }
  el.dispatchEvent(new PointerEvent("pointerup", opts(cx + 48, cy + 32)));
  await nextFrame();
}

// ---------------------------------------------------------------------------
// The grid scenario
// ---------------------------------------------------------------------------
function gridMountEl(): HTMLElement {
  const host = document.getElementById("grid-host")!;
  host.innerHTML = "";
  const el = document.createElement("div");
  el.style.cssText = "width:100%;height:100%";
  host.appendChild(el);
  return el;
}

function mountGrid(step: number, operation: Operation): MountedPlot {
  return mountPlot(gridMountEl(), {
    spec: specFor(step, operation),
    dataSource: source,
    className: "",
    sizing: "fill",
    autoHeight: false,
  });
}

interface Timing { label: string; ms: number; settleMs: number }

async function runGridScenario(mode: "cpu" | "gpu"): Promise<boolean> {
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = mode;
  hashPrefix = `${mode}-`;
  let ok = true;
  const timings: Timing[] = [];
  const fail = (lines: string[]): void => {
    ok = false;
    for (const line of lines.slice(0, 6)) report(false, `[${mode}] ${line}`);
    if (lines.length > 6) report(false, `[${mode}] … and ${lines.length - 6} more failures`);
  };

  // --- cold mount --------------------------------------------------------
  currentAction = `${mode} cold mount`;
  let plot = mountGrid(0, "split");
  observeLoading("grid-host");
  const mounted = await waitFor(() => cellsOf("grid-host").length === RUNS, MOUNT_MS, 25);
  report(mounted, `[${mode}] the 18-pane compare grid mounts (${cellsOf("grid-host").length} panes)`);
  if (!mounted) {
    plot.destroy();
    return false;
  }
  const cold = await waitFor(
    () => cellsOf("grid-host").every((cell, run) =>
      expectationFor(run, 0) === "paints" ? keyMatches(cell, run, 0) : errorText(cell) !== ""),
    MOUNT_MS, 25,
  );
  report(cold, `[${mode}] every pane paints its first frame`);
  ok = ok && cold;

  // The hold baseline. Every pane has painted once, so from here NO pane may
  // ever fall back to the "Loading…" placeholder while the host stays mounted.
  let placeholderBaseline = placeholderMounts();
  let blinkMark = loadingBlinks.length;

  // --- 20 step changes ---------------------------------------------------
  for (let step = 1; step < STEPS; step++) {
    const t0 = performance.now();
    currentAction = `${mode} step ${step}`;
    plot.update({ spec: specFor(step, "split") });
    const result = await checkGrid("grid-host", step, `step ${step}`, mode);
    timings.push({ label: `step ${step}`, ms: performance.now() - t0, settleMs: result.settleMs });
    if (!result.ok) fail(result.failures);
  }
  const slowest = timings.reduce((a, b) => (b.settleMs > a.settleMs ? b : a), timings[0]!);
  report(
    ok,
    `[${mode}] ${STEPS - 1} step changes: every pane presented the requested pair, painted a ` +
      `non-transparent centre, and the three broken panes recovered at the next step ` +
      `(slowest settle ${slowest.settleMs.toFixed(0)} ms at "${slowest.label}", ` +
      `median ${median(timings.map((t) => t.settleMs)).toFixed(0)} ms)`,
  );
  const stepBlinks = blinksSince(blinkMark).filter((b) => !isExpectedBlink(b));
  const heldOk = stepBlinks.length === 0;
  report(
    heldOk,
    `[${mode}] HOLD: no pane that had painted fell back to "Loading…" across the step storm ` +
      `(placeholderMounts ${placeholderBaseline} → ${placeholderMounts()}, ` +
      `first-mount blinks excluded; unexpected blinks: ${describeBlinks(stepBlinks)})`,
  );
  ok = ok && heldOk;
  blinkMark = loadingBlinks.length;

  // --- operation changes: split → difference → flip → split --------------
  const lastStep = STEPS - 1;
  for (const operation of ["absolute", "flip", "split"] as Operation[]) {
    const t0 = performance.now();
    // Exactly cairn's two writes: the authored node changes comparison topology,
    // the live settings patch reaches the already-mounted cells.
    currentAction = `${mode} operation ${operation}`;
    plot.update({ spec: specFor(lastStep, operation) });
    plot.patchSettings({ "compare.operation": operation });
    const result = await checkGrid("grid-host", lastStep, `operation ${operation}`, mode);
    timings.push({ label: `op ${operation}`, ms: performance.now() - t0, settleMs: result.settleMs });
    if (!result.ok) fail(result.failures);
    // Guard against a vacuous pass: prove the operation REALLY changed the
    // pane, not just the authored spec. The CPU pane advertises its live
    // comparison result; a split pane advertises none.
    const first = cellsOf("grid-host")[0]!;
    const advertised = first.querySelector("[data-cpu-comparison-result]")
      ?.getAttribute("data-cpu-comparison-result") ?? null;
    const probe = paneOperationProbe(first);
    const effective = probe ?? advertised;
    const applied = operation === "split"
      ? effective === null || effective === "split"
      : effective !== null && effective !== "split";
    report(
      applied,
      `[${mode}] operation → ${operation} reached the mounted panes (pane 0 reports ${
        effective === null ? "split/none" : effective
      })`,
    );
    ok = ok && applied;
  }

  // --- 10 wheel zooms + a pan on pane 0 ----------------------------------
  {
    const t0 = performance.now();
    currentAction = `${mode} zoom+pan`;
    const surface = surfaceOf(cellsOf("grid-host")[0]!);
    const gestureOk = !!surface;
    report(gestureOk, `[${mode}] pane 0 exposes a gesture surface`);
    if (surface) {
      await wheelZooms(surface, 10);
      await panDrag(surface);
    }
    const result = await checkGrid("grid-host", lastStep, "after zoom+pan", mode);
    timings.push({ label: "zoom+pan", ms: performance.now() - t0, settleMs: result.settleMs });
    if (!result.ok) fail(result.failures);
    report(
      result.ok,
      `[${mode}] 10 wheel zooms + a pan on pane 0 leave every pane painting ` +
        `(settle ${result.settleMs.toFixed(0)} ms)`,
    );
    ok = ok && gestureOk && result.ok;
  }
  const gestureBlinks = blinksSince(blinkMark).filter((b) => !isExpectedBlink(b));
  const heldThroughGestures = gestureBlinks.length === 0;
  report(
    heldThroughGestures,
    `[${mode}] HOLD: still no "Loading…" after the operation changes and gestures ` +
      `(placeholderMounts ${placeholderMounts()}; unexpected blinks: ${describeBlinks(gestureBlinks)})`,
  );
  ok = ok && heldThroughGestures;

  // --- host unmount + remount (the settings-panel shape) -----------------
  {
    const t0 = performance.now();
    currentAction = `${mode} remount`;
    plot.destroy();
    await nextFrame();
    plot = mountGrid(lastStep, "split");
    observeLoading("grid-host");
    const back = await waitFor(
      () => cellsOf("grid-host").length === RUNS &&
        cellsOf("grid-host").every((cell, run) =>
          expectationFor(run, lastStep) === "paints" ? keyMatches(cell, run, lastStep) : errorText(cell) !== ""),
      SETTLE_MS, 25,
    );
    const result = await checkGrid("grid-host", lastStep, "after remount", mode);
    timings.push({ label: "remount", ms: performance.now() - t0, settleMs: result.settleMs });
    if (!result.ok) fail(result.failures);
    report(
      back && result.ok,
      `[${mode}] a full host unmount + remount repaints every pane within ${SETTLE_MS} ms ` +
        `(${result.settleMs.toFixed(0)} ms)`,
    );
    ok = ok && back && result.ok;
    placeholderBaseline = placeholderMounts(); // a cold remount legitimately placeholders
    blinkMark = loadingBlinks.length;
  }

  // --- window resize ------------------------------------------------------
  {
    const t0 = performance.now();
    currentAction = `${mode} resize`;
    const host = document.getElementById("grid-host")!;
    host.style.width = "980px";
    window.dispatchEvent(new Event("resize"));
    await nextFrame();
    const result = await checkGrid("grid-host", lastStep, "after resize", mode);
    timings.push({ label: "resize", ms: performance.now() - t0, settleMs: result.settleMs });
    if (!result.ok) fail(result.failures);
    report(result.ok, `[${mode}] a resize leaves every pane painting (settle ${result.settleMs.toFixed(0)} ms)`);
    ok = ok && result.ok;
    host.style.width = "1260px";
    window.dispatchEvent(new Event("resize"));
    await nextFrame();
  }
  const remountBlinks = blinksSince(blinkMark).filter((b) => !isExpectedBlink(b));
  const heldAfterRemount = remountBlinks.length === 0;
  report(
    heldAfterRemount,
    `[${mode}] HOLD: the resize did not drop any pane to "Loading…" ` +
      `(placeholderMounts ${placeholderMounts()}; unexpected blinks: ${describeBlinks(remountBlinks)})`,
  );
  ok = ok && heldAfterRemount;

  report(
    true,
    `[${mode}] per-action wall clock — ${timings
      .map((t) => `${t.label} ${t.ms.toFixed(0)}ms`)
      .join(", ")}`,
  );

  plot.destroy();
  loadingObserver?.disconnect();
  loadingObserver = null;
  await nextFrame();
  return ok;
}

/** Compact "run 4 @ cpu step 5, run 9 @ cpu step 8" attribution for a blink list. */
function describeBlinks(blinks: Array<{ action: string; run: number }>): string {
  if (blinks.length === 0) return "none";
  return blinks.map((b) => `run ${b.run} @ ${b.action}`).join(", ");
}

/**
 * The ONE blink this harness accepts: the run that had no artifact at all until
 * `BLANK_UNTIL` mounts a compare pane for the first time at that step. It has
 * never painted, so it has no previous frame to hold — the placeholder there is
 * the honest answer, not the regression. Every other blink is a pane that HAD a
 * frame and dropped it.
 */
function isExpectedBlink(blink: { action: string; run: number }): boolean {
  return blink.run === BLANK_RUN && blink.action.endsWith(`step ${BLANK_UNTIL}`);
}

/** The GPU pane's own probe (`__cairnImageDiffProbe`), when this backend has one. */
function paneOperationProbe(cell: Element): string | null {
  type SeamEl = Element & { __cairnImageDiffProbe?: { comparisonOperationId?: string; compareMode?: string } };
  const read = (el: SeamEl) => el.__cairnImageDiffProbe;
  const probe = read(cell as SeamEl) ??
    Array.from(cell.querySelectorAll("*")).map((n) => read(n as SeamEl)).find(Boolean);
  if (!probe) return null;
  if (probe.compareMode === "split") return "split";
  return probe.comparisonOperationId ?? null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1]!;
}

// ---------------------------------------------------------------------------
// H2 — a resolve that fails ONCE recovers after the backoff, with NO node change
// ---------------------------------------------------------------------------
async function runH2(fixtures: Map<string, ArrayBuffer>): Promise<boolean> {
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  const fg = "h2-foreground";
  const ref = "h2-reference";
  store.set(fg, fixtures.get(REFERENCE_FIXTURE)!);
  store.set(ref, fixtures.get("rgb-zip-half-64x48.exr")!);
  failOnce.set(fg, 1); // the FIRST bytes() call rejects; every later one succeeds

  const host = document.getElementById("h2-host")!;
  host.innerHTML = "";
  const el = document.createElement("div");
  el.style.cssText = "width:100%;height:100%";
  host.appendChild(el);
  const spec: PlotSpec = {
    root: {
      kind: "grid",
      children: [{
        kind: "compare",
        id: "h2",
        type: "image",
        presentation: "split",
        operands: [
          { kind: "image", hash: ref, format: "exr" },
          { kind: "image", hash: fg, format: "exr" },
        ],
        strategy: "reference",
        referenceIndex: 0,
        props: { toolbar: false, holdPreviousWhileLoading: true },
      }],
      cols: 1,
      rowHeights: ["150px"],
      switchable: false,
    },
  };
  const plot = mountPlot(el, { spec, dataSource: source, className: "", sizing: "fill", autoHeight: false });

  const failed = await waitFor(
    () => cellsOf("h2-host").some((cell) => errorText(cell) !== ""),
    SETTLE_MS, 20,
  );
  report(failed, `H2: the pane surfaces the first (simulated) resolve failure — "${
    (cellsOf("h2-host")[0] ? errorText(cellsOf("h2-host")[0]!) : "").slice(0, 80)
  }"`);

  // NOTHING is touched from here: no spec update, no scroll, no settings edit.
  // Only the resolution cache's own error TTL (RESOLVE_ERROR_TTL_MS = 2000) may
  // wake the leaf's resolve effect.
  const t0 = performance.now();
  const recovered = await waitFor(
    () => cellsOf("h2-host").some((cell) => errorText(cell) === "" && presentedKey(cell).includes(`image:${fg}|`)),
    8000, 50,
  );
  report(
    recovered,
    `H2: the pane recovers on its own ${(performance.now() - t0).toFixed(0)} ms after the failure, ` +
      `with NO spec change, no scroll and no settings edit`,
  );
  plot.destroy();
  return failed && recovered;
}

// ---------------------------------------------------------------------------
// H13 — the lazy gate mounts panes it could not observe at attach time
// ---------------------------------------------------------------------------
function h13Spec(hash: string): PlotSpec {
  return {
    root: {
      kind: "grid",
      children: [{
        kind: "plot",
        id: "h13",
        type: "image",
        data: { kind: "image", hash, format: "exr" },
        props: { toolbar: false },
      }],
      cols: 1,
      rowHeights: ["150px"],
      switchable: false,
    },
  };
}

/**
 * H13a — the placeholder is not laid out when the gate's effect first runs. The
 * host is mounted into a DETACHED element (the strongest form of "the element
 * React hands the gate cannot be observed yet") and attached one frame later;
 * the gate must still mount the pane, via its bounded attach retry and the
 * `ResizeObserver` that re-observes the placeholder once it gains a box.
 */
async function runH13a(fixtures: Map<string, ArrayBuffer>): Promise<boolean> {
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  const hash = "h13a-image";
  store.set(hash, fixtures.get("tiled-zip-half-64x48.exr")!);
  const host = document.getElementById("h13a-host")!;
  host.innerHTML = "";
  const detached = document.createElement("div");
  detached.style.cssText = "width:100%;height:100%";
  const plot = mountPlot(detached, {
    spec: h13Spec(hash),
    dataSource: source,
    className: "",
    sizing: "fill",
    autoHeight: false,
  });
  await nextFrame();
  await nextFrame();
  const mountedWhileDetached = cellsOf("h13a-host").length;
  host.appendChild(detached);
  const painted = await waitFor(
    () => cellsOf("h13a-host").some((cell) => !!canvasOf(cell) && presentedKey(cell).includes(`image:${hash}|`)),
    SETTLE_MS, 25,
  );
  report(
    painted,
    `H13a: a pane whose placeholder was not in the document when the lazy gate's effect ran ` +
      `mounts and paints once it is attached (${mountedWhileDetached} panes while detached)`,
  );
  plot.destroy();
  return painted;
}

/**
 * H13b — the pane sits in a `display:none` panel at attach time (a collapsed
 * settings section / a hidden tab). The IntersectionObserver can never report it
 * while the panel is hidden; the gate's `ResizeObserver` must re-observe it the
 * moment the panel gains a box.
 */
async function runH13b(fixtures: Map<string, ArrayBuffer>): Promise<boolean> {
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  const hash = "h13b-image";
  store.set(hash, fixtures.get("luma-chroma-64x48.exr")!);
  const host = document.getElementById("h13b-host")!;
  host.innerHTML = "";
  host.style.display = "none";
  const el = document.createElement("div");
  el.style.cssText = "width:100%;height:100%";
  host.appendChild(el);
  const plot = mountPlot(el, {
    spec: h13Spec(hash),
    dataSource: source,
    className: "",
    sizing: "fill",
    autoHeight: false,
  });
  await sleep(300);
  const mountedWhileHidden = cellsOf("h13b-host").filter((cell) => !!canvasOf(cell)).length;
  host.style.display = "block";
  const painted = await waitFor(
    () => cellsOf("h13b-host").some((cell) => !!canvasOf(cell) && presentedKey(cell).includes(`image:${hash}|`)),
    SETTLE_MS, 25,
  );
  report(
    painted,
    `H13b: a pane inside a display:none panel mounts and paints once the panel is shown ` +
      `(${mountedWhileHidden} painted while hidden)`,
  );
  plot.destroy();
  return painted;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function run(): Promise<boolean> {
  observeLongTasks();
  const fixtures = await loadFixtures();
  seedStore(fixtures);
  report(true, `fixtures loaded (${fixtures.size}), ${store.size} synthetic hashes registered`);

  let ok = await runGridScenario("cpu");
  if ((navigator as unknown as { gpu?: unknown }).gpu) {
    gpuReadbackWorks = await probeGpuCanvasReadback();
    report(
      true,
      gpuReadbackWorks
        ? "WebGPU canvas readback WORKS on this host — the GPU panes carry the strict centre-pixel assertion"
        : "WebGPU canvas readback is BLANK on this host (a cleared-to-red probe canvas reads back " +
          "transparent), so the GPU panes are proven painted by data-gpu-backend-ready + the presented " +
          "key instead of by pixels. The CPU pass keeps the strict pixel assertion.",
    );
    ok = (await runGridScenario("gpu")) && ok;
  } else {
    report(true, "no navigator.gpu — the WebGPU pass is skipped on this host");
  }

  ok = (await runH2(fixtures)) && ok;
  ok = (await runH13a(fixtures)) && ok;
  ok = (await runH13b(fixtures)) && ok;

  const charged = longTasks.filter((t) => !inMeasurement(t.at));
  const worst = charged.reduce((a, b) => (b.duration > a ? b.duration : a), 0);
  const over = charged.filter((t) => t.duration > LONG_TASK_MS);
  report(
    over.length === 0,
    `responsiveness: ${charged.length} long tasks charged to the app (${longTasks.length} observed, ` +
      `the rest inside the harness's own readback windows), longest ${worst.toFixed(0)} ms ` +
      `(budget ${LONG_TASK_MS} ms${
        over.length ? `, over budget: ${over.map((t) => `${t.duration.toFixed(0)}ms @ ${t.action}`).join(", ")}` : ""
      })`,
  );
  return ok && over.length === 0;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
