from cairn_plot import Grid, Line


def test_grid_switching_is_enabled_by_omission_and_can_be_disabled() -> None:
    child = Line([1, 2])
    assert "switchable" not in Grid([child, child]).to_node()
    assert Grid([child, child], switchable=False).to_node()["switchable"] is False

