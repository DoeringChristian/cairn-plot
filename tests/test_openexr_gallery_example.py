"""Smoke test: the OpenEXR URL gallery example builds offline & self-contained.

Drives ``examples/demo_openexr_gallery.py`` headlessly (no browser, no server,
NO network). The example references the full ASWF openexr-images set purely by
URL; the emitted HTML must keep every URL verbatim (nothing fetched at build
time) while still inlining its own renderer bundle so the page carries no
EXTERNAL resource tags. Mirrors ``tests/test_plot_gallery_example.py``.
"""

from __future__ import annotations

import importlib.util
import pathlib
import re

_EXAMPLE = (
    pathlib.Path(__file__).resolve().parents[1]
    / "examples"
    / "demo_openexr_gallery.py"
)


def _load_example():
    spec = importlib.util.spec_from_file_location("demo_openexr_gallery", _EXAMPLE)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_example_file_exists():
    assert _EXAMPLE.is_file(), f"missing example at {_EXAMPLE}"


def test_catalogue_covers_the_expected_categories():
    mod = _load_example()
    dirs = {c["dir"] for c in mod.CATEGORIES}
    for expected in (
        "ScanLines", "Tiles", "Chromaticities", "LuminanceChroma",
        "DisplayWindow", "MultiResolution", "MultiView", "Beachball",
        "TestImages", "v2/Stereo", "v2/LeftView", "v2/LowResLeftView",
    ):
        assert expected in dirs, f"missing category {expected}"
    # The full sample set is 97 EXRs (openexr-images @ main).
    total = sum(len(c["files"]) for c in mod.CATEGORIES)
    assert total == 97, f"expected 97 catalogued images, got {total}"


def test_gallery_builds_offline_and_self_contained():
    mod = _load_example()
    rep = mod.build_report()
    html = rep._repr_html_()

    # Every pane keeps its URL verbatim — nothing was fetched or embedded.
    assert mod.ASWF in html
    for path in (
        "ScanLines/Desk.exr",
        "Beachball/multipart.0008.exr",
        "DisplayWindow/t16.exr",
        "v2/Stereo/Trunks.exr",
        "Chromaticities/Rec709_YC.exr",
    ):
        assert f"{mod.ASWF}/{path}" in html, f"missing URL for {path}"

    # Self-contained: renderer bundle inlined exactly once, no render errors.
    assert html.count("if(!window.__cairnPlotBundleLoaded){(function()") == 1
    assert "could not render" not in html

    # The URLs live in the descriptor as DATA, never as external resource tags:
    # the page fetches nothing at load time (only when a pane is viewed).
    external_tags = re.findall(
        r"<(?:script|link|img)\b[^>]*\b(?:src|href)\s*=\s*[\"']https?://",
        html,
    )
    assert not external_tags, f"unexpected external resource tags: {external_tags[:3]}"


def test_labels_and_compare_pairs_present():
    mod = _load_example()
    html = mod.build_report()._repr_html_()
    # Per-image captions (cp.Image(label=...)).
    for label in ("WideColorGamut", "OrientationCube", "Rec709_YC"):
        assert label in html, f"missing label {label}"
    # cp.Compare operands carry prediction/reference-style side labels.
    assert "LowRes (prediction)" in html
    assert "FullRes (reference)" in html
