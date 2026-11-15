"""Shared Ninja I/O schemas."""
from typing import Any

from django.core.exceptions import FieldDoesNotExist
from ninja import Schema
from pydantic import ConfigDict


class ErrorOut(Schema):
    """Body of every error response (architecture.md §3): `{detail, field?}`."""

    detail: str
    field: str | None = None


class OkOut(Schema):
    """Body of write endpoints that have nothing else to return."""

    ok: bool = True


def _match_model_columns(schema: dict[str, Any], cls: type) -> None:
    """Make an output schema's JSON Schema match the database columns.

    Ninja builds ModelSchema fields for *input* use: `blank=True` and the primary key
    become optional/nullable, and choices become plain strings. For responses that is
    wrong, and the generated TypeScript types (architecture.md §3 "Typed client") would
    say `id?: number | null` and `role: string`. This hook, run by pydantic when the JSON
    schema is built, fixes the generated (Meta.fields) properties:
    - a column with `null=False` is never null in a response;
    - a column with `choices` becomes an `enum` of its stored values;
    - every property is required, because a response always contains every field.

    Args:
        schema: The JSON schema pydantic built for `cls`; changed in place.
        cls: The output schema class; `cls.Meta.model` / `cls.Meta.fields` name the columns.
    """
    properties: dict[str, Any] = schema.get("properties", {})
    meta = getattr(cls, "Meta", None)
    model = getattr(meta, "model", None)
    for name in getattr(meta, "fields", None) or []:
        prop = properties.get(name)
        if prop is None or model is None:
            continue
        try:
            column = model._meta.get_field(name)
        except FieldDoesNotExist:
            continue
        if not column.null and "anyOf" in prop:
            branches = [b for b in prop.pop("anyOf") if b.get("type") != "null"]
            if len(branches) == 1:
                prop.update(branches[0])
            else:
                prop["anyOf"] = branches
        if column.choices:
            prop.pop("maxLength", None)
            prop["enum"] = [value for value, _label in column.flatchoices]
    schema["required"] = list(properties)


OUT_MODEL_CONFIG = ConfigDict(json_schema_extra=_match_model_columns)
"""Set as `model_config` on every response `ModelSchema` (output only; input forms stay `Schema`s).

A config constant, not a shared base class: Ninja only generates model fields for classes
whose *direct* base is `ModelSchema` (ninja/orm/metaclass.py), so a common subclass would
silently produce schemas without the model fields.
"""
