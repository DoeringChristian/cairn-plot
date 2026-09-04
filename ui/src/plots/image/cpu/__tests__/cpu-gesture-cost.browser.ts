/**
 * GESTURE COST — a pan/zoom on a CPU image pane must be PRESENTATION-ONLY.
 *
 * The CPU backend is split into a CONTENT stage (`use-cpu-content.ts`: decode,
 * diff, false-colour, transfer, tone-map — keyed and cached, producing one
 * `ImageBitmap`) and a PRESENTATION stage (`paint.ts`: one identity-transform
 * `drawImage` of that bitmap into the viewport canvas at `viewport.quad`).
 * Zoom and pan change ONLY the viewport, so a gesture must re-run the
 * presentation and nothing else. The regression this guards is invisible to a
 * unit test and to the eye on a small image: re-running a content pass, or
 * re-allocating the canvas backing store, per gesture event turns a 4096x4096
 * pan into a slideshow. It is measured here by counting the NATIVE calls that a
 * content pass cannot avoid making:
 *
 *   createImageBitmap              — every content pass ends in one
 *                                    (`toPaintSource` / `bitmapFromUrl`).
 *   ctx.putImageData               — the no-`createImageBitmap` fallback of the
 *                                    same stage.
 *   ctx.getImageData               — the decode/readback path (`loadImageData`,
 *                                    which feeds the TEV numbers) — cached per
 *                                    URL, so a gesture must never reach it.
 *   canvas.width = ...             — a backing-store REALLOCATION, which also
 *                                    clears the canvas. Legal on a container
 *                                    resize, never on a gesture.
 *   ctx.drawImage (on the pane canvas) — the presentation blit. Allowed, but at
 *                                    most ONCE PER ANIMATION FRAME: the gesture
 *                                    hook coalesces its emissions onto a rAF, so
 *                                    120 pointer events must not become 120
 *                                    paints.
 *   ResizeObserver.observe         — exactly one per pane, installed at mount;
 *                                    a gesture (or a resize) must never add more.
 *
 * Both source shapes are exercised, because they take different content paths: a
 * 4096x4096 uint8 data URL (decoded straight to a bitmap) and a 2048x2048x3
 * float buffer (tone-mapped to `ImageData`, then to a bitmap).
 *
 * The counters are prototype spies, installed only AFTER both panes have mounted
 * and painted (so the mount's own legitimate work is not counted) and restored in
 * a `finally`. Pointer capture is stubbed for the same window: a synthetic
 * `PointerEvent` has no real active pointer, so the hook's `setPointerCapture`
 * would throw `NotFoundError` and abort the pan.
 *
 * rAF interval statistics are reported as DIAGNOSTICS only — a headless runner's
 * frame pacing is not a property of this code, so no assertion depends on it.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement as h, useState } from "react";
import CpuImagePane from "../view.tsx";
import { floatValues } from "../../runtime/pixel-buffer.ts";
import type { ImageViewState } from "../../../../host/hooks/use-image-gestures";
import { createHarness, waitFor } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({
  title: "CPU-GESTURE-COST",
  colors: { pass: "#6f6", fail: "#f66" },
});

const HOST_W = 480;
const HOST_H = 360;
const WHEEL_EVENTS = 60;
const POINTER_EVENTS = 120;
const POINTER_PER_FRAME = 3;
const RESIZE_STEPS = 30;

const nextFrame = (): Promise<number> => new Promise((r) => requestAnimationFrame(r));

/** A 4096x4096 uint8 PNG data URL — a smooth ramp, so PNG keeps the URL small
 *  while the decoded bitmap is a genuinely large (67 MB) presentation source. */
function largeUint8Url(): string {
  const n = 4096;
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, n, n);
  grad.addColorStop(0, "#102030");
  grad.addColorStop(0.5, "#c04020");
  grad.addColorStop(1, "#20d0a0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, n, n);
  return c.toDataURL("image/png");
}

/** A 2048x2048x3 scene-linear float buffer (the tone-mapped content path). */
function largeFloatPixels(): { pixels: ReturnType<typeof floatValues>; shape: number[] } {
  const n = 2048;
  const data = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y++) {
    const v = y / n;
    for (let x = 0; x < n; x++) {
      const b = (y * n + x) * 3;
      const u = x / n;
      data[b] = u;
      data[b + 1] = v;
      data[b + 2] = 1 - u * v;
    }
  }
  return { pixels: floatValues(data), shape: [n, n, 3] };
}

