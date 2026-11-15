"""Read-only queries for admin moderation."""
from django.db.models import QuerySet

from accounts.models import OrganizerRequest
from moderation.models import AuditLog


def list_organizer_requests(*, status: str) -> QuerySet[OrganizerRequest]:
    """Return organizer requests with the given status, oldest first, user selected (US-21).

    Args:
        status: An `OrganizerRequest.Status` value.
    """
    raise NotImplementedError


def list_audit_log() -> QuerySet[AuditLog]:
    """Return every audit entry, newest first, with `actor` selected (US-17/18/21)."""
    raise NotImplementedError
