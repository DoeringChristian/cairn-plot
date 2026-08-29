"""cp.Compare — the flat `mode` enum (diff-kernels spec).

Verifies the public flat surface (`prediction`, `reference`, `mode=...`,
`colormap=...`) lowers to the internal `compare` descriptor node the pane
consumes, including the new `flip` perceptual kernel. `flip` is the additive
value this track lands; the pane initializes its diff kernel from the
descriptor's `operation`.
"""
from __future__ import annotations

import numpy as np
import pytest

import cairn_plot as cp


def _img():
    return cp.Image(np.zeros((4, 4, 3), dtype=np.float32))


def test_view_modes_lower_to_descriptor():
    # split (public == internal name).
    split = cp.Compare(_img(), _img(), mode="split", split_position=0.25).to_node()
    assert split["kind"] == "compare" and split["presentation"] == "split"
    assert split["settings"]["compare.split"] == 0.25


@pytest.mark.parametrize("mode", ["slide", "blend"])
def test_removed_view_modes_are_rejected(mode):
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode=mode)


def test_removed_blend_alpha_is_rejected():
    with pytest.raises(TypeError):
        cp.Compare(_img(), _img(), blend_alpha=0.5)


def test_default_mode_is_split():
    # The removed side-by-side view is gone; the default is "split".
    node = cp.Compare(_img(), _img()).to_node()
    assert node["kind"] == "compare"
    assert node["presentation"] == "split"
    assert node["referenceIndex"] == 0


def test_side_mode_rejected():
    # `side` is no longer a valid mode — it raises "unknown mode" rather than
    # silently emitting a dead descriptor mode.
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="side")


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
        ("ssim", "ssim"),
    ],
)
def test_comparison_operation_modes(mode, kernel_id):
    node = cp.Compare(_img(), _img(), mode=mode, colormap="turbo").to_node()
    assert node["kind"] == "compare"
    assert node["presentation"] == "difference"
    assert node["settings"]["compare.operation"] == kernel_id
    assert node["settings"]["image.encoding"] == "turbo"


def test_flip_is_accepted_and_orientation():
    # `flip` is the additive perceptual kernel; reference is the baseline.
    node = cp.Compare(_img(), _img(), mode="flip").to_node()
    assert node["settings"]["compare.operation"] == "flip"
    assert node["referenceIndex"] == 0


@pytest.mark.parametrize("flip_mode", ["hdr", "sdr"])
def test_flip_evaluation_mode_is_publicly_authored(flip_mode):
    node = cp.Compare(
        _img(), _img(), mode="flip", flip_mode=flip_mode,
    ).to_node()
    assert node["settings"]["compare.operation"] == "flip"
    assert node["settings"]["compare.flipMode"] == flip_mode


def test_flip_options_are_validated():
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="flip", flip_mode="automatic")
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="abs", flip_mode="hdr")


def test_flip_ldr_is_not_a_separate_public_mode():
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="flip_ldr")


def test_ssim_mode_accepted():
    # `ssim` is the structural-similarity diff kernel (displays 1 - SSIM).
    node = cp.Compare(_img(), _img(), mode="ssim").to_node()
    assert node["presentation"] == "difference"
    assert node["settings"]["compare.operation"] == "ssim"
    assert node["referenceIndex"] == 0


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
    assert node["props"]["align"] == "center"
    assert node["props"]["fit"] == "fill"


@pytest.mark.parametrize(
    "align",
    ["top-left", "center", "top-right", "bottom-left", "bottom-right"],
)
def test_each_align_value_accepted(align):
    node = cp.Compare(_img(), _img(), mode="abs", align=align).to_node()
    if align == "top-left":
        assert "align" not in node
    else:
        assert node["props"]["align"] == align


def test_fit_fill_accepted_and_crop_omitted():
    fill_node = cp.Compare(_img(), _img(), mode="abs", fit="fill").to_node()
    assert fill_node["props"]["fit"] == "fill"
    crop_node = cp.Compare(_img(), _img(), mode="abs", fit="crop").to_node()
    assert "fit" not in crop_node


def test_unknown_align_rejected():
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="abs", align="middle")


def test_unknown_fit_rejected():
    with pytest.raises(ValueError):
        cp.Compare(_img(), _img(), mode="abs", fit="stretch")
