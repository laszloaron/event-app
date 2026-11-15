"""Writes for the inbox (US-22).

The `notify_*` functions are called by events/moderation services inside their own
`transaction.atomic()` block and use `bulk_create`, so a message exists exactly when
the change that caused it was committed (architecture.md §2).
"""
from typing import Any

from accounts.models import OrganizerRequest, User
from common.diff import FieldChange
from common.errors import NotFoundError
from events.models import Event
from inbox.models import Notification


def _notify_attendees(*, event: Event, kind: str, payload: dict[str, Any]) -> list[Notification]:
    """Create one message of `kind` for every user who RSVP'd to `event` (one INSERT).

    Shared by `notify_event_changed` and `notify_event_cancelled` (no duplicated code).

    Args:
        event: The event the message is about.
        kind: A `Notification.Kind` value.
        payload: Same JSON payload for every recipient.

    Returns:
        The created messages.
    """
    attendee_ids = event.rsvps.values_list("user_id", flat=True)
    return Notification.objects.bulk_create(
        [
            Notification(recipient_id=user_id, kind=kind, event=event, payload=payload)
            for user_id in attendee_ids
        ]
    )


def mark_read(*, notification_id: int, user: User) -> Notification:
    """Mark one message as read when it is opened (US-22). Idempotent.

    Args:
        notification_id: Notification primary key.
        user: The current user; must be the recipient.

    Returns:
        The message with `is_read=True`.

    Raises:
        NotFoundError: (404) no such message, or it belongs to someone else
            (404, not 403, so ids of other users' messages are not revealed).
    """
    notification = (
        Notification.objects.select_related("event")
        .filter(pk=notification_id, recipient=user)
        .first()
    )
    if notification is None:
        raise NotFoundError("Message not found")
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=["is_read"])
    return notification


def notify_event_changed(*, event: Event, changes: list[FieldChange]) -> list[Notification]:
    """Tell every RSVP'd attendee what changed, as old → new per field (US-16/22).

    Args:
        event: The edited event.
        changes: Output of `common.diff.diff_fields`; nothing is sent when empty.

    Returns:
        The created messages (kind `event_changed`), one per attendee.
    """
    if not changes:
        return []
    return _notify_attendees(
        event=event, kind=Notification.Kind.EVENT_CHANGED, payload={"changes": changes}
    )


def notify_event_cancelled(*, event: Event) -> list[Notification]:
    """Tell every RSVP'd attendee that the event was cancelled (US-10/18/22).

    Args:
        event: The cancelled event.

    Returns:
        The created messages (kind `event_cancelled`), one per attendee.
    """
    return _notify_attendees(
        event=event, kind=Notification.Kind.EVENT_CANCELLED, payload={"reason": event.cancel_reason}
    )


def notify_organizer_of_admin_edit(*, event: Event, changes: list[FieldChange]) -> Notification:
    """Tell the organizer what an admin changed on their event (US-17/22).

    Args:
        event: The edited event.
        changes: The admin's changes.

    Returns:
        The created message (kind `admin_edited`).
    """
    return Notification.objects.create(
        recipient_id=event.organizer_id,
        kind=Notification.Kind.ADMIN_EDITED,
        event=event,
        payload={"changes": changes},
    )


def notify_organizer_of_admin_cancel(*, event: Event, reason: str) -> Notification:
    """Tell the organizer that an admin cancelled their event, with the reason (US-18/22).

    Args:
        event: The cancelled event.
        reason: The admin's reason.

    Returns:
        The created message (kind `admin_cancelled`).
    """
    return Notification.objects.create(
        recipient_id=event.organizer_id,
        kind=Notification.Kind.ADMIN_CANCELLED,
        event=event,
        payload={"reason": reason},
    )


def notify_organizer_request_decided(*, request: OrganizerRequest) -> Notification:
    """Tell the requester that an admin approved or rejected their request (US-20/21/22).

    Args:
        request: The decided request (status approved or rejected).

    Returns:
        The created message (kind `organizer_approved` or `organizer_rejected`).

    Raises:
        ValueError: the request is still pending (programming error, not user input).
    """
    kinds = {
        OrganizerRequest.Status.APPROVED: Notification.Kind.ORGANIZER_APPROVED,
        OrganizerRequest.Status.REJECTED: Notification.Kind.ORGANIZER_REJECTED,
    }
    if request.status not in kinds:
        raise ValueError(f"Organizer request {request.pk} is not decided yet")
    return Notification.objects.create(recipient_id=request.user_id, kind=kinds[request.status])
