"""Ninja I/O schemas for the in-app inbox (US-22)."""
from typing import Any

from ninja import ModelSchema, Schema

from common.schemas import OUT_MODEL_CONFIG
from inbox.models import Notification


class NotificationOut(ModelSchema):
    """One inbox message. `event_id` links to the event card (US-11/22).

    `payload` shape by kind: `event_changed`/`admin_edited` → `{"changes": [{field, old, new}]}`;
    `event_cancelled`/`admin_cancelled` → `{"reason": str}`; organizer decisions → `{}`.
    """

    event_id: int | None
    event_title: str | None
    payload: dict[str, Any]

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = Notification
        fields = ["id", "kind", "is_read", "created_at"]

    @staticmethod
    def resolve_event_title(obj: Notification) -> str | None:
        """Title of the linked event (selected by `list_notifications`), or None."""
        raise NotImplementedError


class UnreadCountOut(Schema):
    """Inbox badge (US-22). Plain schema: a count, not a model row."""

    count: int
