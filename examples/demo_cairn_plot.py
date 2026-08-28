"""cairn.plot — the standalone, Plotly-shaped plotting library.

This example exercises EVERY ``cairn.plot`` (``cp``) plot type from plain
in-memory data and writes ONE self-contained HTML gallery. It needs **no cairn
server and no repo** — the emitted page bakes its data inline (the LOCAL data
mode) and ships the renderer bundle, so it renders fully offline (open the file
directly, or share it). Running this script is therefore a visual smoke test of
the standalone library: every plot must appear, with no console errors and no
network requests beyond the HTML document itself.

Types covered: ``Line``, ``Scatter``, ``Bar``, ``Histogram``, ``Heatmap``,
``ParallelCoordinates``, ``Image``, ``Table``, ``Figure`` (Plotly passthrough),
``PointCloud`` / ``Mesh`` / ``Volume`` / ``Boxes`` (3D / WebGL), plus the
``Grid`` compositor and ``Compare`` (all modes + every diff submode).

Usage::

    # plotly + PIL come from the "media" extra; cairn core needs neither.
    uv run --extra media python examples/demo_cairn_plot.py
    # → writes /tmp/cairn-plot-gallery.html and prints the path.

    # open it (macOS):    open /tmp/cairn-plot-gallery.html
    #        (linux):     xdg-open /tmp/cairn-plot-gallery.html
    # or auto-open:
    uv run --extra media python examples/demo_cairn_plot.py --open

    # pick a different output path:
    uv run --extra media python examples/demo_cairn_plot.py -o ./gallery.html
"""

from __future__ import annotations

import argparse
import pathlib
import sys

import numpy as np

import cairn_plot as cp


def _gradient_image(w: int, h: int, *, shift: float = 0.0) -> np.ndarray:
    """A small RGB gradient image as a uint8 ``(H, W, 3)`` array."""
    xs = np.linspace(0, 1, w)[None, :]
    ys = np.linspace(0, 1, h)[:, None]
    r = np.clip(xs + shift, 0, 1) * np.ones((h, w))
    g = ys * np.ones((h, w))
    b = (1 - xs) * np.ones((h, w))
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def _hdr_image(w: int = 128, h: int = 96) -> np.ndarray:
    """A synthetic TRUE-float HDR image as ``(H, W, 3)`` float32 with a genuine
    >1 range (peak ~8.0): a dim radial background plus a very bright core, so
    tone-map operators roll the highlight off differently and lowering exposure
    visibly recovers detail that is blown out at higher exposure."""
    ys = np.linspace(-1, 1, h)[:, None]
    xs = np.linspace(-1, 1, w)[None, :]
    r2 = xs**2 + ys**2
    # a warm low-dynamic background (~0..0.6) + a bright hot core peaking ~8.
    background = 0.15 + 0.45 * np.clip(1.0 - r2, 0.0, 1.0)
    core = 8.0 * np.exp(-r2 / 0.02)
    lum = background + core
    # tint the channels so the roll-off is visible in color, not just luma.
    rgb = np.stack([lum, lum * 0.85, lum * 0.6], axis=-1)
    return rgb.astype(np.float32)


def _render_pair(w: int = 128, h: int = 96) -> tuple[np.ndarray, np.ndarray]:
    """A structured 'reference render' and a degraded 'prediction' with the kind
    of STRUCTURED error a perceptual metric (FLIP) is built to surface: the
    prediction is the reference shifted one pixel + additive noise + a slightly
    darker exposure. A flat absolute diff shows a smear of magnitude; FLIP
    weights it by human contrast sensitivity + edge/feature detection, so the
    error concentrates on the disks' edges. Both baked offline (no network).

    Returns ``(prediction, reference)`` as uint8 ``(H, W, 3)`` arrays."""
    ys = np.linspace(0.0, 1.0, h)[:, None]
    xs = np.linspace(0.0, 1.0, w)[None, :]
    base = np.stack(
        [
            0.5 + 0.5 * np.sin(6.0 * xs) * np.ones((h, w)),
            ys * np.ones((h, w)),
            0.5 + 0.5 * np.cos(5.0 * ys) * np.ones((h, w)),
        ],
        axis=-1,
    )
    rng = np.random.default_rng(3)
    for _ in range(6):  # a few bright disks → strong edges FLIP keys off
        cx, cy = rng.uniform(0.2, 0.8), rng.uniform(0.2, 0.8)
        r2 = (xs - cx) ** 2 + (ys - cy) ** 2
        base = base + np.exp(-r2 / 0.004)[..., None] * np.array([1.0, 0.9, 0.7])
    base = np.clip(base, 0.0, 1.0)
    reference = (base * 255).astype(np.uint8)

    pred = np.roll(base, 1, axis=1)  # 1px horizontal shift
    pred = pred * 0.95 + rng.normal(0.0, 0.05, pred.shape)  # dim + noise
    prediction = (np.clip(pred, 0.0, 1.0) * 255).astype(np.uint8)
    return prediction, reference


