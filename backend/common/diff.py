"""Change-diff util shared by notifications and the audit log (architecture.md §4).

One function produces the `[{"field", "old", "new"}]` list, so the inbox message an
attendee reads (US-16/22) and the admin audit entry (US-17) always agree.
"""
from collections.abc import Mapping
from typing import Any, TypedDict


class FieldChange(TypedDict):
    """One changed field, values serialised to JSON-safe display form."""

    field: str
    old: Any
    new: Any


def diff_fields(*, old: Mapping[str, Any], new: Mapping[str, Any]) -> list[FieldChange]:
    """Compare two serialised snapshots of the same object.

    Args:
        old: Field values before the change (JSON-safe: ISO datetimes, str decimals).
        new: Field values after the change, same keys as `old`.

    Returns:
        One `FieldChange` per key whose value differs, in `old`'s key order;
        an empty list when nothing changed.
    """
    return [
        FieldChange(field=key, old=value, new=new.get(key))
        for key, value in old.items()
        if new.get(key) != value
    ]
