"""cp.Image(label=...) — the per-image caption.

`label` is emitted as `props.label` on every Image data path (8-bit / float /
url), renders as a bottom-left chip on the pane, and — when the image is a
`cp.Compare` operand — feeds the compare node's per-side labels (`labelA`/
`labelB`, matched to the a/b slots) so the pane can caption reference vs
foreground. No label ⇒ no `label` prop (and no per-side label on Compare).
"""
from __future__ import annotations

import numpy as np
import pytest

import cairn_plot as cp


def test_label_on_8bit_image():
    node = cp.Image(np.zeros((4, 4, 3), dtype=np.uint8), label="pred").to_node()
    assert node["props"]["label"] == "pred"


def test_label_on_float_image():
    node = cp.Image(np.zeros((4, 4), dtype=np.float32), label="hdr").to_node()
    assert node["props"]["label"] == "hdr"


def test_label_on_url_image():
    node = cp.Image(url="http://example/x.png", label="urlcap").to_node()
    assert node["props"]["label"] == "urlcap"


def test_no_label_emits_no_label_prop():
    node = cp.Image(np.zeros((4, 4, 3), dtype=np.uint8)).to_node()
    assert "label" not in (node.get("props") or {})


def test_label_must_be_a_string():
    with pytest.raises(ValueError):
        cp.Image(np.zeros((4, 4, 3), dtype=np.uint8), label=123)  # type: ignore[arg-type]


def test_compare_threads_both_side_labels():
    # cp.Compare(prediction, reference): internally _a = reference (baselineIndex
    # 0, slot a), _b = prediction (slot b). So labelA names the REFERENCE and
    # labelB the PREDICTION/foreground.
    node = cp.Compare(
        cp.Image(np.zeros((4, 4, 3), dtype=np.uint8), label="prediction"),
        cp.Image(np.zeros((4, 4, 3), dtype=np.uint8), label="ground-truth"),
    ).to_node()
    props = node.get("props") or {}
    assert props.get("labelA") == "ground-truth"  # slot a = reference
    assert props.get("labelB") == "prediction"  # slot b = foreground


def test_compare_omits_missing_side_labels():
    # Only the foreground (prediction) carries a caption → only labelB is set.
    node = cp.Compare(
        cp.Image(np.zeros((4, 4, 3), dtype=np.uint8), label="prediction"),
        cp.Image(np.zeros((4, 4, 3), dtype=np.uint8)),
    ).to_node()
    props = node.get("props") or {}
    assert props.get("labelB") == "prediction"
    assert "labelA" not in props