def _detail_scene(w: int = 320, h: int = 240) -> np.ndarray:
    """A detail-rich float RGB scene in ``[0, 1]`` designed for MANUAL (visual)
    comparison — the kind of high-frequency content where blur, noise, and
    resampling differences pop under the split / flip tools:

    * a **zone plate** (``sin(k·r²)`` chirp) — spatial frequency rises toward the
      edges, the classic resolution / aliasing test target;
    * a **radial hue wheel** (angle → color) tinting the chirp;
    * a **sharp checkerboard** patch (hard edges a blur rounds off);
    * a couple of bright disks (local highlights).
    """
    ys = np.linspace(-1.0, 1.0, h)[:, None] * np.ones((h, w))
    xs = np.linspace(-1.0, 1.0, w)[None, :] * np.ones((h, w))
    r2 = xs**2 + ys**2
    chirp = 0.5 + 0.5 * np.sin(38.0 * r2)  # zone plate

    # hue wheel → RGB (angle to a smooth rainbow), modulated by the chirp.
    ang = (np.arctan2(ys, xs) + np.pi) / (2 * np.pi)  # 0..1
    hue = np.stack(
        [
            0.5 + 0.5 * np.cos(2 * np.pi * (ang + 0.00)),
            0.5 + 0.5 * np.cos(2 * np.pi * (ang + 0.33)),
            0.5 + 0.5 * np.cos(2 * np.pi * (ang + 0.66)),
        ],
        axis=-1,
    )
    img = (0.35 + 0.65 * chirp[..., None]) * hue

    # a sharp checkerboard patch in the top-left quadrant (hard edges).
    gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    checker = (((gx // 8) + (gy // 8)) % 2).astype(np.float32)
    mask = (gx < w // 3) & (gy < h // 3)
    img[mask] = checker[mask, None] * np.array([1.0, 1.0, 1.0], np.float32)

    # a couple of bright disks (local highlights).
    for cx, cy in ((0.45, -0.35), (-0.5, 0.5)):
        d2 = (xs - cx) ** 2 + (ys - cy) ** 2
        img = img + np.exp(-d2 / 0.01)[..., None] * np.array([1.0, 0.95, 0.8], np.float32)

    return np.clip(img, 0.0, 1.0).astype(np.float32)


def _gaussian_blur(img: np.ndarray, sigma: float) -> np.ndarray:
    """Numpy-only separable Gaussian blur (frequency-domain), per channel — used
    to build a 'blurred prediction' from the sharp detail scene."""
    if sigma <= 0:
        return img
    h, w = img.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2.0 * (np.pi * sigma) ** 2 * (fx**2 + fy**2))
    out = np.empty_like(img, dtype=np.float32)
    for c in range(img.shape[2]):
        out[..., c] = np.real(np.fft.ifft2(np.fft.fft2(img[..., c]) * g))
    return np.clip(out, 0.0, 1.0).astype(np.float32)


def _sphere_pointcloud(n: int) -> np.ndarray:
    """An ``(n, 6)`` colored point cloud (xyz on a unit sphere + rgb)."""
    rng = np.random.default_rng(7)
    pts = rng.normal(size=(n, 3))
    pts /= np.linalg.norm(pts, axis=1, keepdims=True)
    rgb = (pts + 1) / 2  # map position → color
    return np.hstack([pts, rgb]).astype(np.float32)


def _mesh() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """A unit icosahedron: ``(12, 3)`` vertices, ``(20, 3)`` triangle indices,
    plus a per-vertex scalar (vertex height ``z``) used to COLOR the mesh via a
    colormap (``color_mode="values"``)."""
    phi = (1.0 + np.sqrt(5.0)) / 2.0
    vertices = np.array(
        [
            [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
            [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
            [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
        ],
        dtype=np.float32,
    )
    vertices /= np.linalg.norm(vertices, axis=1, keepdims=True)  # onto unit sphere
    faces = np.array(
        [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
            [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
            [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
            [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
        ],
        dtype=np.int64,
    )
    values = vertices[:, 2].astype(np.float32)  # colour by height
    return vertices, faces, values


def _volume(d: int = 32) -> np.ndarray:
    """A ``(D, H, W)`` scalar volume holding a soft Gaussian blob at the centre —
    the raymarch viewer renders it as a glowing cloud."""
    lin = np.linspace(-1.0, 1.0, d)
    zz, yy, xx = np.meshgrid(lin, lin, lin, indexing="ij")
    r2 = xx**2 + yy**2 + zz**2
    return np.exp(-r2 / 0.15).astype(np.float32)


def _boxes() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """A small stack of axis-aligned 3D boxes on a 2×2×2 lattice: ``(8, 3)``
    ``mins``/``maxs`` corner arrays + a per-box scalar for value-coloring."""
    centers = np.array(
        [[x, y, z] for x in (0, 1) for y in (0, 1) for z in (0, 1)],
        dtype=np.float32,
    )
    half = 0.35
    mins = centers - half
    maxs = centers + half
    values = np.linalg.norm(centers - 0.5, axis=1).astype(np.float32)
    return mins, maxs, values


def build_gallery() -> list[tuple[str, object]]:
    """Return ``(title, component)`` pairs — one per plot type + composition."""
    rng = np.random.default_rng(0)
    items: list[tuple[str, object]] = []

    # ── 2D charts (raw-data primary) ──────────────────────────────────────
    steps = np.arange(40)
    items.append((
        "Line — multi-series",
        cp.Line({"loss": np.exp(-steps / 15) + 0.05 * rng.random(40),
                 "val_loss": np.exp(-steps / 20) + 0.08 * rng.random(40)}),
    ))
    items.append((
        "Scatter — colored by a third value",
        cp.Scatter(rng.random(60), rng.random(60), color=rng.random(60),
                   x_label="x", y_label="y", color_label="score"),
    ))
    items.append((
        "Bar",
        cp.Bar([3.2, 7.1, 5.5, 2.8], labels=["alpha", "beta", "gamma", "delta"],
               value_label="throughput"),
    ))
    items.append((
        "Histogram — from raw samples",
        cp.Histogram(rng.normal(size=2000), bins=40),
    ))
    items.append((
        "Heatmap",
        cp.Heatmap(np.add.outer(np.sin(np.linspace(0, 3, 24)),
                                np.cos(np.linspace(0, 3, 32))),
                   colormap="viridis"),
    ))
    items.append((
        "ParallelCoordinates — numeric + categorical",
        cp.ParallelCoordinates([
            {"label": "lr", "values": [1e-3, 3e-3, 1e-2, 3e-2]},
            {"label": "optimizer", "values": ["adam", "sgd", "adam", "adamw"]},
            {"label": "acc", "values": [0.81, 0.74, 0.88, 0.90]},
        ]),
    ))

    # ── media ─────────────────────────────────────────────────────────────
    items.append(("Image — baked inline", cp.Image(_gradient_image(96, 64), label="gradient")))
    items.append((
        "Table",
        cp.Table([
            {"run": "a", "acc": 0.88, "loss": 0.31, "note": "baseline"},
            {"run": "b", "acc": 0.91, "loss": 0.27, "note": "tuned"},
            {"run": "c", "acc": 0.86, "loss": 0.35, "note": "ablation"},
        ]),
    ))

    # ── Figure (Plotly passthrough) — optional (needs plotly) ─────────────
    try:
        import plotly.graph_objects as go

        fig = go.Figure()
        fig.add_trace(go.Scatter(x=steps, y=np.cos(steps / 6), mode="lines",
                                 name="cos"))
        fig.add_trace(go.Bar(x=steps[::4], y=rng.random(10), name="samples",
                             opacity=0.4))
        fig.update_layout(title="A Plotly figure, rendered via cp.Figure")
        items.append(("Figure — Plotly passthrough", cp.Figure(fig)))
    except ImportError:
        print("  (skipping Figure — plotly not installed; use --extra media)")

    # ── 3D (WebGL) ────────────────────────────────────────────────────────
    items.append((
        "PointCloud — 3D, WebGL (orbit to rotate)",
        cp.PointCloud(_sphere_pointcloud(3000), point_size=0.03),
    ))

    # ── image processing: exposure / gamma (display adjustments) ──────────
    # NOTE: with the current 8-bit image pipeline these are display-space
    # adjustments (exposure = brightness × 2^EV, gamma tone curve), not true
    # float-HDR tone-mapping. They still demonstrate the control surface.
    base = _gradient_image(120, 80)
    items.append((
        "Image processing — exposure & gamma sweep",
        cp.Grid(
            [[cp.Image(base, exposure=-2.0, label="EV −2"), cp.Image(base, label="EV 0"),
              cp.Image(base, exposure=2.0, label="EV +2")],
             [cp.Image(base, gamma=0.5, label="γ 0.5"), cp.Image(base, colormap="viridis", label="viridis"),
              cp.Image(base, gamma=2.2, label="γ 2.2")]],
        ),
    ))

    # ── HDR: true float, real tone-mapping (imagehdr renderer) ────────────
    # Unlike the 8-bit "Image processing" sweep above, these bake the genuine
    # float array (an `imghdr` DataSpec) and tone-map it CLIENT-SIDE — real HDR.
    hdr = _hdr_image()
    items.append((
        "HDR image — tone-map operators & exposure (true float, real tone-mapping)",
        cp.Grid([
            # the four tone-map operators side by side (highlight roll-off differs)
            [cp.Image(hdr, tonemap="linear", label="linear"), cp.Image(hdr, tonemap="srgb", label="srgb"),
             cp.Image(hdr, tonemap="reinhard", label="reinhard"), cp.Image(hdr, tonemap="aces", label="aces")],
            # an exposure sweep: lowering exposure recovers blown-out highlights
            [cp.Image(hdr, tonemap="srgb", exposure=-2.0, label="srgb · EV −2"),
             cp.Image(hdr, tonemap="srgb", exposure=0.0, label="srgb · EV 0"),
             cp.Image(hdr, tonemap="srgb", exposure=2.0, label="srgb · EV +2"),
             cp.Image(hdr, tonemap="aces", exposure=2.0, label="aces · EV +2")],
        ]),
    ))

    # ── EXR parts & channels — cp.Image(part=, channels=) ────────────────
    # A layered AOV EXR (beauty RGBA + diffuse/specular layers + signed normals
    # + a Z depth channel), embedded as a data: URL so the baked gallery stays
    # offline. Each pane decodes a DIFFERENT selection from the SAME file:
    # `channels=` names a channel GROUP ("diffuse") or a single FULL channel
    # ("diffuse.G", "Z" — rendered as a scalar). Grouping follows the OpenEXR
    # dot-prefix convention (tev-style).
    import base64 as _b64

    _exr_path = (
        pathlib.Path(__file__).resolve().parent.parent
        / "ui/src/plots/image/model/decoders/fixtures/layers-demo-128x96.exr"
    )
    if _exr_path.exists():
        _exr_url = "data:image/x-exr;base64," + _b64.b64encode(_exr_path.read_bytes()).decode()
        items.append((
            "EXR parts & channels — one file, per-pane channel selection",
            cp.Grid([
                [cp.Image(url=_exr_url, label="beauty (default RGBA)"),
                 cp.Image(url=_exr_url, channels="diffuse", label='channels="diffuse"'),
                 cp.Image(url=_exr_url, channels="specular", label='channels="specular"')],
                [cp.Image(url=_exr_url, channels="normal", label='channels="normal" (XYZ)'),
                 cp.Image(url=_exr_url, channels="Z", exposure=-3.0,
                          label='channels="Z" (scalar depth, EV −3)'),
                 cp.Image(url=_exr_url, channels="diffuse.G", label='channels="diffuse.G" (one channel)')],
            ]),
        ))

    # ── zoomable split of a SMALL image → TEV-style per-pixel values ──────
    # Two tiny 16×16 gradients: hold Alt/Ctrl and wheel-zoom the split pane.
    # BOTH sides zoom together and the divider stays aligned; once each source
    # pixel is big enough on screen the renderer draws its RGB value centred on
    # the pixel (TEV-style), with auto-contrast text. Drag (with modifier) to
    # pan. This one section exercises Feature-1 (split zoom) + Feature-2 (pixel
    # values) together — pick a small image so a normal zoom-in triggers it.
    small_a = _gradient_image(16, 16)
    small_b = _gradient_image(16, 16, shift=0.25)
    items.append((
        "Compare — zoomable split w/ TEV-style pixel values "
        "(Alt/Ctrl + wheel to zoom; per-pixel RGB appears when pixels get big)",
        cp.Compare(cp.Image(small_a, label="prediction"), cp.Image(small_b, label="reference"), mode="split",
                   split_position=0.5),
    ))

    # ── image comparison: split + diff submodes ───────────────────────────
    img_a = _gradient_image(120, 80)
    img_b = _gradient_image(120, 80, shift=0.18)  # a shifted variant to compare
    items.append((
        "Compare — all modes (split · diff)",
        cp.Grid(
            [[cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="split",
                         split_position=0.25),
              cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="split",
                         split_position=0.5)],
             [cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="abs"),
              cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="signed", colormap="red-blue")]],
        ),
    ))
    # Every diff submode the renderer supports (see DiffMode in types.ts /
    # image/diff.ts), laid out row-major in a 3×2 Grid. Diverging errors
    # (signed / relative_signed) use the red-blue diverging map; magnitude
    # errors use viridis / red-green. The two source images differ by a real
    # red-channel shift, so every submode renders a visibly distinct field.
    items.append((
        "Compare — all 6 diff submodes "
        "(row-major: signed · absolute · squared / "
        "relative_signed · relative_absolute · relative_squared)",
        cp.Grid(
            [
                [
                    cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="signed", colormap="red-blue"),
                    cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="abs", colormap="viridis"),
                    cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="square", colormap="viridis"),
                ],
                [
                    cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="rel_signed", colormap="red-blue"),
                    cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="rel_abs", colormap="viridis"),
                    cp.Compare(cp.Image(img_a, label="prediction"), cp.Image(img_b, label="reference"), mode="rel_square", colormap="red-green"),
                ],
            ],
        ),
    ))

    # ── detail-rich images for MANUAL comparison ─────────────────────────
    # A high-frequency "zone plate + hue wheel + checker" scene (great for
    # eyeballing resolution/blur/noise differences) against degraded
    # predictions. Drag the divider (or press ←/→ to snap it) and switch the
    # pane's MODE menu to diff/FLIP to localise where each prediction
    # loses detail. Standalone variants sit below so you can multi-SELECT any
    # two panes on the page and hit "Compare" to diff arbitrary pairs.
    # Build the variants in float (blur/noise math), then bake as compact uint8
    # PNGs — the scene is display-range [0,1], so it needs no HDR/float pipeline.
    _noise_rng = np.random.default_rng(11)
    _scene = _detail_scene()
    _u8 = lambda a: (np.clip(a, 0.0, 1.0) * 255).astype(np.uint8)
    detail = _u8(_scene)
    detail_blur = _u8(_gaussian_blur(_scene, sigma=1.6))
    detail_noisy = _u8(_scene + _noise_rng.normal(0.0, 0.06, _scene.shape))
    detail_dim = _u8(_scene * 0.8)
    items.append((
        "Manual comparison — detail-rich scene vs degraded predictions "
        "(split / ←→ / diff · FLIP)",
        cp.Grid(
            [[cp.Compare(cp.Image(detail_blur, label="blurred"), cp.Image(detail, label="sharp"), mode="split"),
              cp.Compare(cp.Image(detail_noisy, label="noisy"), cp.Image(detail, label="clean"), mode="split")]],
        ),
    ))
    items.append((
        "Manual comparison — standalone variants (select any two → Compare)",
        cp.Grid(
            [[cp.Image(detail, label="sharp"), cp.Image(detail_blur, label="blurred (σ1.6)")],
             [cp.Image(detail_noisy, label="noisy (σ0.06)"), cp.Image(detail_dim, label="dim (×0.8)")]],
        ),
    ))

    # ── perceptual diff: FLIP (menu-switchable live in the pane) ───────────
    # A structured render vs a shifted+noisy prediction, shown as FLIP (a
    # perceptual LDR error metric — NVIDIA FLIP) beside a plain absolute diff.
    # In each pane the toolbar (hover top-right) exposes TWO dropdowns: a MODE
    # menu — split · every diff kernel (signed · absolute · … · flip) —
    # and a COLORMAP menu. Switching the kernel recomputes once and re-blits;
    # switching the colormap is display-only (no recompute); zoom/pan never
    # recompute. FLIP concentrates error on edges; abs shows raw magnitude.
    flip_pred, flip_ref = _render_pair()
    items.append((
        "Perceptual diff — FLIP vs absolute "
        "(pane toolbar: MODE menu split · kernels; COLORMAP menu)",
        cp.Grid(
            [[cp.Compare(cp.Image(flip_pred, label="prediction"), cp.Image(flip_ref, label="reference"), mode="flip",
                         colormap="viridis"),
              cp.Compare(cp.Image(flip_pred, label="prediction"), cp.Image(flip_ref, label="reference"), mode="abs",
                         colormap="viridis")]],
        ),
    ))

    # ── FLIP at scale: 2048×2048 ──────────────────────────────────────────
    # Same structured pair at production render resolution. Exercises the
    # GPU pipeline where it matters: the multi-pass FLIP kernel (CSF
    # filtering + feature detection) runs once at 2048² into the cached
    # result texture — mode/colormap switches re-blit without recomputing,
    # and zoom/pan stays texture-sampling only. The pair bakes as two PNGs
    # (the smooth field compresses well), so the page stays portable.
    big_pred, big_ref = _render_pair(w=2048, h=2048)
    items.append((
        "FLIP at scale — 2048×2048 (kernel runs once into the cached result; "
        "zoom in for per-pixel FLIP values)",
        cp.Compare(cp.Image(big_pred, label="prediction"), cp.Image(big_ref, label="reference"), mode="flip",
                   colormap="magma"),
    ))

    # ── 3D (WebGL): mesh / volume / boxes ─────────────────────────────────
    verts, faces, vals = _mesh()
    items.append((
        "Mesh — 3D icosahedron, colored per-vertex by height (WebGL)",
        cp.Mesh(verts, faces, values=vals, color_mode="values", show_axes=True),
    ))
    # Per-FACE colors: a tetrahedron whose 4 triangular faces each render one
    # distinct flat color (non-indexed expansion — not vertex-interpolated).
    tetra_v = np.array(
        [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], dtype=np.float32
    )
    tetra_f = np.array(
        [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]], dtype=np.int64
    )
    tetra_face_colors = np.array(
        [[0.90, 0.20, 0.20], [0.20, 0.80, 0.30], [0.25, 0.45, 0.95], [0.95, 0.80, 0.20]],
        dtype=np.float32,
    )  # (4, 3) — one color per face
    items.append((
        "Mesh — 3D tetrahedron, distinct per-face (per-triangle) colors (WebGL)",
        cp.Mesh(tetra_v, tetra_f, face_colors=tetra_face_colors, show_axes=True),
    ))
    items.append((
        "Volume — 3D scalar grid, Gaussian blob (WebGL raymarch)",
        cp.Volume(_volume(), colormap="viridis", show_axes=True),
    ))
    b_mins, b_maxs, b_vals = _boxes()
    items.append((
        "Boxes — 3D axis-aligned boxes, colored by value (WebGL)",
        cp.Boxes(b_mins, b_maxs, values=b_vals, color_mode="value", show_axes=True),
    ))

    # ── composition: nested Grid ──────────────────────────────────────────
    items.append((
        "Grid — 2×2 with per-column widths",
        cp.Grid(
            [[cp.Line(np.exp(-steps / 12)), cp.Bar([2, 5, 3], labels=["x", "y", "z"])],
             [cp.Image(_gradient_image(80, 60), label="gradient"),
              cp.Histogram(rng.normal(size=500), bins=20)]],
            col_widths=[0.6, 0.4],
        ),
    ))

    # ── Synced image controls — zoom/pan linked ────────────────────────────
    # `Grid(shared={"sync": {"view": True}})` (`cp.Shared(sync=...)` here)
    # links every IMAGE leaf in the grid into one live zoom/pan group — the
    # image mirror of the existing 3D camera-sync mechanism ("Sync 3D views"
    # on PointCloud/Mesh/Volume/Boxes cards). Hold Alt/Ctrl and wheel-zoom or
    # drag-pan EITHER pane below; the other mirrors it in lock-step (same
    # zoom + pan) because both leaves resolve the SAME view-sync group id
    # from this one grid. Two related (same-size, offset-gradient) images
    # make the linkage visually obvious.
    sync_a = _gradient_image(160, 120)
    sync_b = _gradient_image(160, 120, shift=0.3)
    items.append((
        "Synced image controls — zoom/pan linked "
        "(Alt/Ctrl + wheel/drag on either pane moves both together)",
        cp.Grid(
            [[cp.Image(sync_a, label="view A"), cp.Image(sync_b, label="view B")]],
            shared=cp.Shared(sync={"view": True}),
        ),
    ))

    # ── Synced chart viewports — zoom/pan linked (S7) ──────────────────────
    # The SAME `Grid(shared={"sync": {"view": True}})` flag that links image
    # panes above also links 2D CHART leaves: every chart in the grid joins one
    # live zoom/pan group via `chart-view-sync.ts`'s pub/sub bus (the chart
    # mirror of the image + 3D-camera sync buses). Box-zoom, pan (drag or the
    # axis gutters), Alt/Ctrl+wheel, or double-click-to-reset on EITHER chart
    # and the other adopts the exact same DATA-SPACE window (Plotly matched-axes
    # style) — not a pixel copy, so it holds even though the two charts have
    # different y-data. Both scatters share the x range [0, 20], so a zoom into
    # one x-window frames the same slice in both.
    sx = np.linspace(0, 20, 120)
    chart_a = cp.Scatter(sx, np.sin(sx) + 0.05 * rng.standard_normal(120),
                         x_label="x", y_label="sin(x)")
    chart_b = cp.Scatter(sx, np.cos(sx) + 0.05 * rng.standard_normal(120),
                         x_label="x", y_label="cos(x)")
    items.append((
        "Synced chart viewports — zoom/pan linked "
        "(box-zoom / drag / Alt+wheel / double-click on either chart moves both)",
        cp.Grid(
            [[chart_a, chart_b]],
            shared=cp.Shared(sync={"view": True}),
        ),
    ))

    return items


