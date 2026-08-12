"""OpenEXR sample gallery — the FULL ASWF openexr-images set, by URL.

A comprehensive companion to ``examples/demo_url_images.py``: instead of a
handful of hand-picked EXRs, this references **every** image in the official
`AcademySoftwareFoundation/openexr-images
<https://github.com/AcademySoftwareFoundation/openexr-images>`_ sample repo
(97 files across 13 categories) purely BY URL. Nothing is embedded and nothing
is fetched at authoring time — the emitted HTML keeps each URL verbatim and the
BROWSER fetches + sniffs + decodes the blob at view time (OpenEXR is decoded
WASM-first by the upstream C++ library compiled to WebAssembly, off the main
thread in a Web Worker — covering every compression, scanline & tiled, deep,
multi-part, and luminance-chroma).

The gallery is grouped by category, one ``cp.Report`` markdown section + image
grid per directory, and every pane is captioned via ``cp.Image(..., label=)``.
A closing "Comparisons" section drops a few illustrative ``cp.Compare`` pairs
(prediction vs reference) — colour-space, env-map layout, and stereo/low-res.

The catalogue below is a static snapshot of the repo listing (enumerated once
from the GitHub tree API); building the report therefore needs NO network. Only
*viewing* the saved page does — the whole point is that the images are
referenced, not baked — so, like ``demo_url_images.py``, this stays a separate
example that the offline ``smoke:plot`` gate must not depend on.

Run:  PYTHONPATH=. python examples/demo_openexr_gallery.py [-o out.html] [--open]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cairn_plot as cp

# CORS-enabled raw host for the ASWF openexr-images sample repo (same base URL
# as examples/demo_url_images.py).
ASWF = "https://raw.githubusercontent.com/AcademySoftwareFoundation/openexr-images/main"


# ── the catalogue ───────────────────────────────────────────────────────────
# A verbatim snapshot of every *.exr in the openexr-images repo (main), grouped
# by category. Each category carries a short blurb and whether its contents are
# photographic scenes (tone-map with ACES) vs synthetic test patterns (shown
# raw, no tonemap, so the encoded values are read literally).
#
# Enumerated from the canonical listing:
#   https://openexr.com/en/latest/test_images/index.html
#   https://github.com/AcademySoftwareFoundation/openexr-images  (tree: main)

CATEGORIES: list[dict] = [
    {
        "dir": "ScanLines",
        "title": "ScanLines",
        "blurb": (
            "Scanline-based EXRs — the classic photographic sample set "
            "(PIZ / ZIP compressed half-float). Tone-mapped with ACES."
        ),
        "tonemap": True,
        "files": [
            "Blobbies.exr", "CandleGlass.exr", "Cannon.exr", "Carrots.exr",
            "Desk.exr", "MtTamWest.exr", "PrismsLenses.exr", "StillLife.exr",
            "Tree.exr",
        ],
    },
    {
        "dir": "Tiles",
        "title": "Tiles",
        "blurb": (
            "Tiled EXRs — pixels stored in rectangular tiles rather than "
            "scanlines (random-access friendly). Tone-mapped with ACES."
        ),
        "tonemap": True,
        "files": ["GoldenGate.exr", "Ocean.exr", "Spirals.exr"],
    },
    {
        "dir": "Chromaticities",
        "title": "Chromaticities",
        "blurb": (
            "Files carrying explicit `chromaticities` attributes — Rec.709 and "
            "CIE-XYZ primaries, each in plain RGB and luminance/chroma (`_YC`) "
            "form. Shown raw so the encoded colour is read literally."
        ),
        "tonemap": False,
        "files": ["Rec709.exr", "Rec709_YC.exr", "XYZ.exr", "XYZ_YC.exr"],
    },
    {
        "dir": "LuminanceChroma",
        "title": "LuminanceChroma",
        "blurb": (
            "Luminance/chroma-encoded images (`Y`, `RY`, `BY` channels with "
            "chroma subsampling) — decoded and reconstructed to RGB by the WASM "
            "module. Tone-mapped with ACES."
        ),
        "tonemap": True,
        "files": [
            "CrissyField.exr", "Flowers.exr", "Garden.exr", "MtTamNorth.exr",
            "StarField.exr",
        ],
    },
    {
        "dir": "DisplayWindow",
        "title": "DisplayWindow",
        "blurb": (
            "Data-window vs display-window edge cases (`t01`–`t16`): data "
            "windows offset from, larger than, or smaller than the display "
            "window. Shown raw to exercise the windowing logic."
        ),
        "tonemap": False,
        "files": [f"t{i:02d}.exr" for i in range(1, 17)],
    },
    {
        "dir": "MultiResolution",
        "title": "MultiResolution",
        "blurb": (
            "Mip-mapped and rip-mapped EXRs plus environment maps (cube & "
            "lat-long). `ColorCodedLevels` paints each mip level a distinct "
            "colour. Tone-mapped with ACES."
        ),
        "tonemap": True,
        "files": [
            "Bonita.exr", "ColorCodedLevels.exr", "Kapaa.exr",
            "KernerEnvCube.exr", "KernerEnvLatLong.exr", "MirrorPattern.exr",
            "OrientationCube.exr", "OrientationLatLong.exr",
            "PeriodicPattern.exr", "StageEnvCube.exr", "StageEnvLatLong.exr",
            "WavyLinesCube.exr", "WavyLinesLatLong.exr", "WavyLinesSphere.exr",
        ],
    },
    {
        "dir": "MultiView",
        "title": "MultiView",
        "blurb": (
            "Multi-view EXRs (e.g. left/right stereo channels in one file). "
            "The default view is decoded for display. Tone-mapped with ACES."
        ),
        "tonemap": True,
        "files": ["Adjuster.exr", "Balls.exr", "Fog.exr", "Impact.exr", "LosPadres.exr"],
    },
    {
        "dir": "Beachball",
        "title": "Beachball",
        "blurb": (
            "The Beachball animation as 8 single-part and 8 multi-part frames — "
            "the canonical multi-part sample (part 0 decoded). Tone-mapped "
            "with ACES."
        ),
        "tonemap": True,
        "files": (
            [f"singlepart.{i:04d}.exr" for i in range(1, 9)]
            + [f"multipart.{i:04d}.exr" for i in range(1, 9)]
        ),
    },
    {
        "dir": "TestImages",
        "title": "TestImages",
        "blurb": (
            "Synthetic reference charts — ramps, swirls, wide-gamut and "
            "wide-float-range targets, and NaN/Inf edge cases. Shown raw (no "
            "tonemap) so the values are exact."
        ),
        "tonemap": False,
        "files": [
            "AllHalfValues.exr", "BrightRings.exr", "BrightRingsNanInf.exr",
            "GammaChart.exr", "GrayRampsDiagonal.exr", "GrayRampsHorizontal.exr",
            "RgbRampsDiagonal.exr", "SquaresSwirls.exr", "WideColorGamut.exr",
            "WideFloatRange.exr", "stripes.exr",
        ],
    },
    {
        "dir": "v2/Stereo",
        "title": "v2 / Stereo",
        "blurb": (
            "OpenEXR 2.0 stereo examples — deep and multi-part files with "
            "left/right views plus a `composited` result. Deep samples are "
            "Z-sorted and OVER-composited to a flat HDR image client-side. "
            "Tone-mapped with ACES."
        ),
        "tonemap": True,
        "files": ["Balls.exr", "Ground.exr", "Leaves.exr", "Trunks.exr", "composited.exr"],
    },
    {
        "dir": "v2/LeftView",
        "title": "v2 / LeftView",
        "blurb": (
            "The left-view halves of the OpenEXR 2.0 stereo set at full "
            "resolution. Tone-mapped with ACES."
        ),
        "tonemap": True,
        "files": ["Balls.exr", "Ground.exr", "Leaves.exr", "Trunks.exr"],
    },
    {
        "dir": "v2/LowResLeftView",
        "title": "v2 / LowResLeftView",
        "blurb": (
            "Low-resolution variants of the left-view set (plus a `composited` "
            "result) — handy against `v2/LeftView` for a resolution diff. "
            "Tone-mapped with ACES."
        ),
        "tonemap": True,
        "files": ["Balls.exr", "Ground.exr", "Leaves.exr", "Trunks.exr", "composited.exr"],
    },
]

# How many image panes per grid row.
COLS = 3


def _stem(file: str) -> str:
    """Caption for a pane: the filename without its `.exr` suffix."""
    return file[:-4] if file.lower().endswith(".exr") else file


def _url(directory: str, file: str) -> str:
    return f"{ASWF}/{directory}/{file}"


def _image(directory: str, file: str, *, tonemap: bool) -> "cp.Image":
    kwargs: dict = {"label": _stem(file)}
    if tonemap:
        kwargs["tonemap"] = "aces"
    return cp.Image(url=_url(directory, file), **kwargs)


def _rows(images: list["cp.Image"], cols: int = COLS) -> list[list["cp.Image"]]:
    """Chunk a flat list of panes into rows of at most `cols`.

    Each row is emitted as its own single-row ``cp.Grid`` (see ``build_report``)
    so a partial final row never makes a 2-D grid ragged.
    """
    return [images[i:i + cols] for i in range(0, len(images), cols)]


def build_report() -> "cp.Report":
    total = sum(len(c["files"]) for c in CATEGORIES)
    rep = cp.Report(title="cairn-plot — OpenEXR sample gallery")
    rep.md(
        "# OpenEXR sample gallery\n"
        f"Every image in the ASWF **openexr-images** sample repo — **{total} "
        f"files across {len(CATEGORIES)} categories** — referenced purely **by "
        "URL**. This page embeds *no* image bytes: each pane holds only a URL, "
        "and the browser fetches the blob and cairn-plot's decoder registry "
        "sniffs (content-type → extension → magic bytes) and decodes it. "
        "OpenEXR is decoded WASM-first (the upstream C++ library compiled to "
        "WebAssembly) off the main thread in a Web Worker — every compression, "
        "scanline & tiled, deep, multi-part, and luminance-chroma.\n\n"
        "> **Viewing needs network access** (the images are referenced, not "
        "baked). Building this page does not.\n\n"
        f"Source: `{ASWF}`"
    )

    for cat in CATEGORIES:
        directory = cat["dir"]
        images = [
            _image(directory, f, tonemap=cat["tonemap"]) for f in cat["files"]
        ]
        rep.md(f"## {cat['title']}\n{cat['blurb']}")
        # One single-row grid per chunk: a lone partial final row can never make
        # a 2-D grid ragged (cp.Grid requires every row to have equal columns).
        for row in _rows(images):
            rep.grid([row])

    # ── a few illustrative Compare pairs (prediction vs reference) ───────────
    rep.md(
        "## Comparisons\n"
        "A few illustrative `cp.Compare` pairs — both operands URL-referenced "
        "EXRs, fetched + decoded + diffed client-side (`mode=\"abs\"`, "
        "`colormap=\"plasma\"`). Use the toolbar menus to switch the diff "
        "kernel (incl. FLIP) and colormap live; dimensions are min-cropped for "
        "the diff."
    )
    rep.md(
        "### Colour space — `Rec709` vs `XYZ`\n"
        "The same scene stored under Rec.709 vs CIE-XYZ primaries."
    )
    rep.add(
        cp.Compare(
            cp.Image(url=_url("Chromaticities", "Rec709.exr"), label="Rec709"),
            cp.Image(url=_url("Chromaticities", "XYZ.exr"), label="XYZ"),
            mode="abs",
            colormap="plasma",
        )
    )
    rep.md(
        "### RGB vs luminance/chroma — `Rec709` vs `Rec709_YC`\n"
        "Plain RGB against the chroma-subsampled `_YC` encoding of the same "
        "image (reconstruction loss shows up in the diff)."
    )
    rep.add(
        cp.Compare(
            cp.Image(url=_url("Chromaticities", "Rec709.exr"), label="Rec709 (RGB)"),
            cp.Image(url=_url("Chromaticities", "Rec709_YC.exr"), label="Rec709_YC"),
            mode="abs",
            colormap="plasma",
        )
    )
    rep.md(
        "### Env-map layout — `OrientationCube` vs `OrientationLatLong`\n"
        "The same orientation reference as a cube-face map vs a lat-long map."
    )
    rep.add(
        cp.Compare(
            cp.Image(url=_url("MultiResolution", "OrientationLatLong.exr"),
                     label="OrientationLatLong", tonemap="aces"),
            cp.Image(url=_url("MultiResolution", "OrientationCube.exr"),
                     label="OrientationCube", tonemap="aces"),
            mode="abs",
            colormap="plasma",
        )
    )
    rep.md(
        "### Resolution — `LeftView/Balls` vs `LowResLeftView/Balls`\n"
        "Full-resolution left view against its low-resolution variant "
        "(prediction) — a resolution/downsample diff."
    )
    rep.add(
        cp.Compare(
            cp.Image(url=_url("v2/LowResLeftView", "Balls.exr"),
                     label="LowRes (prediction)", tonemap="aces"),
            cp.Image(url=_url("v2/LeftView", "Balls.exr"),
                     label="FullRes (reference)", tonemap="aces"),
            mode="abs",
            colormap="plasma",
        )
    )

    return rep


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "-o", "--output", "--out", dest="output",
        default="/tmp/cairn-openexr-gallery.html",
    )
    ap.add_argument("--open", action="store_true", help="open the file when done")
    args = ap.parse_args()
    path = Path(build_report().save(args.output)).expanduser().resolve()
    size_kb = path.stat().st_size // 1024
    total = sum(len(c["files"]) for c in CATEGORIES)
    print(
        f"Rendered OpenEXR gallery → {path}  ({size_kb} KB; "
        f"{total} images across {len(CATEGORIES)} categories; needs network to view)"
    )
    if args.open:
        from _open import open_in_browser

        open_in_browser(path)
    else:
        print(f"Open it:  open {path}")


if __name__ == "__main__":
    main()
