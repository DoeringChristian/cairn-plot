"""Cross-face CONTRACT guard (Python side).

Pins the Python string-enum tuples to the committed canonical contract
`schema/cairn-plot-contracts.json` — the SAME file `ui/src/lib/cairn-plot/
contracts.test.ts` pins the TS sources to. So neither language can drift the
colormap / HDR tone-map / public compare-kernel sets without failing a guard:

  - `_COLORMAPS`               ↔ contract `colormaps`
  - `_HDR_TONEMAP_OPERATORS`   ↔ contract `tonemapOperators`
  - `_COMPARE_KERNEL_MODES`    ↔ contract `compareKernelPublicNames`

Comparisons are set-based (the JSON's order is documentation only). A cheap
grep-based doc-drift check keeps `docs/API.md`'s human-facing lists in step too.
"""
from __future__ import annotations

import json
from pathlib import Path

from cairn_plot.components import (
    _COLORMAPS,
    _COMPARE_KERNEL_MODES,
    _HDR_TONEMAP_OPERATORS,
)

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = json.loads((ROOT / "schema" / "cairn-plot-contracts.json").read_text())


def test_colormaps_match_contract() -> None:
    assert set(_COLORMAPS) == set(CONTRACT["colormaps"])


def test_tonemap_operators_match_contract() -> None:
    assert set(_HDR_TONEMAP_OPERATORS) == set(CONTRACT["tonemapOperators"])


def test_compare_kernel_public_names_match_contract() -> None:
    # `_COMPARE_KERNEL_MODES` keys are the PUBLIC `cp.Compare(mode=)` diff names —
    # the auto-dispatch-only `flip_hdr` (reached under `flip` on float sources) is
    # intentionally NOT a public mode, matching the TS `listDiffKernelPublicNames()`
    # which filters it out.
    assert set(_COMPARE_KERNEL_MODES.keys()) == set(CONTRACT["compareKernelPublicNames"])


def test_api_doc_lists_every_contract_name() -> None:
    # Cheap doc-drift guard: docs/API.md must mention every contract name, so its
    # human-facing colormap / tonemap / kernel lists can't silently fall behind.
    api = (ROOT / "docs" / "API.md").read_text()
    for group in ("colormaps", "tonemapOperators", "compareKernelPublicNames"):
        for name in CONTRACT[group]:
            assert name in api, f"docs/API.md is missing contract name {name!r} ({group})"
