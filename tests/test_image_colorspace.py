"""Normal-map display COLORSPACE validation + prop emission on the Python side.

`colorspace="normal"` engages the float-only normal-map `v → (v+1)/2` display
remap. The Python layer VALIDATES the name and emits `props.colorspace="normal"`
on the FLOAT path (a real float ndarray, or a URL that may decode to float),
ignores it (with a warning) on an 8-bit source, and omits it for the default
`"linear"`. These tests pin that plumbing + the node lowering so the Python and
client sides can't drift (the client remap math is unit-tested in
`ui/.../image/normal-map.test.ts`).
"""
from __future__ import annotations

import numpy as np
import pytest

import cairn_plot as cp
from cairn_plot.components import (
    _IMAGE_COLORSPACES,
    _check_colorspace,
    _image_hdr_props,
)


def _float_normal_map() -> np.ndarray:
    """A tiny (H,W,3) float32 normal map in [-1,1] (a flat +Z field)."""
    arr = np.zeros((2, 2, 3), dtype=np.float32)
    arr[..., 2] = 1.0  # +Z
    return arr


# ---------------------------------------------------------------------------
# Validation.
# ---------------------------------------------------------------------------


def test_colorspace_set() -> None:
    assert _IMAGE_COLORSPACES == ("linear", "normal")


@pytest.mark.parametrize("mode", list(_IMAGE_COLORSPACES))
def test_valid_colorspaces_accepted(mode: str) -> None:
    assert _check_colorspace(mode) == mode


def test_unknown_colorspace_rejected() -> None:
    with pytest.raises(ValueError, match="colorspace must be one of"):
        _check_colorspace("srgb")
    with pytest.raises(ValueError, match="colorspace must be one of"):
        cp.Image(_float_normal_map(), colorspace="bogus")


# ---------------------------------------------------------------------------
# Prop emission — `_image_hdr_props` (the float-path builder).
# ---------------------------------------------------------------------------


def test_hdr_props_emit_normal() -> None:
    props = _image_hdr_props(colorspace="normal")
    assert props["colorspace"] == "normal"


def test_hdr_props_omit_default_colorspace() -> None:
    # "linear" and None are the default no-op — never emitted.
    assert "colorspace" not in _image_hdr_props()
    assert "colorspace" not in _image_hdr_props(colorspace="linear")


# ---------------------------------------------------------------------------
# End-to-end node lowering.
# ---------------------------------------------------------------------------


def test_float_image_lowers_colorspace_prop() -> None:
    node = cp.Image(_float_normal_map(), colorspace="normal").to_node()
    assert node["renderer"] == "image"
    assert node["data"]["kind"] == "imghdr"
    assert node["props"]["colorspace"] == "normal"


def test_float_image_default_has_no_colorspace_prop() -> None:
    node = cp.Image(_float_normal_map()).to_node()
    assert "colorspace" not in (node.get("props") or {})


def test_url_image_emits_colorspace_for_possible_float_decode() -> None:
    # A URL may decode to a float source client-side, so `normal` is emitted; the
    # pane honours it only on the float path.
    node = cp.Image(url="https://example.com/normals.exr", colorspace="normal").to_node()
    assert node["props"]["colorspace"] == "normal"


def test_uint8_image_ignores_normal_with_warning(caplog: pytest.LogCaptureFixture) -> None:
    # An 8-bit source is conventionally already (n+1)/2-encoded, so `normal` is a
    # float-only mode: ignored (never emitted) with a warning.
    u8 = np.zeros((2, 2, 3), dtype=np.uint8)
    with caplog.at_level("WARNING"):
        node = cp.Image(u8, colorspace="normal").to_node()
    assert "colorspace" not in (node.get("props") or {})
    assert any("FLOAT-only" in rec.message for rec in caplog.records)


def test_image_helper_threads_colorspace() -> None:
    # The `cp.image(...)` convenience wrapper forwards `colorspace=` to `cp.Image`.
    # A single-image element nests the plot leaf under `root`.
    desc = cp.image(_float_normal_map(), colorspace="normal")._descriptor_dict()
    assert desc["root"]["props"]["colorspace"] == "normal"