def render_html(items: list[tuple[str, object]]) -> str:
    """Concatenate each component's ``_repr_html_`` into one titled page."""
    blocks = []
    for title, comp in items:
        html = comp._repr_html_()
        # Light self-check: a healthy component emits a mount div, never a
        # bare error <pre>. Fail loudly so the example doubles as a smoke test.
        if "cairn-plot-" not in html or html.startswith("<pre>cairn-plot: could"):
            raise SystemExit(f"FAILED to render {title!r}:\n{html[:400]}")
        blocks.append(
            f'<section style="margin:0 0 2.5rem">'
            f'<h2 style="font:600 15px system-ui;color:var(--color-fg-muted,#334);'
            f'margin:0 0 .5rem">{title}</h2>'
            f"{html}</section>"
        )
    body = "\n".join(blocks)
    # `class="cairn-plot-doc"` + the color-scheme meta opt the page into the
    # theme token contract (P4/Q5) carried by the inlined style.css, so the
    # gallery renders correctly in both light and dark browsers. The inline
    # colors below route through the same tokens (with light fallbacks).
    return (
        "<!doctype html><html class='cairn-plot-doc'><head><meta charset='utf-8'>"
        "<meta name='color-scheme' content='light dark'>"
        "<title>cairn.plot — standalone gallery</title></head>"
        "<body style='max-width:1000px;margin:2rem auto;padding:0 1rem;"
        "font-family:system-ui'>"
        "<h1 style='font:700 22px system-ui'>cairn.plot — standalone library gallery</h1>"
        "<p style='color:var(--color-fg-muted,#667)'>Every plot below is baked into "
        "this file — no server, no network. Rendered by the same cairn-plot renderers "
        "the web app uses.</p>"
        f"{body}</body></html>"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Emit a standalone cairn.plot gallery.")
    ap.add_argument("-o", "--output", default="/tmp/cairn-plot-gallery.html",
                    help="output HTML path (default: /tmp/cairn-plot-gallery.html)")
    ap.add_argument("--open", action="store_true", help="open the file when done")
    args = ap.parse_args()

    items = build_gallery()
    html = render_html(items)
    out = pathlib.Path(args.output).expanduser().resolve()
    out.write_text(html, encoding="utf-8")
    size_kb = out.stat().st_size / 1024
    print(f"Rendered {len(items)} plot types → {out}  ({size_kb:.0f} KB)")

    if args.open:
        from _open import open_in_browser

        open_in_browser(out)
    else:
        opener = "open" if sys.platform == "darwin" else "xdg-open"
        print(f"Open it:  {opener} {out}")


if __name__ == "__main__":
    main()
