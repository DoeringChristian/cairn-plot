"""HDR tone-map operator validation on the Python side (`_image_hdr_props`).

The Python layer only VALIDATES the `tonemap=` name (against
`_HDR_TONEMAP_OPERATORS`) and passes it through verbatim; the SDR fallback for a
client that never engages a true-HDR surface happens on the client
(`image/tonemap.ts`'s `toSdrTonemap` / `resolveEffectiveTonemap`, unit-tested
there). These tests pin the accepted set — including the new managed-linear
operator `extended-clamp` — and the documented `extended-clamp → linear`
degrade, so the two sides can't drift.
"""
from __future__ import annotations

import pytest

from cairn_plot.components import (
    _HDR_TONEMAP_OPERATORS,
    _SDR_DISPLAY_TRANSFERS,
    _image_hdr_props,
    _image_sdr_transfer_props,
)


def test_extended_clamp_is_accepted() -> None:
    # The new managed-linear operator round-trips verbatim into the props.
    props = _image_hdr_props(tonemap="extended-clamp")
    assert props["tonemap"] == "extended-clamp"


def test_extended_clamp_is_in_the_operator_set() -> None:
    assert "extended-clamp" in _HDR_TONEMAP_OPERATORS


@pytest.mark.parametrize("op", list(_HDR_TONEMAP_OPERATORS))
def test_every_operator_is_accepted_verbatim(op: str) -> None:
    # Every operator in the canonical set is accepted and passed through
    # unchanged — the Python side never rewrites it (the client owns the
    # HDR-engaged / SDR-fallback resolution).
    assert _image_hdr_props(tonemap=op)["tonemap"] == op


def test_unknown_operator_is_rejected() -> None:
    with pytest.raises(ValueError, match="must be one of"):
        _image_hdr_props(tonemap="extended-nope")


def test_default_tonemap_is_srgb() -> None:
    # Unset tonemap stays the SDR default; managed linear is an explicit opt-in.
    assert _image_hdr_props()["tonemap"] == "srgb"


def test_extended_clamp_degrades_to_linear_is_documented() -> None:
    # The client falls back extended-clamp → linear when HDR is not engaged
    # (mirroring extended→linear). We can't run the client here, but pin that
    # the documented natural SDR counterpart of the managed clamp is `linear`
    # and that `linear` is itself a valid SDR operator, so the fallback target
    # is always a legal operator.
    assert "linear" in _HDR_TONEMAP_OPERATORS
    doc = _image_hdr_props.__doc__ or ""
    assert "extended-clamp" in doc
    assert "degrades to ``linear``" in doc


# ---------------------------------------------------------------------------
# Gamma operator + SDR display transfer.
# ---------------------------------------------------------------------------


def test_gamma_is_a_valid_hdr_operator() -> None:
    assert "gamma" in _HDR_TONEMAP_OPERATORS
    assert _image_hdr_props(tonemap="gamma")["tonemap"] == "gamma"


def test_hdr_gamma_arg_auto_selects_gamma_operator() -> None:
    # cp.Image(hdr, gamma=2.2) with no explicit tonemap selects the Gamma
    # operator (preserving the pre-operator gamma-override intent).
    props = _image_hdr_props(gamma=2.2)
    assert props["tonemap"] == "gamma"
    assert props["gamma"] == 2.2
    # An explicit tonemap still wins; gamma is just its γ default.
    assert _image_hdr_props(tonemap="aces", gamma=2.2)["tonemap"] == "aces"


def test_sdr_display_transfer_set() -> None:
    assert set(_SDR_DISPLAY_TRANSFERS) == {"srgb", "gamma", "linear"}


def test_sdr_transfer_props_defaults_empty() -> None:
    # Neither tonemap nor gamma → no props (client default "srgb").
    assert _image_sdr_transfer_props() == {}


@pytest.mark.parametrize("t", ["srgb", "gamma", "linear"])
def test_sdr_transfer_accepts_display_transfers(t: str) -> None:
    assert _image_sdr_transfer_props(tonemap=t)["tonemap"] == t


def test_sdr_gamma_arg_auto_selects_and_routes_to_transfer() -> None:
    props = _image_sdr_transfer_props(gamma=1.8)
    assert props == {"tonemap": "gamma", "gamma": 1.8}


def test_sdr_transfer_rejects_hdr_only_operators() -> None:
    # Reinhard/ACES/extended are HDR-only; an 8-bit image can't select them.
    for op in ("reinhard", "aces", "extended", "extended-clamp"):
        with pytest.raises(ValueError, match="HDR-only|must be one of"):
            _image_sdr_transfer_props(tonemap=op)


def test_sdr_image_gamma_routes_to_transfer_not_processing() -> None:
    # cp.Image on an 8-bit source: gamma= feeds the DISPLAY TRANSFER (top-level),
    # NOT the CSS-filter processing.gamma — so it is never applied twice.
    import numpy as np

    import cairn_plot as cp

    img = cp.Image(np.zeros((4, 4, 3), dtype=np.uint8), tonemap="gamma", gamma=2.2)
    props = img._props
    assert props.get("tonemap") == "gamma"
    assert props.get("gamma") == 2.2
    # processing block (if present) must NOT carry the gamma (default 1.0 there).
    assert props.get("processing", {}).get("gamma", 1.0) == 1.0
