"""Ninja I/O schemas for admin moderation (US-17/18/21)."""
from typing import Any

from ninja import ModelSchema, Schema

from accounts.models import OrganizerRequest, User
from common.schemas import OUT_MODEL_CONFIG
from moderation.models import AuditLog


class RequestingUserOut(ModelSchema):
    """Account details an admin sees next to a request (US-21)."""

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined"]


class OrganizerRequestAdminOut(ModelSchema):
    """One organizer request in the admin queue (US-21)."""

    decided_by_id: int | None
    user: RequestingUserOut

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = OrganizerRequest
        fields = ["id", "status", "created_at", "decided_at"]


class OrganizerRequestFilter(Schema):
    """Query string of the admin queue; default shows what still needs a decision."""

    status: OrganizerRequest.Status = OrganizerRequest.Status.PENDING


class AuditLogOut(ModelSchema):
    """One audit entry: who, when, what changed and why (US-17/18/21).

    `actor_username` is an annotation from `list_audit_log`.
    """

    actor_id: int
    actor_username: str
    changes: list[dict[str, Any]]

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = AuditLog
        fields = ["id", "action", "target_type", "target_id", "reason", "created_at"]
