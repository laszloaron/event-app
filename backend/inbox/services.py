"""Writes for the inbox (US-22).

The `notify_*` functions are called by events/moderation services inside their own
`transaction.atomic()` block and use `bulk_create`, so a message exists exactly when
the change that caused it was committed (architecture.md §2).
"""
from accounts.models import OrganizerRequest, User
from common.diff import FieldChange
from events.models import Event
from inbox.models import Notification


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
    raise NotImplementedError


def notify_event_changed(*, event: Event, changes: list[FieldChange]) -> list[Notification]:
    """Tell every RSVP'd attendee what changed, as old → new per field (US-16/22).

    Args:
        event: The edited event.
        changes: Output of `common.diff.diff_fields`; nothing is sent when empty.

    Returns:
        The created messages (kind `event_changed`), one per attendee.
    """
    raise NotImplementedError


def notify_event_cancelled(*, event: Event) -> list[Notification]:
    """Tell every RSVP'd attendee that the event was cancelled (US-10/18/22).

    Args:
        event: The cancelled event.

    Returns:
        The created messages (kind `event_cancelled`), one per attendee.
    """
    raise NotImplementedError


def notify_organizer_of_admin_edit(*, event: Event, changes: list[FieldChange]) -> Notification:
    """Tell the organizer what an admin changed on their event (US-17/22).

    Args:
        event: The edited event.
        changes: The admin's changes.

    Returns:
        The created message (kind `admin_edited`).
    """
    raise NotImplementedError


def notify_organizer_of_admin_cancel(*, event: Event, reason: str) -> Notification:
    """Tell the organizer that an admin cancelled their event, with the reason (US-18/22).

    Args:
        event: The cancelled event.
        reason: The admin's reason.

    Returns:
        The created message (kind `admin_cancelled`).
    """
    raise NotImplementedError


def notify_organizer_request_decided(*, request: OrganizerRequest) -> Notification:
    """Tell the requester that an admin approved or rejected their request (US-20/21/22).

    Args:
        request: The decided request (status approved or rejected).

    Returns:
        The created message (kind `organizer_approved` or `organizer_rejected`).

    Raises:
        ValueError: the request is still pending (programming error, not user input).
    """
    raise NotImplementedError
