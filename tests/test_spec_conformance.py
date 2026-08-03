"""Python ↔ committed-schema conformance for the plot-descriptor pydantic models.

`src/cairn_plot/spec.py`'s pydantic models MIRROR the authoritative TS
`PlotDescriptor` (from which `schema/cairn-plot-spec.schema.json` is generated).
This test keeps them honest field-for-field against that committed schema:

  - field parity      — every model's fields == the schema definition's properties
  - required parity   — pydantic required fields == the schema `required` list
  - additionalProperties — every `_Strict` model maps to `additionalProperties:false`
  - enum parity       — every `Literal` field's values == the schema enum/const

so a field renamed / added / dropped, or an enum widened/narrowed, on either the
Python side or the TS→schema side fails here. (The TS↔schema half is guarded by
`ui/scripts/check-plot-spec-schema.mjs`; this is the schema↔Python half.)
"""
from __future__ import annotations

import json
import typing
from pathlib import Path
from typing import Any, Literal, Union, get_args, get_origin

import pytest

from cairn_plot import spec

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schema" / "cairn-plot-spec.schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text())
DEFS = SCHEMA["definitions"]

# Pydantic model -> schema `definitions` key (the object-shaped nodes).
MODEL_TO_DEF = {
    spec.PlotDescriptorSpec: "PlotDescriptor",
    spec.PlotLeafSpec: "PlotLeafNode",
    spec.GridSpec: "GridNode",
    spec.CompareSpec: "CompareNode",
    spec.SharedPropsSpec: "SharedProps",
}

# DataSpec discriminated-union branches, matched by their `kind` const.
DATASPEC_MODELS = {
    "inline": spec.InlineDataSpec,
    "image": spec.ImageDataSpec,
    "url": spec.UrlDataSpec,
    "npz": spec.NpzDataSpec,
    "imghdr": spec.ImgHdrDataSpec,
}


def _dataspec_branches() -> dict[str, dict[str, Any]]:
    """The schema's DataSpec anyOf branches keyed by their `kind` const."""
    out: dict[str, dict[str, Any]] = {}
    for branch in DEFS["DataSpec"]["anyOf"]:
        const = branch["properties"]["kind"]["const"]
        out[const] = branch
    return out


def _pydantic_field_names(model: type) -> set[str]:
    return set(model.model_fields.keys())


def _pydantic_required(model: type) -> set[str]:
    return {name for name, f in model.model_fields.items() if f.is_required()}


def _literal_values(annotation: Any) -> set[Any] | None:
    """The `Literal` value set for a field annotation (unwrapping Optional /
    Union with None), or None when the field is not a Literal."""
    origin = get_origin(annotation)
    if origin is Literal:
        return set(get_args(annotation))
    if origin is Union or origin is typing.Union:
        for arg in get_args(annotation):
            if arg is type(None):
                continue
            vals = _literal_values(arg)
            if vals is not None:
                return vals
    return None


def _schema_enum_values(prop: dict[str, Any]) -> set[Any] | None:
    if "const" in prop:
        return {prop["const"]}
    if "enum" in prop:
        return set(prop["enum"])
    return None


# --- object-shaped model definitions --------------------------------------


ALL_CASES = list(MODEL_TO_DEF.items())


@pytest.mark.parametrize("model,def_name", ALL_CASES)
def test_field_parity(model: type, def_name: str) -> None:
    schema_props = set(DEFS[def_name].get("properties", {}).keys())
    assert _pydantic_field_names(model) == schema_props, (
        f"{model.__name__} fields != schema {def_name} properties"
    )


@pytest.mark.parametrize("model,def_name", ALL_CASES)
def test_required_parity(model: type, def_name: str) -> None:
    schema_required = set(DEFS[def_name].get("required", []))
    assert _pydantic_required(model) == schema_required, (
        f"{model.__name__} required != schema {def_name} required"
    )


@pytest.mark.parametrize("model,def_name", ALL_CASES)
def test_additional_properties_false(model: type, def_name: str) -> None:
    # Every mapped model extends `_Strict` (extra="forbid").
    assert model.model_config.get("extra") == "forbid"
    assert DEFS[def_name].get("additionalProperties") is False, (
        f"schema {def_name} must be additionalProperties:false"
    )


@pytest.mark.parametrize("model,def_name", ALL_CASES)
def test_enum_parity(model: type, def_name: str) -> None:
    props = DEFS[def_name].get("properties", {})
    for name, field in model.model_fields.items():
        values = _literal_values(field.annotation)
        if values is None:
            continue
        schema_values = _schema_enum_values(props.get(name, {}))
        assert schema_values is not None, (
            f"{model.__name__}.{name} is a Literal but schema {def_name}.{name} "
            "has no const/enum"
        )
        assert values == schema_values, (
            f"{model.__name__}.{name} enum {values} != schema {schema_values}"
        )


# --- DataSpec union branches ----------------------------------------------


def test_dataspec_kinds_parity() -> None:
    schema_kinds = set(_dataspec_branches().keys())
    assert set(DATASPEC_MODELS.keys()) == schema_kinds


@pytest.mark.parametrize("kind,model", DATASPEC_MODELS.items())
def test_dataspec_field_parity(kind: str, model: type) -> None:
    branch = _dataspec_branches()[kind]
    assert _pydantic_field_names(model) == set(branch.get("properties", {}).keys())


@pytest.mark.parametrize("kind,model", DATASPEC_MODELS.items())
def test_dataspec_required_parity(kind: str, model: type) -> None:
    branch = _dataspec_branches()[kind]
    assert _pydantic_required(model) == set(branch.get("required", []))


@pytest.mark.parametrize("kind,model", DATASPEC_MODELS.items())
def test_dataspec_additional_properties_false(kind: str, model: type) -> None:
    branch = _dataspec_branches()[kind]
    assert model.model_config.get("extra") == "forbid"
    assert branch.get("additionalProperties") is False


@pytest.mark.parametrize("kind,model", DATASPEC_MODELS.items())
def test_dataspec_enum_parity(kind: str, model: type) -> None:
    branch = _dataspec_branches()[kind]
    props = branch.get("properties", {})
    for name, field in model.model_fields.items():
        values = _literal_values(field.annotation)
        if values is None:
            continue
        schema_values = _schema_enum_values(props.get(name, {}))
        assert schema_values is not None, (
            f"{model.__name__}.{name} is a Literal but schema branch {kind}.{name} "
            "has no const/enum"
        )
        assert values == schema_values, (
            f"{model.__name__}.{name} enum {values} != schema {schema_values}"
        )
