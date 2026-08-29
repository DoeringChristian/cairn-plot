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
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../../plots/register-core";
import type { PlotSpec } from "../../../../../packages/spec/src/spec.ts";
import { registerRuntimeEntries } from "../../../resources/data/runtime-store";
import { createHarness, sleep, waitFor } from "../../harness";

registerCoreRenderers();

const { report, setOverallStatus } = createHarness({ title: "ENLARGE-CHANNEL" });

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

function descriptor(): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "plot",
      type: "image",
      data: { kind: "imghdr", hash: "runtime:rgb", meta: {} },
      props: { toolbar: true, label: "enlarge-channel" },
    },
  } as unknown as PlotSpec;
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
  root.render(createElement(PlotApp, { spec: descriptor() }));

  // --- 1. pane ready: enlarge button + CHANNELS menu -----------------------
  const ready = await waitFor(() => !!enlargeBtn() && !!channelsBtn(), 8000, 30);
  report(ready, "the pane mounts with an enlarge button and a CHANNELS menu");
  if (!ready) {
    root.unmount();
    return false;
  }

  // --- 2. enlarge → fullscreen overlay -------------------------------------
  enlargeBtn()!.click();
  const opened = await waitFor(() => !!overlay(), 8000, 30);
  report(opened, "clicking enlarge opens the fullscreen overlay");
  ok = ok && opened;

  // --- 3. pick a single channel — must STAY fullscreen ---------------------
  // Open the CHANNELS menu (the enlarged pane's toolbar) and click the
  // single-channel "R" option (portaled listbox).
  channelsBtn()!.click();
  const listbox = await waitFor(() => !!document.querySelector('ul[role="listbox"]'), 3000, 30);
  report(listbox, "the CHANNELS menu opens a listbox");
  ok = ok && listbox;
  // The clickable element is the BUTTON inside each option li.
  const rOption = Array.from(
    document.querySelectorAll<HTMLElement>('ul[role="listbox"] [role="option"] button'),
  ).find((el) => /(^|\s|·)R$/.test((el.textContent ?? "").trim()));
  report(!!rOption, `a single-channel R option exists (${rOption?.textContent?.trim() ?? "none"})`);
  ok = ok && !!rOption;
  // CHANNEL-PICK HOLD contract (user ruling: a pick must NEVER create a new
  // pane): the pending re-resolve holds the previous payload on the SAME pane
  // instance — no "Loading…" placeholder commit, no pane remount, and the
  // fullscreen overlay stays up CONTINUOUSLY through the swap-in-place.
  const stats = (window as unknown as { __cairnLeafResolveStats?: { placeholderMounts: number } })
    .__cairnLeafResolveStats;
  const placeholdersBefore = stats?.placeholderMounts ?? -1;
  const paneBefore = document.querySelector("[data-gpu-image-pane], [data-cpu-image-pane]");
  rOption?.click();

  // Watch continuity for a settle window: the overlay and the SAME pane element
  // must be present on every tick (a placeholder swap would break both).
  let overlayDropped = false;
  let paneSwapped = false;
  const settleUntil = Date.now() + 1200;
  while (Date.now() < settleUntil) {
    if (!overlay()) overlayDropped = true;
    const paneNow = document.querySelector("[data-gpu-image-pane], [data-cpu-image-pane]");
    if (paneNow !== paneBefore) paneSwapped = true;
    await sleep(30);
  }
  const placeholdersAfter = stats?.placeholderMounts ?? -1;
  report(
    placeholdersAfter === placeholdersBefore,
    `NO placeholder commit during the pick (placeholderMounts ${placeholdersBefore} → ${placeholdersAfter})`,
  );
  report(!paneSwapped, "the pane element is the SAME instance throughout (never recreated)");
  report(!overlayDropped, "the fullscreen overlay stays up CONTINUOUSLY (no flicker window)");
  ok = ok && placeholdersAfter === placeholdersBefore && !paneSwapped && !overlayDropped;

  // PREMISE GUARD: the pick must actually have APPLIED (the first draft of
  // this harness clicked the option <li> instead of its inner <button> and
  // asserted vacuously). Reopen the menu: the "· R" option must be selected.
  channelsBtn()!.click();
  await waitFor(() => !!document.querySelector('ul[role="listbox"]'), 3000, 30);
  const selectedOpt = Array.from(
    document.querySelectorAll<HTMLElement>('ul[role="listbox"] [role="option"][aria-selected="true"]'),
  );
  const rApplied = selectedOpt.some((el) => /(^|\s|·)R$/.test((el.textContent ?? "").trim()));
  report(
    rApplied,
    `the R pick APPLIED (selected option: ${selectedOpt.map((e) => e.textContent?.trim()).join(", ") || "none"})`,
  );
  ok = ok && rApplied;
  // Close the menu by toggling its button (NOT Escape — the fullscreen shell
  // listens for Escape at capture and would close the overlay under us).
  channelsBtn()!.click();
  await sleep(50);
  const stillFullscreen = !!overlay();
  report(stillFullscreen, "the pane is STILL FULLSCREEN after the channel change (the reported bug)");
  ok = ok && stillFullscreen;

  // --- 4. Escape exits fullscreen (hoisted state still closes) -------------
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const closed = await waitFor(() => !overlay(), 3000, 30);
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
