"""Account tables: the custom user and organizer-role requests (architecture.md §2)."""
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q

from common.models import CreatedAtModel


class User(AbstractUser):
    """Custom user, created from day one because swapping the user model later is painful.

    Roles are mutually exclusive tiers (organizer includes attendee rights; admin
    excludes both, US-19), so a single enum is simpler to check than groups.
    """

    class Role(models.TextChoices):
        ATTENDEE = "attendee", "Attendee"
        ORGANIZER = "organizer", "Organizer"
        ADMIN = "admin", "Admin"

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.ATTENDEE)

    @property
    def is_organizer(self) -> bool:
        """Return True if the user may publish events."""
        return self.role == self.Role.ORGANIZER

    @property
    def is_admin_role(self) -> bool:
        """Return True if the user is an EventMap admin (not Django's `is_staff`)."""
        return self.role == self.Role.ADMIN


class OrganizerRequest(CreatedAtModel):
    """An attendee's request to become an organizer (US-20), decided by an admin (US-21)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organizer_requests"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="decided_organizer_requests",
    )
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # US-20: at most one open request per user; history of decided ones is kept.
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(status="pending"),
                name="one_pending_request_per_user",
            ),
        ]

    def __str__(self) -> str:
        return f"OrganizerRequest({self.user_id}, {self.status})"
