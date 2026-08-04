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

from cairn_plot.components import _HDR_TONEMAP_OPERATORS, _image_hdr_props


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
