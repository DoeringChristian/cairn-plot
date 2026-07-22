"""cp.Compare — the flat `mode` enum (diff-kernels spec).

Verifies the public flat surface (`prediction`, `reference`, `mode=...`,
`colormap=...`) lowers to the internal `compare` descriptor node the pane
consumes, including the new `flip` perceptual kernel. `flip` is the additive
value this track lands; the pane initializes its diff kernel from the
descriptor's `diffSubmode`.
"""
from __future__ import annotations

import numpy as np
import pytest

import cairn_plot as cp


def _img():
    return cp.Image(np.zeros((4, 4, 3), dtype=np.float32))


def test_view_modes_lower_to_descriptor():
    # slide -> internal split; blend -> blend.
    slide = cp.Compare(_img(), _img(), mode="slide", split_position=0.25).to_node()
    assert slide["kind"] == "compare" and slide["mode"] == "split"
    assert slide["props"]["splitPosition"] == 0.25
    blend = cp.Compare(_img(), _img(), mode="blend", blend_alpha=0.5).to_node()
    assert blend["mode"] == "blend"


def test_side_lowers_to_compare_node():
    # `side` now emits a COMPARE node (mode="side"), NOT a 2-cell grid — so the
    # view-mode menu can switch it client-side. a=reference, b=prediction,
    # baselineIndex=0 (the REF pane), matching the other compare modes.
    side = cp.Compare(_img(), _img(), mode="side").to_node()
    assert side["kind"] == "compare"
    assert side["mode"] == "side"
    assert side["baselineIndex"] == 0
    assert side["a"] is not None and side["b"] is not None


def test_side_requires_image_leaves():
    # side is a compare node now, so non-image operands raise (use cp.Grid).
    with pytest.raises(TypeError):
        cp.Compare(cp.Line([1, 2, 3]), _img(), mode="side")


@pytest.mark.parametrize(
    "mode,kernel_id",
    [
        ("signed", "signed"),
        ("abs", "absolute"),
        ("square", "squared"),
        ("rel_signed", "relative_signed"),
        ("rel_abs", "relative_absolute"),
        ("rel_square", "relative_squared"),
        ("flip", "flip"),
        ("flip_ldr", "flip_ldr"),
    ],
)
def test_diff_kernel_modes(mode, kernel_id):
    node = cp.Compare(_img(), _img(), mode=mode, colormap="viridis").to_node()
    assert node["kind"] == "compare"
    assert node["mode"] == "diff"
    # The kernel id rides on `diffSubmode` — the pane's initial diff kernel.
    assert node["props"]["diffSubmode"] == kernel_id
    assert node["props"]["colormap"] == "viridis"


def test_flip_is_accepted_and_orientation():
    # `flip` is the additive perceptual kernel; reference is the baseline.
    node = cp.Compare(_img(), _img(), mode="flip").to_node()
    assert node["props"]["diffSubmode"] == "flip"
    assert node["baselineIndex"] == 0


def test_flip_ldr_forced_mode_accepted():
    # `flip_ldr` forces the LDR-FLIP comparison (tone-map-first on float sources).
    node = cp.Compare(_img(), _img(), mode="flip_ldr").to_node()
    assert node["mode"] == "diff"
    assert node["props"]["diffSubmode"] == "flip_ldr"
    assert node["baselineIndex"] == 0


def test_unknown_mode_rejected():
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="not_a_mode")


def test_align_and_fit_defaults_omitted_from_node():
    # Defaults ("top-left" / "crop") are elided — the descriptor stays minimal.
    node = cp.Compare(_img(), _img(), mode="abs").to_node()
    assert "align" not in node
    assert "fit" not in node


def test_align_and_fit_non_default_emitted_top_level():
    node = cp.Compare(_img(), _img(), mode="abs", align="center", fit="fill").to_node()
    assert node["align"] == "center"
    assert node["fit"] == "fill"


@pytest.mark.parametrize(
    "align",
    ["top-left", "center", "top-right", "bottom-left", "bottom-right"],
)
def test_each_align_value_accepted(align):
    node = cp.Compare(_img(), _img(), mode="abs", align=align).to_node()
    if align == "top-left":
        assert "align" not in node
    else:
        assert node["align"] == align


def test_fit_fill_accepted_and_crop_omitted():
    fill_node = cp.Compare(_img(), _img(), mode="abs", fit="fill").to_node()
    assert fill_node["fit"] == "fill"
    crop_node = cp.Compare(_img(), _img(), mode="abs", fit="crop").to_node()
    assert "fit" not in crop_node


def test_unknown_align_rejected():
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="abs", align="middle")


def test_unknown_fit_rejected():
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="abs", fit="stretch")
