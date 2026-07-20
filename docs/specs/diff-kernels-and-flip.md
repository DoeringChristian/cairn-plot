# Diff kernels: registry, cached result textures, FLIP, toolbar selection

Status: user-approved direction (2026-07-20). Supersedes the ubershader diff dispatch.
User requirements: (1) ALL diff methods render into a texture, cached; display blits it;
recompute only when method/params/sources change. (2) Implement the FLIP metric; show it
in an example. (3) Diff mode selectable from the toolbar (menu). Style mandate: NO switch
growth — each loss is its own kernel module.

## Architecture

### Kernel registry (`ui/src/lib/cairn-plot/engine/kernels/`)
- `prelude.wgsl.ts` — shared WGSL: sampling helpers, sRGB↔linear, YCxCz/Lab color
  transforms, separable-convolution scaffolding. Written once.
- One file per kernel. Two kernel shapes:
  - **Pointwise**: exports WGSL `fn kernel(a: vec4f, b: vec4f) -> vec4f` + metadata.
    Today's six submodes (absolute/signed/squared/relative_*) become six small files.
  - **Multi-pass**: exports a pass-graph descriptor
    `{ passes: [{ shader, inputs, outputs, separable? }], final: textureRef, reduce? }`.
    FLIP is the first implementation.
- `kernel-registry.ts` — `registerDiffKernel(id, kernel)`, `listDiffKernels()`,
  `getDiffKernel(id)`. Metadata per kernel: `label` (menu text), `displayRange`
  (how the display pass maps values → colormap: `unit` [0,1] | `signed` [-1,1] |
  `relative`), `params?` (typed defaults, e.g. FLIP `ppd`).
- Pipeline creation: compose `prelude + kernel source` → one shader module per kernel,
  pipeline cached per `(device, kernel, format)`. **No runtime mode branching in WGSL** —
  the existing `diffChannel(mode)` switch and the uniform mode ints are DELETED.

### Cached diff computation (the new render flow)
- `computeDiff(device, texA, texB, kernelId, params) -> { texture, scalars? }` runs the
  kernel (pointwise = one pass; multi-pass = its graph with pooled intermediate
  rgba16float textures) into a **result texture** (rgba16float, source resolution;
  raw values — colormap applied only at display).
- **Result cache**: keyed `(contentKeyA, contentKeyB, kernelId, paramsHash)` where
  contentKey = the pane's source content hash (upload identity), NOT texture object
  identity. LRU with a VRAM budget (default ~8 entries or 256MB, whichever first);
  entries own their textures and destroy on evict. Invalidation: key change only —
  viewport/exposure/colormap changes NEVER recompute.
- Display pass: the compare blit's diff branch becomes "sample cached result texture
  through the uv-window → map via kernel `displayRange` → colormap LUT". Split/blend
  are view composition, not kernels — they keep their (now switch-free, specialized)
  pipelines.
- Metrics: MSE/PSNR/MAE become reduce-kernels over the result texture, their scalars
  cached in the same entry (fixes today's remount-recompute).

### FLIP (LDR-FLIP, per the NVIDIA paper)
- Inputs: the two sRGB/display-encoded sources. Parameter: `ppd` (pixels per degree,
  default ≈ 67 — 0.7 m viewing distance on a ~1080p-density display), exposed in
  kernel params.
- Pass-graph: sRGB→linear→YCxCz; per-channel CSF spatial filtering (separable Gaussian
  approximations, radii derived from ppd); color difference via HyAB in L*a*b* with
  Hunt adjustment, normalized per the paper; feature (point/edge) detection on
  achromatic channel via first/second Gaussian-derivative filters; final
  `flip = colorDiff^(1 − featureDiff)`-family combination per the paper's exact
  formulas. Output in [0,1] (`displayRange: unit`).
- **Verification (two-sided):** a compact CPU reference implementation in TS
  (`kernels/flip-reference.ts`, plain loops, small-image scale) validated in node tests
  against a handful of published/officially-generated expected values (record
  provenance in the test); a browser harness (`engine/__tests__/flip.browser.ts`
  pattern) asserting GPU-vs-CPU-reference agreement within tolerance on fixture pairs.

### Toolbar selection
- `ToolbarButtonSpec` gains a **menu variant**: `{ id, label|icon, title, menu:
  { options: [{id, label}], value, onSelect(id) } }` — PlotToolbar renders a dropdown
  (self-contained styling, closes on select/outside-click/Escape).
- `GpuComparePane` (diff mode): a leading menu button listing
  `listDiffKernels()` (the six pointwise + FLIP), current kernel highlighted;
  selection updates pane state → new cache key → recompute → display. The existing
  `diffSubmode` prop remains the initial value; the Python `cp.Compare` surface gains
  the new kernel ids (`flip`) as valid `diff_submode` values (schema/pydantic additive).

### Example
- Gallery + feature report gain a "Perceptual diff — FLIP" section: an image pair with
  visible structured differences shown as side / absolute-diff / FLIP (menu-switchable
  live in the pane). Offline, baked sources (no network).

## Gates
tsc 0 · node tests (incl. FLIP CPU-reference vs recorded expected values) · boundary +
schema checks (additive schema change mirrored in pydantic + regenerated) · build:plot-inline ·
smoke 22/22 + the new section asserting real content · pytest green ·
browser eyeball: kernel menu switching, FLIP map rendering, zoom/pan on a FLIP diff does
NOT recompute (verify via a compute counter/log), cache eviction sane.

## Out of scope
HDR-FLIP (LDR only for now; error clearly for float-HDR sources or tone-map first —
pick one, document); SSIM (next kernel, the registry makes it a drop-in); CPU-backend
FLIP (GPU-only; CPU compare keeps its existing pointwise modes and simply doesn't list
FLIP in its menu).
