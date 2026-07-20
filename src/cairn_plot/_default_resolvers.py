"""Default raw-data resolvers for standalone cairn_plot.

The pure components expose a resolver seam (``components.register_resolvers``)
for the raw tabular / 3D-array data paths (``cp.Table(df)`` / ``cp.PointCloud``
/ ``cp.Mesh`` / ``cp.Volume`` / ``cp.Boxes``). In the full ``cairn-track``
install, ``cairn.plot`` registers resolvers that route through the tracking
handlers so tracked ``run[tag]`` data and inline data shape identically.

Standalone, there is no tracking layer — but the *serialization* is pure
numpy/stdlib, so cairn_plot vendors those handlers under :mod:`cairn_plot._sdk`
and registers them here as the DEFAULT resolvers. That makes the local(baked)
data mode fully self-contained: raw arrays / DataFrames / dicts bake straight
into an offline HTML page with no server and no cairn-track. (When cairn-track
IS installed, ``cairn.plot`` re-registers its own resolvers on top — a plain
``dict.update`` — so tracked-data behavior is unchanged.)

Imported for its side effect from :mod:`cairn_plot` at package import.
"""

from __future__ import annotations

import json as _json
from typing import Any

from .components import register_resolvers


def _table_json_from_raw(data: Any) -> dict[str, Any]:
    """Raw tabular data -> the canonical table blob, via the same
    ``TableHandler`` the tracking path uses (columns/type inference identical)."""
    from ._sdk.handlers.table import TableHandler

    if hasattr(data, "itertuples") and hasattr(data, "columns"):
        wrapper: dict[str, Any] = {"dataframe": data}
    elif isinstance(data, dict):
        wrapper = (
            {"columns": list(data.keys()), "data": list(zip(*data.values()))}
            if data
            else {"data": []}
        )
    else:
        rows = list(data)
        if rows and isinstance(rows[0], dict):
            columns: list[str] = []
            for r in rows:
                for k in r:
                    if k not in columns:
                        columns.append(k)
            wrapper = {
                "columns": columns,
                "data": [[r.get(c) for c in columns] for r in rows],
            }
        else:
            wrapper = {"data": rows}
    blob, _meta = TableHandler().serialize(wrapper)
    return _json.loads(blob.decode("utf-8"))


def _serialize_pointcloud(data: Any, values: Any = None) -> tuple[bytes, dict[str, Any]]:
    from ._sdk.handlers.pointcloud import PointCloudHandler

    return PointCloudHandler().serialize(data, values=values)


def _serialize_mesh(payload: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    from ._sdk.handlers.mesh import MeshHandler

    return MeshHandler().serialize(payload)


def _serialize_volume(grid: Any, spacing: Any = None, origin: Any = None) -> tuple[bytes, dict[str, Any]]:
    from ._sdk.handlers.volume import VolumeHandler

    return VolumeHandler().serialize(grid, spacing=spacing, origin=origin)


def _serialize_boxes3d(payload: dict[str, Any], kind: str = "boxes") -> tuple[bytes, dict[str, Any]]:
    from ._sdk.handlers.boxes3d import Boxes3DHandler

    return Boxes3DHandler().serialize(payload, kind=kind)


register_resolvers(
    table_raw=_table_json_from_raw,
    serialize_pointcloud=_serialize_pointcloud,
    serialize_mesh=_serialize_mesh,
    serialize_volume=_serialize_volume,
    serialize_boxes3d=_serialize_boxes3d,
)
