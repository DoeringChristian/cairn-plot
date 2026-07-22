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
pick one, document); SSIM (landed — see the SSIM addendum below; the registry made it
a drop-in as predicted); CPU-backend FLIP/SSIM (GPU-only; CPU compare keeps its existing
pointwise modes and simply doesn't list them in its menu).

## Addendum (user, 2026-07-20): HDR-FLIP

For float-HDR sources (imghdr arrays, f32-decoded EXR urls), support **HDR-FLIP**
(Andersson et al. 2021) as a kernel — supersedes the earlier "LDR-only, error on HDR"
scoping:

- Algorithm per the paper: derive the exposure range from the REFERENCE image's
  luminance percentiles (paper's c_start/c_stop formulation), N exposures per the
  paper's count rule; for each exposure, apply exposure compensation + the paper's
  tone mapper to BOTH images → run LDR-FLIP → combine as the per-pixel MAXIMUM
  across exposures. Output in [0,1] (`displayRange: unit`).
- Registry: `hdr-flip` multi-pass kernel (public name `flip_hdr` — or fold into
  `flip` with auto-dispatch: float sources → HDR-FLIP, u8 sources → LDR-FLIP;
  DECISION: auto-dispatch under the single public `flip` mode, with `flip_ldr`
  available to force LDR on float sources; menus show "FLIP (perceptual)" once).
- Params: `ppd` (shared), optional `start_exposure`/`stop_exposure` overrides
  (mirroring the official tool's flags).
- Verification: two-sided like LDR — CPU TS reference validated against the official
  `flip-evaluator` HDR mode on committed float fixtures; GPU-vs-reference browser
  harness. Cache: exposure-range params enter the params hash.
- Depends on: float-side compare ingestion (fix/compare-url-sources) — HDR-FLIP
  requires rgba16float sides.

## Addendum (2026-07-22): SSIM (structural similarity — landed)

The registry drop-in the "Out of scope" note anticipated. Kernel `ssim`
(public mode `ssim`): standard SSIM per Wang et al. 2004 on LUMINANCE.

- Front-end: sRGB→linear→Rec.709 luminance `[0.2126, 0.7152, 0.0722]` (the
  repo's convention — the Y row of FLIP's linRGB→XYZ, matching
  `hdr-flip-reference.ts`'s LUM), CLAMPED to `[0,1]` — the same "clip highlights
  to the display range" choice FLIP's forced-LDR path makes for float sources, so
  the dynamic range `L = 1` (consistent with skimage `data_range=1`).
- Constants `K1=0.01`, `K2=0.03`, `C1=(K1 L)²`, `C2=(K2 L)²`; 11-tap Gaussian
  window `σ=1.5` (radius 5), SEPARABLE (horizontal then vertical 1D passes),
  reflect boundary — bit-for-bit scipy/skimage.
- Pass graph (all intermediates rgba16float, source resolution):
  `momA = (Ya, Yb, Ya², Yb²)` · `momB = (Ya·Yb, …)` → separable Gaussian blur of
  each (`blurH`+`blurV` per moment texture) → an `ssim` combine pass computing
  local means/variances/covariance (cov_norm = 1, i.e.
  `use_sample_covariance=False`) → per-pixel SSIM. OUTPUT is the ERROR map
  `1 − SSIM` (replicated across R/G/B, alpha=1), `displayRange:"unit"`, output
  arity `"scalar"` (one TEV number), metadata label "SSIM (1−SSIM)". Sequential
  colormaps read "more error = brighter". Registry registration only — no switch
  statements.
- Verification (two-sided, the FLIP pattern): CPU reference
  `kernels/ssim-reference.ts` (plain loops) pinned in a node test against
  scikit-image's `structural_similarity` on committed fixtures
  (`__fixtures__/ssim.json`, generated by `gen_ssim_fixtures.py`; params
  `gaussian_weights=True, sigma=1.5, use_sample_covariance=False, data_range=1`) —
  worst per-pixel ~1e-7; GPU browser harness (`engine/__tests__/ssim.browser.ts`)
  asserts GPU-vs-CPU agreement (worst ~3e-3) + the compute-once cache contract.
  GPU-only, like FLIP.
