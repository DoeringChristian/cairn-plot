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
    # side lowers to a 2-cell grid (no compare node).
    side = cp.Compare(_img(), _img(), mode="side").to_node()
    assert side["kind"] == "grid"


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


def test_unknown_mode_rejected():
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="not_a_mode")
