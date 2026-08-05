"""HDR tone-map operator validation on the Python side (`_image_hdr_props`).

UNIFIED surface: `tonemap=` is one of the canonical 5 (`_TONEMAP_OPERATORS`) OR
a DEPRECATED `extended*` alias (`_TONEMAP_ALIASES`), and `peak=` (P) is the HDR
mode. The Python layer only VALIDATES the name and passes it through verbatim
(+ the optional `peak`); the client canonicalizes aliases and resolves the
(operator, P, surface) triple to the render params (`image/tonemap.ts`'s
`resolveEffectiveTonemap` / `resolveRenderTonemap`, unit-tested there). These
tests pin the accepted set + aliases + the peak plumbing so the two sides can't
drift.
"""
from __future__ import annotations

import pytest

from cairn_plot.components import (
    _HDR_TONEMAP_OPERATORS,
    _TONEMAP_OPERATORS,
    _TONEMAP_ALIASES,
    _SDR_DISPLAY_TRANSFERS,
    _image_hdr_props,
    _image_sdr_transfer_props,
)


def test_canonical_operator_set() -> None:
    assert _TONEMAP_OPERATORS == ("linear", "srgb", "gamma", "reinhard", "aces")


def test_deprecated_aliases_are_accepted() -> None:
    # The pre-unification `extended*` names are still ACCEPTED (resolved by the
    # client to a canonical operator + peak).
    for alias in _TONEMAP_ALIASES:
        assert alias in _HDR_TONEMAP_OPERATORS
        assert _image_hdr_props(tonemap=alias)["tonemap"] == alias


@pytest.mark.parametrize("op", list(_HDR_TONEMAP_OPERATORS))
def test_every_operator_is_accepted_verbatim(op: str) -> None:
    # Every accepted name (canonical ∪ alias) passes through unchanged — the
    # Python side never rewrites it (the client owns canonicalization + the
    # HDR-engaged / SDR resolution).
    assert _image_hdr_props(tonemap=op)["tonemap"] == op


def test_unknown_operator_is_rejected() -> None:
    with pytest.raises(ValueError, match="must be one of"):
        _image_hdr_props(tonemap="extended-nope")


def test_default_tonemap_is_unset() -> None:
    # UNIFIED: an unset tonemap emits NO `tonemap` prop — the client applies its
    # surface default (Linear + managed PEAK on an engaged HDR surface, sRGB on
    # SDR). Only `exposure` is always emitted.
    props = _image_hdr_props()
    assert "tonemap" not in props
    assert props["exposure"] == 0.0


def test_alias_mapping_is_documented() -> None:
    # The alias → (operator, peak) resolution is documented on the builder.
    doc = _image_hdr_props.__doc__ or ""
    assert "extended-clamp" in doc
    assert "extended-gamma" in doc
    assert "``linear``" in doc


# ---------------------------------------------------------------------------
# PEAK (the unified HDR mode) plumbing.
# ---------------------------------------------------------------------------


def test_peak_is_emitted_only_when_set() -> None:
    assert "peak" not in _image_hdr_props(tonemap="reinhard")
    assert _image_hdr_props(tonemap="reinhard", peak=8.0)["peak"] == 8.0
    # Any operator can carry a peak (Linear/sRGB/Gamma hard-clip at P too).
    assert _image_hdr_props(tonemap="linear", peak=2.0)["peak"] == 2.0


# ---------------------------------------------------------------------------
# Gamma operator + SDR display transfer.
# ---------------------------------------------------------------------------


def test_gamma_is_a_valid_operator() -> None:
    assert "gamma" in _TONEMAP_OPERATORS
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
