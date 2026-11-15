"""Writes for admin moderation: the audit trail and organizer-request decisions.

A decision changes three tables (OrganizerRequest/User, Notification, AuditLog), so it
lives here, in one `transaction.atomic()`, rather than in any single owning app.
"""
from accounts.models import OrganizerRequest, User
from common.diff import FieldChange
from moderation.models import AuditLog


def record_audit(
    *,
    actor: User,
    action: str,
    target_type: str,
    target_id: int,
    changes: list[FieldChange] | None = None,
    reason: str = "",
) -> AuditLog:
    """Append one entry to the audit trail (append-only, US-17/18/21).

    Called inside the caller's transaction, so the entry exists exactly when the action
    was committed.

    Args:
        actor: The admin who acted.
        action: An `AuditLog.Action` value.
        target_type: "event" or "organizer_request".
        target_id: Primary key of the target.
        changes: Old/new values for edits; None stores `[]`.
        reason: Free text, e.g. the cancel reason.

    Returns:
        The new entry.
    """
    raise NotImplementedError


def approve_organizer_request(*, request_id: int, admin: User) -> OrganizerRequest:
    """Approve a pending request (US-21).

    Sets the user's role to organizer, marks the request decided, notifies the user
    (`inbox.services.notify_organizer_request_decided`) and records the audit entry.

    Args:
        request_id: Request primary key; row locked with `select_for_update()`.
        admin: The acting admin.

    Returns:
        The approved request.

    Raises:
        PermissionDeniedError: (403) `admin` is not an admin.
        NotFoundError: (404) no such request.
        ConflictError: (409) the request was already decided.
    """
    raise NotImplementedError


def reject_organizer_request(*, request_id: int, admin: User) -> OrganizerRequest:
    """Reject a pending request; the user stays an attendee and may ask again (US-20/21).

    Marks the request decided, notifies the user and records the audit entry.

    Args:
        request_id: Request primary key; row locked with `select_for_update()`.
        admin: The acting admin.

    Returns:
        The rejected request.

    Raises:
        PermissionDeniedError: (403) `admin` is not an admin.
        NotFoundError: (404) no such request.
        ConflictError: (409) the request was already decided.
    """
    raise NotImplementedError
