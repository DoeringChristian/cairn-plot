"""Chart `colormap=` kwarg — Scatter / ParallelCoordinates / Heatmap.

The named-colormap set (`viridis` · `plasma` · `red-green` · `red-blue`) is now
a first-class kwarg on the color-by-value charts, validated against one
canonical allowed set. These assert the prop lowers into the descriptor node's
`props.colormap` and that an unknown name raises a clear ValueError.
"""
from __future__ import annotations

import numpy as np
import pytest

import cairn_plot as cp


def test_scatter_accepts_plasma():
    node = cp.Scatter([0, 1, 2], [0, 1, 4], color=[0.1, 0.5, 0.9], colormap="plasma").to_node()
    assert node["renderer"] == "scatter"
    assert node["props"]["colormap"] == "plasma"


def test_scatter_defaults_to_viridis():
    node = cp.Scatter([0, 1], [0, 1]).to_node()
    assert node["props"]["colormap"] == "viridis"


def test_scatter_rejects_unknown_colormap():
    with pytest.raises(ValueError, match="colormap must be one of"):
        cp.Scatter([0, 1], [0, 1], colormap="rainbow")


def test_parallel_coordinates_accepts_plasma():
    dims = {"a": [1, 2, 3], "b": [4, 5, 6]}
    node = cp.ParallelCoordinates(dims, colormap="plasma").to_node()
    assert node["renderer"] == "parallel"
    assert node["props"]["colormap"] == "plasma"


def test_parallel_coordinates_defaults_to_viridis():
    node = cp.ParallelCoordinates({"a": [1, 2], "b": [3, 4]}).to_node()
    assert node["props"]["colormap"] == "viridis"


def test_parallel_coordinates_rejects_unknown_colormap():
    with pytest.raises(ValueError, match="colormap must be one of"):
        cp.ParallelCoordinates({"a": [1, 2], "b": [3, 4]}, colormap="jet")


def test_heatmap_accepts_plasma_and_rejects_unknown():
    node = cp.Heatmap(np.arange(9).reshape(3, 3), colormap="plasma").to_node()
    assert node["props"]["colormap"] == "plasma"
    with pytest.raises(ValueError, match="colormap must be one of"):
        cp.Heatmap(np.zeros((2, 2)), colormap="inferno")
