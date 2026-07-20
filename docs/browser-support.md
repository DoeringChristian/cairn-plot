# WebGPU & HDR — browser support and how to enable it

cairn-plot uses **WebGPU** for the GPU image panes and the compare engine
(diff kernels incl. FLIP/HDR-FLIP, split/blend compositing, float/EXR
sources) and — where the browser supports it — an **HDR (extended dynamic
range) canvas** so true-float images can drive display brightness above SDR
white.

Nothing breaks without WebGPU: panes fall back to the CPU backend
automatically (`render mode: auto`). You can force a backend for testing via
the URL (`?render=cpu` / `?render=gpu`) or
`window.__cairnPlotRenderMode = "cpu" | "gpu"` before the page mounts.
GPU-only features (FLIP kernels, HDR compare) simply don't appear in the
menus when the engine is unavailable.

Two independent layers matter:

1. **WebGPU itself** — the compute/render API (`navigator.gpu`).
2. **HDR canvas output** — a WebGPU canvas configured with an
   `rgba16float` surface and `toneMapping: { mode: "extended" }`, plus an
   HDR/EDR-capable display with HDR enabled in the OS. Without this layer
   cairn-plot still runs the full GPU pipeline and tone-maps into SDR.

Quick check from any page's devtools console:

```js
!!navigator.gpu && (await navigator.gpu.requestAdapter()) !== null   // WebGPU
```

Status below is as of early 2026 — browsers move fast here; when in doubt,
run the check above.

## Chrome / Edge (Chromium)

- **WebGPU**: enabled by default since Chrome/Edge 113 on Windows, macOS and
  ChromeOS (Android since 121).
- **Linux**: still gated. Enable `chrome://flags/#enable-unsafe-webgpu` and
  `chrome://flags/#enable-vulkan`, or launch with
  `--enable-features=Vulkan --enable-unsafe-webgpu`.
- **HDR output**: Chromium 129+ implements canvas
  `toneMapping: { mode: "extended" }`. You additionally need an HDR display
  with OS HDR on:
  - **macOS**: EDR engages automatically on capable displays (Apple XDR
    panels, most recent MacBook Pro screens) — no setting needed.
  - **Windows**: Settings → System → Display → *Use HDR* must be ON.

## Brave

Brave follows Chromium, so everything above applies (`brave://flags`). Two
Brave-specific gotchas:

- **Shields / fingerprint protection** can block or randomize WebGPU adapter
  access. If `requestAdapter()` returns `null` on a site where Chrome works,
  drop Shields for that site (or set *Block fingerprinting* → *Disabled* in
  the site's Shields panel).
- Hardware acceleration must be on: `brave://settings/system` → *Use
  graphics acceleration when available*.

## Firefox

- **WebGPU**: enabled by default on **Windows since Firefox 141**. On
  **macOS and Linux** (and older Windows versions) enable it manually:
  1. Open `about:config`.
  2. Set `dom.webgpu.enabled` → `true`.
  3. If `requestAdapter()` still returns `null`, also set
     `gfx.webgpu.force-enabled` → `true` (bypasses the GPU blocklist — use
     only for testing).
  4. Restart Firefox. **Firefox Nightly** has the most complete and current
     WebGPU implementation and is the recommended channel for it.
- **HDR output**: Firefox does **not** yet implement the canvas
  `toneMapping: "extended"` path, so there is no way to enable true HDR
  output — cairn-plot detects this and renders the HDR pipeline tone-mapped
  into SDR (all controls still work; peak highlights clip to SDR white).

## Safari

- **WebGPU**: enabled by default in **Safari 26** (macOS Tahoe / iOS 26 /
  visionOS 26). On Safari 17–18 and Technology Preview: Develop menu →
  *Feature Flags* → enable **WebGPU** (enable the Develop menu first under
  Settings → Advanced).
- **HDR output**: Apple displays are EDR-capable and macOS engages EDR
  automatically, but Safari's WebGPU canvas tone-mapping support is still
  maturing — run the console check and cairn-plot's HDR demo to see what
  your Safari version delivers; the SDR fallback covers the rest.

## What cairn-plot does per capability

| Capability detected | Behavior |
| --- | --- |
| No WebGPU | CPU image panes; compare keeps pointwise diff modes; FLIP/HDR-FLIP hidden from menus |
| WebGPU, no HDR surface | Full GPU pipeline (all kernels, float sources); tone-mapped SDR output |
| WebGPU + HDR surface + HDR display | True EDR output — float values above 1.0 drive real display brightness |

The pane self-heals downward at runtime (engine loss → CPU fallback), so a
report authored on a WebGPU machine still renders everywhere.