// ---------------------------------------------------------------------------
// Native-call counters
// ---------------------------------------------------------------------------
interface Counts {
  put: number;
  bitmap: number;
  getImageData: number;
  draw: number;
  widthSets: number;
  observe: number;
}
const counts: Counts = { put: 0, bitmap: 0, getImageData: 0, draw: 0, widthSets: 0, observe: 0 };
/**
 * `ResizeObserver.observe` calls since the spies went up — deliberately NEVER
 * reset, unlike `counts.observe`. The budget is a whole-run property (exactly one
 * observer per pane, installed at mount), so a per-phase counter would only ever
 * report the last phase and a resubscribe during an earlier gesture would go
 * unseen.
 */
let observeSinceMount = 0;
function resetCounts(): void {
  counts.put = 0;
  counts.bitmap = 0;
  counts.getImageData = 0;
  counts.draw = 0;
  counts.widthSets = 0;
  counts.observe = 0;
}
function snapshot(): Counts {
  return { ...counts };
}

/** True for the CPU pane's ONE presentation canvas (never the TEV overlay). */
function isPaneCanvas(canvas: unknown): boolean {
  return (canvas as HTMLCanvasElement | null)?.dataset?.cpuImageCanvas !== undefined;
}

/** Install every spy; returns the restore function (call it in a `finally`). */
function installSpies(): () => void {
  const P = CanvasRenderingContext2D.prototype;
  const origPut = P.putImageData;
  const origDraw = P.drawImage;
  const origGet = P.getImageData;
  const origBitmap = window.createImageBitmap;
  const origObserve = ResizeObserver.prototype.observe;
  const widthDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width")!;
  const origCapture = Element.prototype.setPointerCapture;
  const origRelease = Element.prototype.releasePointerCapture;

  P.putImageData = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
    counts.put++;
    return (origPut as unknown as (...args: unknown[]) => void).apply(this, a);
  } as typeof P.putImageData;

  P.drawImage = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
    if (isPaneCanvas(this.canvas)) counts.draw++;
    return (origDraw as unknown as (...args: unknown[]) => void).apply(this, a);
  } as typeof P.drawImage;

  P.getImageData = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
    counts.getImageData++;
    return (origGet as unknown as (...args: unknown[]) => ImageData).apply(this, a);
  } as typeof P.getImageData;

  window.createImageBitmap = function (...a: unknown[]) {
    counts.bitmap++;
    return (origBitmap as unknown as (...args: unknown[]) => Promise<ImageBitmap>).apply(window, a);
  } as typeof window.createImageBitmap;

  Object.defineProperty(HTMLCanvasElement.prototype, "width", {
    ...widthDesc,
    set(this: HTMLCanvasElement, v: number) {
      if (this.dataset?.cpuImageCanvas !== undefined) counts.widthSets++;
      widthDesc.set!.call(this, v);
    },
  });

  ResizeObserver.prototype.observe = function (this: ResizeObserver, ...a: unknown[]) {
    counts.observe++;
    observeSinceMount++;
    return (origObserve as unknown as (...args: unknown[]) => void).apply(this, a);
  } as typeof ResizeObserver.prototype.observe;

  // A synthetic PointerEvent has no live pointer, so the real capture calls the
  // gesture hook makes would throw NotFoundError and abort the pan.
  Element.prototype.setPointerCapture = function () {};
  Element.prototype.releasePointerCapture = function () {};

  return () => {
    P.putImageData = origPut;
    P.drawImage = origDraw;
    P.getImageData = origGet;
    window.createImageBitmap = origBitmap;
    Object.defineProperty(HTMLCanvasElement.prototype, "width", widthDesc);
    ResizeObserver.prototype.observe = origObserve;
    Element.prototype.setPointerCapture = origCapture;
    Element.prototype.releasePointerCapture = origRelease;
  };
}

// ---------------------------------------------------------------------------
// Frame accounting
// ---------------------------------------------------------------------------
interface FrameStats {
  frames: number;
  meanMs: number;
  maxMs: number;
}
function countFrames(): () => FrameStats {
  let frames = 0;
  let stopped = false;
  let last = -1;
  const gaps: number[] = [];
  const tick = (t: number) => {
    if (stopped) return;
    frames++;
    if (last >= 0) gaps.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    stopped = true;
    const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const max = gaps.length ? Math.max(...gaps) : 0;
    return { frames, meanMs: mean, maxMs: max };
  };
}

// ---------------------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------------------
interface Pane {
  name: string;
  host: HTMLElement;
  root: Root;
  surface: HTMLElement;
  /** The view the pane last emitted. Read back after every gesture: without it
   *  the whole harness passes VACUOUSLY if the events stop being delivered,
   *  since every other assertion is a zero or an upper bound. */
  view: () => ImageViewState;
}

