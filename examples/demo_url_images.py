"""URL-referenced images — client-side fetch + decode (EXR over HTTP).

Demonstrates ``cp.Image(url=...)``: the emitted HTML keeps the URL verbatim
(nothing is embedded), and the BROWSER fetches + sniffs + decodes the blob at
view time — including formats a browser can't ``<img>``-decode, like OpenEXR
(decoded WASM-first by the upstream OpenEXR C++ library compiled to WebAssembly,
off the main thread in a Web Worker — every compression incl. HTJ2K, scanline &
tiled, deep, multi-part, and luminance-chroma).

Sources are the ASWF openexr-images sample repo (served with CORS ``*``):

* ``WideColorGamut.exr`` — ZIP-compressed RGB → decodes and renders in the
  float-HDR pane (tone-map/exposure controls live).
* ``Desk.exr`` — PIZ-compressed → decoded by the same OpenEXR WASM module,
  off the main thread in a Web Worker.

NOTE: viewing needs NETWORK access (the whole point — the images are
referenced, not baked), so this stays a separate example: the offline demo
gallery and the ``smoke:plot`` CI gate must not depend on the network.

Run:  PYTHONPATH=. python examples/demo_url_images.py [-o out.html] [--open]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cairn_plot as cp

ASWF = "https://raw.githubusercontent.com/AcademySoftwareFoundation/openexr-images/main"


def build_report() -> "cp.Report":
    return (
        cp.Report(title="cairn-plot — URL-referenced images")
        .md(
            "## EXR fetched + decoded client-side\n"
            "The HTML below embeds **no image bytes** — each pane holds only a URL. "
            "The browser fetches the blob and cairn-plot's decoder registry sniffs "
            "(content-type → extension → magic bytes) and decodes it.\n"
        )
        .md(
            "### ZIP EXR — `TestImages/WideColorGamut.exr`\n"
            "ZIP-compressed RGB half-float; decoded by the OpenEXR WASM module "
            "into the float-HDR pane — tone-map and exposure are live."
        )
        .add(cp.Image(url=f"{ASWF}/TestImages/WideColorGamut.exr", tonemap="aces"))
        .md(
            "### PIZ EXR — `ScanLines/Desk.exr`\n"
            "PIZ (wavelet+Huffman — OpenEXR's historic default) is decoded by the "
            "OpenEXR WASM module, running **off the main thread** in a Web Worker. "
            "The same module covers every EXR compression, incl. PXR24, B44(A), "
            "DWAA/DWAB, and HTJ2K."
        )
        .add(cp.Image(url=f"{ASWF}/ScanLines/Desk.exr"))
        .md(
            "### URL comparison — `SquaresSwirls.exr` vs `WideColorGamut.exr`\n"
            "Both operands are URL-referenced EXRs (PXR24 and ZIP compressed) — "
            "fetched, decoded, and diffed client-side through the cached diff "
            "pipeline (`mode=\"abs\"`, `colormap=\"plasma\"`). Use the toolbar "
            "menus to switch the diff kernel (incl. FLIP) and colormap live; "
            "dimensions are min-cropped for the diff."
        )
        .add(
            cp.Compare(
                cp.Image(url=f"{ASWF}/TestImages/SquaresSwirls.exr"),
                cp.Image(url=f"{ASWF}/TestImages/WideColorGamut.exr"),
                mode="abs",
                colormap="plasma",
            )
        )
        .md(
            "### DEEP EXR — `v2/Stereo/Trunks.exr`\n"
            "A **deep** tiled EXR (per-pixel sample *lists* with Z, from the "
            "official OpenEXR 2.0 stereo examples) — and a multi-part file "
            "(left/right views; part 0 = left is decoded). The WASM decoder "
            "flattens the deep samples for display: per pixel, samples are "
            "Z-sorted front-to-back and OVER-composited (associated alpha) "
            "into a flat HDR image — fully client-side."
        )
        .add(cp.Image(url=f"{ASWF}/v2/Stereo/Trunks.exr", tonemap="aces"))
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "-o", "--output", "--out", dest="output",
        default="/tmp/cairn-url-images.html",
    )
    ap.add_argument("--open", action="store_true", help="open the file when done")
    args = ap.parse_args()
    path = Path(build_report().save(args.output)).expanduser().resolve()
    size_kb = path.stat().st_size // 1024
    print(f"Rendered URL-image demo → {path}  ({size_kb} KB; needs network to view)")
    if args.open:
        import webbrowser

        webbrowser.open(path.as_uri())
    else:
        print(f"Open it:  open {path}")


if __name__ == "__main__":
    main()
