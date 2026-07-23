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
- **HDR output**: Firefox does **not** implement the canvas
  `toneMapping: "extended"` path **at all**, so there is no flag, no
  `about:config` toggle, and no channel (including Nightly) that enables true
  HDR output today. This is a **fundamental browser limitation that cairn-plot
  cannot work around** — the output clips to SDR white until Firefox itself
  ships extended tone mapping. cairn-plot detects this and renders the HDR
  pipeline tone-mapped into SDR (all controls still work; peak highlights clip
  to SDR white), and shows a one-time in-page notice (see below) explaining
  why.

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

## In-page capability notice

When a rendered page hits one of the limits above, cairn-plot shows a single
small, dismissible banner in the bottom-right corner so the reader knows the
degraded output is a **browser/OS limitation, not a cairn-plot bug**. The notice
**diagnoses which layer is missing** and shows one of three messages:

1. **GPU renderer unavailable** (`no-webgpu`) — the page contains GPU-preferring
   content (GPU image / compare panes) but WebGPU is missing entirely, so the
   CPU fallback is active and FLIP kernels + HDR compare are disabled. A
   chart-only page never shows this (it doesn't load the GPU engine at all).
   This message covers HDR implicitly — with no WebGPU there is no HDR canvas —
   and the two HDR messages below can never co-occur with it (they are only
   raised once WebGPU has resolved).
2. **True HDR output unsupported by this browser** (`no-hdr-browser`) — WebGPU
   works, but the browser cannot configure a canvas with
   `toneMapping:{mode:"extended"}`, so true-float HDR images are tone-mapped to
   SDR. This is a **fundamental browser limitation** (Firefox today — see the
   Firefox section above). It is detected by actually probing the browser:
   configuring a throwaway context with the extended-HDR recipe and reading
   `context.getConfiguration().toneMapping.mode` back — a browser that silently
   ignores the `toneMapping` option (rather than throwing) is still correctly
   diagnosed as unsupported.
3. **Display/OS not in HDR mode** (`no-hdr-display`) — WebGPU *and* the browser
   both support extended tone mapping, but the display/OS isn't in HDR mode
   (`matchMedia("(dynamic-range: high)")` is false), so HDR images are
   tone-mapped to SDR. The hint is OS-specific (macOS: EDR engages automatically
   on HDR-capable displays; Windows: Settings → System → Display → *Use HDR*).

When both HDR signals fail (browser lacks extended tone mapping **and** the
display isn't HDR), the notice prefers message 2 — the harder, unworkaroundable
limit.

## EXR decoding (WASM-accelerated)

OpenEXR sources are decoded **WASM-first** by the upstream **OpenEXR C++ library**
(v3.4.9 + Imath v3.2.2, with libdeflate v1.25 and OpenJPH 0.26.3 for HTJ2K),
compiled to WebAssembly with Emscripten (single-threaded — no COOP/COEP needed —
`-msimd128`, wasm exceptions) and shipped inline as base64 (no fetch, so it works
on `file://` and under strict CSP). It runs inside the same persistent Web Worker
that already handles EXR off the main thread, and is instantiated once per worker
lifetime.

Because it is the reference implementation, it decodes **literally every EXR**:

- **All compressions** — NONE, RLE, ZIP(S), PIZ, PXR24, B44/B44A, DWAA/DWAB, **and
  HTJ2K** (High-Throughput JPEG 2000, via OpenJPH).
- **Scanline and tiled** images (all mip/rip levels; the largest level is read).
- **Luminance-chroma** (Y/RY/BY) — reconstructed natively to RGBA (stays `HALF`).
- **Deep** (`deepscanline`/`deeptile`) — flattened for display by sorting each
  pixel's samples front-to-back by Z and compositing with premultiplied OVER. A
  single-image deep pane also shows a toolbar **DEPTH WINDOW** — Z-NEAR + Z-FAR
  sliders that restrict compositing to samples with `zNear ≤ Z ≤ zFar` (default
  the full range) — plus a **"select depth from region"** marquee button: drag a
  rectangle and the window snaps to the Z range the samples inside that pixel
  region occupy (Esc cancels; an empty region is a no-op). On a GPU-backed pane
  the samples are uploaded to GPU storage buffers once and re-composited per
  window by a fragment pass (`compositeDeep`) — **real-time** (≈0.2 ms/tick at
  1080p Trunks scale), no re-decode; the CPU/non-WebGPU fallback re-flattens in
  wasm (coalesced, latest-wins). HOME restores the full composite.
- **Multi-part** files — part 0 is decoded (explicit part selection is a follow-up).

All-`HALF` sources (including luma-chroma and deep composites) come back as raw
f16 bit patterns that stay half-precision all the way to the `rgba16float` GPU
upload (no eager widening to f32); mixed/`FLOAT`/`UINT` sources come back as f32.

The pure-**TypeScript decoder remains a fallback**, used automatically only if the
WASM module fails to instantiate on a given browser, or for the rare channel
layout the binding does not compact (not R,G,B(,A), not a single channel, not
luma-chroma). In practice nothing displayable errors anymore. The decode result
is identical either way, so this acceleration is transparent to page authors.

Fixture provenance and size/benchmark numbers live under `wasm/openexr/`
(`build.sh` pins every source tag; `fixtures/gen.cpp` generates the committed
coverage crops).

Each banner states the limitation, gives a one-line hint on how to enable the
capability (browser-specific for messages 1–2, OS-specific for message 3), and
links back to this guide via **Learn more**. It appears **at most once per
page**: dismiss it with the `×` and it never returns on that page (the dismissal
is remembered per page under a `localStorage` key namespaced by
`location.pathname`, falling back to `sessionStorage` then in-memory on
`file://` / private-mode pages where storage is denied).
