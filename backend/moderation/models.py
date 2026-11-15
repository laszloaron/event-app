"""Moderation table: the admin audit trail (US-17/18/21, architecture.md §2)."""
from django.conf import settings
from django.db import models

from common.models import CreatedAtModel


class AuditLog(CreatedAtModel):
    """One admin action, with who, when, what changed and why.

    Append-only: services only ever create rows, never update or delete them.
    `actor` uses PROTECT so the trail cannot lose the admin who acted.
    """

    class Action(models.TextChoices):
        EVENT_EDIT = "event_edit", "Event edited"
        EVENT_CANCEL = "event_cancel", "Event cancelled"
        ORGANIZER_APPROVE = "organizer_approve", "Organizer request approved"
        ORGANIZER_REJECT = "organizer_reject", "Organizer request rejected"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="audit_entries"
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    target_type = models.CharField(max_length=64)  # e.g. "event", "organizer_request"
    target_id = models.PositiveBigIntegerField()
    changes = models.JSONField(default=list, blank=True)  # [{"field", "old", "new"}]; [] if none
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AuditLog({self.action} {self.target_type}#{self.target_id})"