async function mountPane(hostId: string, name: string, source: unknown): Promise<Pane> {
  const host = document.getElementById(hostId)!;
  host.style.cssText = `width:${HOST_W}px;height:${HOST_H}px;position:relative;background:#222`;
  let latest: ImageViewState = { zoom: 1, pan: { x: 0, y: 0 } };
  function Harness() {
    const [v, setV] = useState<ImageViewState>(latest);
    return h(CpuImagePane, {
      source,
      zoom: v.zoom,
      pan: v.pan,
      onViewChange: (next: ImageViewState) => {
        latest = next;
        setV(next);
      },
      label: "",
      toolbar: false,
    } as never);
  }
  const root = createRoot(host);
  root.render(h(Harness));
  const ready = await waitFor(
    () => !!host.querySelector("canvas[data-cpu-image-canvas]"),
    20000,
    30,
  );
  if (!ready) throw new Error(`${name}: pane did not mount`);
  // The presentation canvas is only sized+painted once a content bitmap exists,
  // so a non-zero backing store is the signal that the mount's own content pass
  // has completed and the spies below will see only gesture work.
  const painted = await waitFor(
    () => (host.querySelector("canvas[data-cpu-image-canvas]") as HTMLCanvasElement).width > 0,
    30000,
    50,
  );
  if (!painted) throw new Error(`${name}: pane never painted`);
  return {
    name,
    host,
    root,
    surface: host.querySelector<HTMLElement>("[data-cpu-image-surface]")!,
    view: () => latest,
  };
}

// ---------------------------------------------------------------------------
// Gestures
// ---------------------------------------------------------------------------
/** WHEEL_EVENTS ctrl-wheel zooms (the trackpad-pinch signature), one per frame,
 *  alternating direction so the adaptive zoom cap never swallows an emission. */
async function wheelGesture(el: HTMLElement): Promise<void> {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < WHEEL_EVENTS; i++) {
    await nextFrame();
    el.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: i % 10 < 5 ? -20 : 20,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        clientX: cx,
        clientY: cy,
      }),
    );
  }
}

/** POINTER_EVENTS drag moves under one captured touch pointer, delivered
 *  POINTER_PER_FRAME at a time — the coalescing case (many more events than
 *  frames). */
async function panGesture(el: HTMLElement): Promise<void> {
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
  for (let i = 0; i < POINTER_EVENTS; i++) {
    if (i % POINTER_PER_FRAME === 0) await nextFrame();
    const t = (i / POINTER_EVENTS) * Math.PI * 4;
    el.dispatchEvent(
      new PointerEvent("pointermove", opts(cx + Math.cos(t) * 60, cy + Math.sin(t) * 40)),
    );
  }
  el.dispatchEvent(new PointerEvent("pointerup", opts(cx, cy)));
  await nextFrame();
  await nextFrame();
}

/**
 * Run one gesture and check what it cost.
 *
 * `moved` names the view field the gesture is supposed to change (`zoom` for a
 * wheel, `pan` for a drag). It is READ BACK from the pane afterwards and asserted
 * to have actually moved, and the blit count is bounded from BELOW as well as
 * above — without both, this harness passes vacuously the moment the synthetic
 * events stop reaching the gesture hook, since every other assertion here is a
 * zero or an upper bound.
 */
async function gesturePhase(
  pane: Pane,
  label: string,
  moved: "zoom" | "pan",
  gesture: () => Promise<void>,
): Promise<boolean> {
  resetCounts();
  const before = pane.view();
  const stop = countFrames();
  await gesture();
  const stats = stop();
  const after = pane.view();
  const c = snapshot();
  let ok = true;
  const check = (pass: boolean, msg: string) => {
    report(pass, msg);
    ok = ok && pass;
  };
  const changed =
    moved === "zoom"
      ? after.zoom !== before.zoom
      : after.pan.x !== before.pan.x || after.pan.y !== before.pan.y;
  check(
    changed,
    `${pane.name} ${label}: the gesture actually reached the pane — ${moved} ` +
      `${moved === "zoom" ? `${before.zoom} -> ${after.zoom}` : `(${before.pan.x}, ${before.pan.y}) -> (${after.pan.x}, ${after.pan.y})`}`,
  );
  check(
    c.draw >= Math.floor(stats.frames / 2),
    `${pane.name} ${label}: ${c.draw} presentation blit(s) for ${stats.frames} frame(s) — the pane kept repainting (>= frames/2)`,
  );
  check(c.put === 0, `${pane.name} ${label}: 0 putImageData (got ${c.put})`);
  check(c.bitmap === 0, `${pane.name} ${label}: 0 createImageBitmap — no content pass (got ${c.bitmap})`);
  check(c.getImageData === 0, `${pane.name} ${label}: 0 getImageData — no re-decode (got ${c.getImageData})`);
  check(
    c.widthSets === 0,
    `${pane.name} ${label}: 0 canvas backing-store reallocations (got ${c.widthSets})`,
  );
  check(
    c.draw <= stats.frames + 2,
    `${pane.name} ${label}: ${c.draw} presentation blit(s) for ${stats.frames} frame(s) — at most one per frame (+2 slack)`,
  );
  // `BENCH:` prefix: the runner echoes matching lines even on a PASS, so the
  // measured per-gesture cost is visible in CI output, not only on failure.
  report(
    true,
    `BENCH: ${pane.name} ${label}: ${stats.frames} frames, blits ${c.draw}, ` +
      `createImageBitmap ${c.bitmap}, putImageData ${c.put}, getImageData ${c.getImageData}, ` +
      `canvas.width sets ${c.widthSets}, observe-since-mount ${observeSinceMount}; ` +
      `rAF interval mean ${stats.meanMs.toFixed(1)} ms / max ${stats.maxMs.toFixed(1)} ms`,
  );
  return ok;
}

