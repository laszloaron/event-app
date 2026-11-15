"""Writes for admin moderation: the audit trail and organizer-request decisions.

A decision changes three tables (OrganizerRequest/User, Notification, AuditLog), so it
lives here, in one `transaction.atomic()`, rather than in any single owning app.
"""
import logging

from django.db import transaction
from django.utils import timezone

from accounts.models import OrganizerRequest, User
from common.diff import FieldChange
from common.errors import ConflictError, NotFoundError, PermissionDeniedError
from inbox.services import notify_organizer_request_decided
from moderation.models import AuditLog

logger = logging.getLogger(__name__)


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
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        changes=list(changes or []),
        reason=reason,
    )


def _decide(*, request_id: int, admin: User, approve: bool) -> OrganizerRequest:
    """Approve or reject a pending organizer request in one transaction (US-21).

    Shared by `approve_organizer_request` and `reject_organizer_request` (no duplicated
    code): checks the admin, locks the request, records the decision, changes the role on
    approval, notifies the requester and writes the audit entry.

    Args:
        request_id: Request primary key.
        admin: The acting admin.
        approve: True to approve, False to reject.

    Returns:
        The decided request.

    Raises:
        PermissionDeniedError: (403) `admin` is not an admin.
        NotFoundError: (404) no such request.
        ConflictError: (409) the request was already decided.
    """
    if not admin.is_admin_role:
        raise PermissionDeniedError("Only admins can decide organizer requests")
    with transaction.atomic():
        request = (
            OrganizerRequest.objects.select_for_update()
            .select_related("user")
            .filter(pk=request_id)
            .first()
        )
        if request is None:
            raise NotFoundError("Organizer request not found")
        if request.status != OrganizerRequest.Status.PENDING:
            raise ConflictError("This request was already decided")
        request.status = (
            OrganizerRequest.Status.APPROVED if approve else OrganizerRequest.Status.REJECTED
        )
        request.decided_by = admin
        request.decided_at = timezone.now()
        request.save(update_fields=["status", "decided_by", "decided_at"])
        if approve:
            request.user.role = User.Role.ORGANIZER
            request.user.save(update_fields=["role"])
        notify_organizer_request_decided(request=request)
        record_audit(
            actor=admin,
            action=AuditLog.Action.ORGANIZER_APPROVE if approve else AuditLog.Action.ORGANIZER_REJECT,
            target_type="organizer_request",
            target_id=request.pk,
        )
    logger.info("Organizer request %s %s by admin %s", request.pk, request.status, admin.pk)
    return request


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
    return _decide(request_id=request_id, admin=admin, approve=True)


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
    return _decide(request_id=request_id, admin=admin, approve=False)
