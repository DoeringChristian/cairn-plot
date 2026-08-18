# EXR multi-part / multi-channel / deep-merge support

**Goal:** first-class support for (1) multi-part EXRs, (2) channel groups AND
individual channels (tev-style), (3) composing multiple deep-Z images.

## Model

One selector, used everywhere, split into two mechanisms:

- **Decode-time selection** `{part, layer}` — which planes to pull from the
  file. `part` = index or part name; `layer` = channel-group name (OpenEXR
  dot-prefix convention: `diffuse.R/G/B` → group `diffuse`; bare `R/G/B/A` →
  the default color group `""`; ungrouped singletons (`Z`, masks) are scalar
  groups). A group decodes once → N-channel f32 payload, cached under
  `(source, part, layer)` (node identity in the resolve cache).
  Defaults (no selector) preserve today's behavior.
- **Display-time isolation** `channelView: rgb|r|g|b|a|lum` — which decoded
  channels to SHOW. A render-pass swizzle (uniform change): instant, works on
  every image type (PNG/array too), syncs over the settings bus like colormap.
  Isolated channels + scalar groups render through the colormap path.

**Metadata-first:** `describeExr(bytes)` parses ONLY headers → parts
`[{name, dims, deep, channels[]}]` → grouped client-side. No pixel decode.

## Interface

Python/JS:
```python
cp.Image("r.exr", part="beauty", channels="diffuse")   # group
cp.Image("r.exr", channels="diffuse.G")                # → layer + channelView
cp.Image("r.exr", channels="Z")                        # scalar group
cp.Image(arr, channels="r")                            # display-only isolation
cp.Layers("r.exr")                                     # stacked slots per group
cp.DeepMerge(["a.exr","b.exr"])                        # deep composite (P4)
```

UI: a tev-style **channel strip** BELOW the viewport (header = stack tabs,
footer = channels): one chip per group; the ACTIVE group chip expands inline
with its channel letters (R G B A) for isolation; scalar groups are plain
chips. Shown on any multi-channel image; hidden for single-group/single-channel.
Selection syncs by NAME over the settings bus. Click-only (no global keys —
numbers/letters belong to stack tabs).

## Deep merge (P4)

`_cairn_exr_merge_deep(handles[])` in the wasm module: concatenate per-pixel
sample lists across N deep sources, re-sort by Z into ONE CSR (each sample
tagged with a source id). Everything downstream (GPU buffers, compositeDeep,
Z-window slider) unchanged; per-source visibility = shader-side filter on the
source id. Merge cached per source-set; bounded by the existing deep budget.

## Phases

1. **Decoder selectors** (this phase): fixtures (multi-part + layered gen.cpp),
   `exr-describe.ts`, `channel-groups.ts`, vendored-loader `channelSelection`
   patch (name→slot map; also fixes "unsupported data channels" throw on
   layered files with no bare RGB), `decodeExrBuffer(sel)`, DataSpec
   `{part, layer}` plumbing (full-decoder route when selection present; wasm
   binding follow-up), Python/JS args, schema regen.
2. **Channel strip + channelView** — footer strip component (LabelChip family),
   swizzle in both image panes, settings-bus key, scalar-through-colormap
   (subsumes task #86).
3. **cp.Layers** — describe-driven expansion to stacked slots (needs an async
   descriptor seam OR client-side expansion node; decide then).
4. **Deep merge** — wasm merge binding + cp.DeepMerge + per-source toggles.

Punted (explicitly): arbitrary cross-group swizzle (`["a.R","b.R","Z"]`),
global channel hotkeys, per-source exposure/tint in deep merge.