/** RESIZE_STEPS 1-px container widths — the one case where reallocating the
 *  backing store is CORRECT, so it pins the count from BELOW as well as above. */
async function resizePhase(pane: Pane): Promise<boolean> {
  resetCounts();
  const stop = countFrames();
  for (let i = 0; i < RESIZE_STEPS; i++) {
    pane.host.style.width = `${HOST_W + i + 1}px`;
    await nextFrame();
    await nextFrame();
  }
  const stats = stop();
  const c = snapshot();
  let ok = true;
  const check = (pass: boolean, msg: string) => {
    report(pass, msg);
    ok = ok && pass;
  };
  check(
    c.widthSets >= RESIZE_STEPS - 2 && c.widthSets <= RESIZE_STEPS + 2,
    `${pane.name} resize: ${c.widthSets} backing-store resize(s) for ${RESIZE_STEPS} container widths (expected ${RESIZE_STEPS} +/-2 for coalesced frames)`,
  );
  check(c.put === 0, `${pane.name} resize: 0 putImageData (got ${c.put})`);
  check(
    c.bitmap === 0,
    `${pane.name} resize: 0 createImageBitmap — a resize re-blits the CACHED bitmap (got ${c.bitmap})`,
  );
  check(
    observeSinceMount === 0,
    `${pane.name} resize: 0 ResizeObserver.observe since mount, resize included (got ${observeSinceMount})`,
  );
  report(
    true,
    `BENCH: ${pane.name} resize (${RESIZE_STEPS} widths): ${stats.frames} frames, blits ${c.draw}, ` +
      `canvas.width sets ${c.widthSets}, createImageBitmap ${c.bitmap}, putImageData ${c.put}, ` +
      `getImageData ${c.getImageData}, observe-since-mount ${observeSinceMount}; ` +
      `rAF interval mean ${stats.meanMs.toFixed(1)} ms / max ${stats.maxMs.toFixed(1)} ms`,
  );
  pane.host.style.width = `${HOST_W}px`;
  await nextFrame();
  return ok;
}

async function run(): Promise<boolean> {
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  const float = largeFloatPixels();
  const u8 = await mountPane("host-u8", "uint8-4096", {
    dtype: "uint8",
    url: largeUint8Url(),
    contentKey: "gesture-cost-u8",
  });
  const flt = await mountPane("host-float", "float-2048", {
    dtype: "float",
    pixels: float.pixels,
    shape: float.shape,
    contentKey: "gesture-cost-float",
  });
  report(true, "BENCH: both panes mounted and painted their first frame");

  const restore = installSpies();
  let ok = true;
  try {
    for (const pane of [u8, flt]) {
      ok = (await gesturePhase(pane, "wheel zoom", "zoom", () => wheelGesture(pane.surface))) && ok;
      ok = (await gesturePhase(pane, "pointer pan", "pan", () => panGesture(pane.surface))) && ok;
    }
    // The ResizeObserver budget is a MOUNT-time property: after both panes are
    // up, no gesture may install another observer. `observeSinceMount` spans
    // EVERY phase (never reset), so this cannot silently see only the last one.
    ok = ok && observeSinceMount === 0;
    report(
      observeSinceMount === 0,
      `BENCH: no ResizeObserver.observe across all gesture phases since mount (got ${observeSinceMount})`,
    );
    ok = (await resizePhase(u8)) && ok;
  } finally {
    restore();
  }
  u8.root.unmount();
  flt.root.unmount();
  return ok;
}

run()
  .then(setOverallStatus)
  .catch((e) => {
    report(false, String(e));
    setOverallStatus(false);
  });
