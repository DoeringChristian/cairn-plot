"""Host-seam ``toolbar=`` emission on ``cp.Image`` / ``cp.Compare``.

The user feature: "To allow cairn to display its own menu for configuring
cairn-plot image views, it should be possible to hide the toolbar with an
argument." These tests pin the descriptor contract:

  * ``toolbar=False`` emits ``props.toolbar = false`` on the image / imagehdr /
    compare nodes.
  * the default (unset / ``True``) emits NOTHING (minimal descriptor — the
    client default shows the toolbar).
  * the kwarg is a VALIDATED bool (a stray ``1``/``"no"`` is rejected so a typo
    can't silently drop the toolbar).
  * hiding the toolbar never disturbs the other controlled props (colormap /
    tonemap / exposure / offset / gamma / peak) — the host-menu contract.
"""
from __future__ import annotations

import numpy as np
import pytest

import cairn_plot as cp
from cairn_plot.components import _check_toolbar, _toolbar_prop


# --- the low-level helpers ------------------------------------------------


def test_check_toolbar_accepts_bools_and_none() -> None:
    assert _check_toolbar(None) is None
    assert _check_toolbar(True) is True
    assert _check_toolbar(False) is False


@pytest.mark.parametrize("bad", [1, 0, "no", "true", 1.0])
def test_check_toolbar_rejects_non_bool(bad: object) -> None:
    with pytest.raises(ValueError, match="toolbar must be a bool"):
        _check_toolbar(bad)


def test_toolbar_prop_only_emits_when_disabled() -> None:
    assert _toolbar_prop(False) == {"toolbar": False}
    assert _toolbar_prop(True) == {}
    assert _toolbar_prop(None) == {}


# --- cp.Image (8-bit / SDR) -----------------------------------------------


def _sdr() -> np.ndarray:
    return np.zeros((4, 4, 3), dtype=np.uint8)


def test_image_sdr_toolbar_false_emits_prop() -> None:
    node = cp.Image(_sdr(), toolbar=False).to_node()
    assert node["props"]["toolbar"] is False


def test_image_sdr_toolbar_default_omitted() -> None:
    # No props at all when nothing else is set — the toolbar stays shown.
    assert cp.Image(_sdr()).to_node().get("props") is None
    assert cp.Image(_sdr(), toolbar=True).to_node().get("props") is None


def test_image_sdr_toolbar_coexists_with_display_props() -> None:
    node = cp.Image(_sdr(), toolbar=False, colormap="turbo", show_axes=True).to_node()
    props = node["props"]
    assert props["toolbar"] is False
    assert node["settings"]["image.encoding"] == "turbo"
    assert props["showAxes"] is True


# --- cp.Image (float-HDR) -------------------------------------------------


def _hdr() -> np.ndarray:
    return np.array([[2.0, 0.5], [0.1, 3.0]], dtype=np.float32)


def test_image_hdr_toolbar_false_emits_prop() -> None:
    node = cp.Image(_hdr(), toolbar=False).to_node()
    # Unified: ONE renderer id ("image") — a float array is the float SURFACE of
    # that one renderer (DataSpec kind "imghdr"), not a separate renderer.
    assert node["type"] == "image"
    assert node["data"]["kind"] == "imghdr"
    assert node["props"]["toolbar"] is False


def test_image_hdr_base_exposure_and_offset_are_controlled() -> None:
    # EV/offset are the CONTROLLED host-menu surface for the HDR pane: both emit
    # top-level so a host can drive them with the toolbar hidden.
    node = cp.Image(_hdr(), toolbar=False, exposure=1.5, offset=0.25).to_node()
    assert node["settings"]["image.exposureEV"] == 1.5
    assert node["settings"]["image.offset"] == 0.25
    assert node["props"]["toolbar"] is False


def test_image_hdr_offset_no_longer_ignored(caplog: pytest.LogCaptureFixture) -> None:
    # `offset` used to be warned-and-dropped on the HDR path; it is now honoured.
    node = cp.Image(_hdr(), offset=0.2).to_node()
    assert node["settings"]["image.offset"] == 0.2
    assert "offset" not in caplog.text


# --- cp.Compare -----------------------------------------------------------


def test_compare_toolbar_false_emits_prop() -> None:
    node = cp.Compare(cp.Image(_sdr()), cp.Image(_sdr()), mode="split", toolbar=False).to_node()
    assert node["props"]["toolbar"] is False


def test_compare_toolbar_default_omitted() -> None:
    node = cp.Compare(cp.Image(_sdr()), cp.Image(_sdr()), mode="split").to_node()
    assert (node.get("props") or {}).get("toolbar") is None


def test_compare_toolbar_coexists_with_mode_and_colormap() -> None:
    node = cp.Compare(
        cp.Image(_sdr()), cp.Image(_sdr()), mode="abs", colormap="magma", toolbar=False
    ).to_node()
    props = node["props"]
    assert props["toolbar"] is False
    assert node["settings"]["image.encoding"] == "magma"
    assert node["settings"]["compare.operation"] == "absolute"


def test_compare_toolbar_rejects_non_bool() -> None:
    with pytest.raises(ValueError, match="toolbar must be a bool"):
        cp.Compare(cp.Image(_sdr()), cp.Image(_sdr()), toolbar="no")
