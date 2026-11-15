"""Inbox table: in-app notifications (US-22, architecture.md §2)."""
from django.conf import settings
from django.db import models

from common.models import CreatedAtModel


class Notification(CreatedAtModel):
    """A message in a user's inbox.

    Services create these with `bulk_create` in the same transaction as the change
    that caused them, so a notification is never lost or sent for a rolled-back change.
    """

    class Kind(models.TextChoices):
        EVENT_CANCELLED = "event_cancelled", "Event cancelled"
        EVENT_CHANGED = "event_changed", "Event changed"
        ADMIN_EDITED = "admin_edited", "Admin edited your event"
        ADMIN_CANCELLED = "admin_cancelled", "Admin cancelled your event"
        ORGANIZER_APPROVED = "organizer_approved", "Organizer request approved"
        ORGANIZER_REJECTED = "organizer_rejected", "Organizer request rejected"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    event = models.ForeignKey(
        "events.Event",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    payload = models.JSONField(default=dict, blank=True)  # e.g. {"changes": [...], "reason": ...}
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Unread badge and inbox list both filter by recipient (+ is_read).
            models.Index(fields=["recipient", "is_read"], name="notif_recipient_read_idx"),
        ]

    def __str__(self) -> str:
        return f"Notification({self.kind} -> {self.recipient_id})"
