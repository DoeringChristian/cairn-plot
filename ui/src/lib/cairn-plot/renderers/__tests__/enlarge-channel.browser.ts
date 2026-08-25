/**
 * ENLARGE × CHANNEL-SELECT persistence harness.
 *
 * Repro for the reported bug: enlarge a pane to the single-pane FULLSCREEN
 * overlay, pick a channel in the CHANNELS menu — the pane was thrown OUT of
 * fullscreen. Root cause: a channel change swaps `resolveKey`, the cold
 * re-resolve renders `LeafView`'s "Loading…" placeholder, and the whole
 * renderer subtree (including `ImagePaneShell`, which held `enlarged` as
 * component-LOCAL state) unmounted — remounting with `enlarged = false`.
 *
 * The fix hoists the enlarged flag ABOVE the loading swap boundary (LeafView
 * owns it; the shell consumes it controlled), so this harness mounts a REAL
 * plot tree (PlotApp → LeafView → pane) — NOT a bare pane — and asserts:
 *   1. an RGB float leaf renders with both the ENLARGE button and the
 *      CHANNELS menu;
 *   2. enlarging opens the fullscreen overlay;
 *   3. picking a single channel keeps the pane FULLSCREEN through the
 *      re-resolve (the overlay is present again once the pane is ready, and
 *      the CHANNELS menu still renders — the slice didn't drop it);
 *   4. Escape still exits fullscreen afterward (the hoisted state closes).
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../../plot-renderers";
import type { PlotDescriptor } from "../../../../plot-descriptor";
import { registerRuntimeEntries } from "../../viewport/runtime-store";

registerCoreRenderers();

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

function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "green" : "red";
  }
  document.title = pass ? "ENLARGE-CHANNEL PASS" : "ENLARGE-CHANNEL FAIL";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred: () => boolean, timeoutMs = 8000, step = 30): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await sleep(step);
  }
  return pred();
}

// An RGB float source whose channels differ (R = x ramp, G = y ramp, B = 0.5)
// so a single-channel slice genuinely changes the payload.
function registerFloatData(): void {
  const W = 32;
  const H = 32;
  const d = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      d[i] = x / (W - 1);
      d[i + 1] = y / (H - 1);
      d[i + 2] = 0.5;
    }
  registerRuntimeEntries({
    "runtime:rgb": { kind: "float" as const, data: d, shape: [H, W, 3], dtype: "<f4", precision: "f32" as const },
  });
}

function descriptor(): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "plot",
      renderer: "image",
      data: { kind: "imghdr", hash: "runtime:rgb", meta: {} },
      props: { toolbar: true, label: "enlarge-channel" },
    },
  } as unknown as PlotDescriptor;
}

const enlargeBtn = () =>
  document.querySelector<HTMLButtonElement>('button[title="Enlarge (fullscreen)"]');
const overlay = () => document.querySelector<HTMLElement>("[data-cairn-plot-enlarge-backdrop]");
const channelsBtn = () =>
  document.querySelector<HTMLButtonElement>('button[title^="Channels"]');

async function run(): Promise<boolean> {
  let ok = true;
  registerFloatData();
  const host = document.getElementById("mount")!;
  const root: Root = createRoot(host);
  root.render(createElement(PlotApp, { descriptor: descriptor() }));

  // --- 1. pane ready: enlarge button + CHANNELS menu -----------------------
  const ready = await waitFor(() => !!enlargeBtn() && !!channelsBtn());
  report(ready, "the pane mounts with an enlarge button and a CHANNELS menu");
  if (!ready) {
    root.unmount();
    return false;
  }

  // --- 2. enlarge → fullscreen overlay -------------------------------------
  enlargeBtn()!.click();
  const opened = await waitFor(() => !!overlay());
  report(opened, "clicking enlarge opens the fullscreen overlay");
  ok = ok && opened;

  // --- 3. pick a single channel — must STAY fullscreen ---------------------
  // Open the CHANNELS menu (the enlarged pane's toolbar) and click the
  // single-channel "R" option (portaled listbox).
  channelsBtn()!.click();
  const listbox = await waitFor(() => !!document.querySelector('ul[role="listbox"]'), 3000);
  report(listbox, "the CHANNELS menu opens a listbox");
  ok = ok && listbox;
  // The clickable element is the BUTTON inside each option li.
  const rOption = Array.from(
    document.querySelectorAll<HTMLElement>('ul[role="listbox"] [role="option"] button'),
  ).find((el) => /(^|\s|·)R$/.test((el.textContent ?? "").trim()));
  report(!!rOption, `a single-channel R option exists (${rOption?.textContent?.trim() ?? "none"})`);
  ok = ok && !!rOption;
  // Diagnostics: did the pick actually trigger a COLD re-resolve (a "Loading…"
  // placeholder commit — the subtree unmount that used to reset `enlarged`),
  // and did the pane element remount?
  const stats = (window as unknown as { __cairnLeafResolveStats?: { placeholderMounts: number } })
    .__cairnLeafResolveStats;
  const placeholdersBefore = stats?.placeholderMounts ?? -1;
  const paneBefore = document.querySelector("[data-gpu-image-pane], [data-cpu-image-pane]");
  rOption?.click();

  // The re-resolve may pass through a loading state; once the pane is READY
  // again (channels menu back), fullscreen must still be showing.
  const readyAgain = await waitFor(() => !!channelsBtn(), 8000);
  report(readyAgain, "the pane re-resolves after the channel pick (CHANNELS menu returns)");
  ok = ok && readyAgain;
  // PREMISE GUARD: the pick must have gone through a COLD re-resolve (a
  // "Loading…" placeholder commit — the subtree unmount that used to reset the
  // enlarged flag). Without this the fullscreen assertion below can pass
  // vacuously (e.g. a click that never applied — the first version of this
  // harness did exactly that).
  const placeholdersAfter = stats?.placeholderMounts ?? -1;
  const paneAfter = document.querySelector("[data-gpu-image-pane], [data-cpu-image-pane]");
  report(
    placeholdersAfter > placeholdersBefore,
    `the pick triggered a COLD re-resolve (placeholderMounts ${placeholdersBefore} → ${placeholdersAfter}; pane ${paneBefore === paneAfter ? "same" : "remounted"})`,
  );
  ok = ok && placeholdersAfter > placeholdersBefore;
  // Let a couple frames settle so a late enlarged-reset would be visible.
  await sleep(200);
  const stillFullscreen = !!overlay();
  report(stillFullscreen, "the pane is STILL FULLSCREEN after the channel change (the reported bug)");
  ok = ok && stillFullscreen;

  // --- 4. Escape exits fullscreen (hoisted state still closes) -------------
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const closed = await waitFor(() => !overlay(), 3000);
  report(closed, "Escape exits fullscreen after the channel change");
  ok = ok && closed;

  root.unmount();
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
