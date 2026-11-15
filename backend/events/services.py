"""Writes and business rules for events: create/edit/publish/cancel, RSVP and paid marks.

Every function runs inside `transaction.atomic()`. Notifications and audit rows are written
in the same transaction as the change (architecture.md §2), by calling
`inbox.services.notify_*` and `moderation.services.record_audit`.
"""
from datetime import datetime
from decimal import Decimal
from typing import TypedDict

from accounts.models import User
from events.models import RSVP, Event, PaidMark


class SocialLink(TypedDict):
    """One organizer social link, as stored in `Event.social_links`."""

    label: str
    url: str


class EventFields(TypedDict, total=False):
    """Form values passed from views to services (US-09 table).

    `total=False`: on PATCH only the keys the client sent are present. A value of None
    clears the field. `sport` is a slug; `lat`/`lng` become `Event.location`.
    """

    title: str | None
    sport: str | None
    start_at: datetime | None
    end_at: datetime | None
    venue_name: str | None
    venue_address: str | None
    lat: float | None
    lng: float | None
    timezone: str | None
    price_amount: Decimal | None
    price_currency: str | None
    description: str | None
    sport_explainer: str | None
    ticket_url: str | None
    registration_url: str | None
    capacity: int | None
    social_links: list[SocialLink] | None


# --- Validation (US-09 "Saving rules") ------------------------------------------------


def validate_event_format(*, event: Event) -> None:
    """Check cross-field format rules; they block both "Save as draft" and "Publish".

    Rules: `end_at > start_at`; amount and currency come together; a ticket link only
    with a price; `lat` and `lng` come together; `sport` slug exists; `timezone` is a
    valid IANA name. Single-field rules are already enforced by `EventFieldsIn`.

    Args:
        event: Unsaved event with the new values applied.

    Raises:
        FieldValidationError: (422, field=<form field>) the first broken rule.
    """
    raise NotImplementedError


def validate_event_publishable(*, event: Event, now: datetime) -> None:
    """Check publish-only rules (US-09): every required field set and start in the future.

    Required: title, sport, start_at, end_at, venue_name, location, price (Free or
    amount+currency).

    Args:
        event: Event with the final values applied.
        now: Current time.

    Raises:
        FieldValidationError: (422, field=<form field>) a required field is missing,
            or (field="start_at") the start is not in the future.
    """
    raise NotImplementedError


# --- Organizing -----------------------------------------------------------------------


def create_event(*, organizer: User, fields: EventFields, publish: bool) -> Event:
    """Create a draft, or create and publish in one step (US-09/25).

    Args:
        organizer: The acting user; must have role organizer.
        fields: Form values.
        publish: True for "Publish", False for "Save as draft".

    Returns:
        The saved event (`status` draft or published, `published_at` set on publish).

    Raises:
        PermissionDeniedError: (403) the user is not an organizer (US-09/19).
        FieldValidationError: (422) a format rule fails, or on publish a required field
            is missing / start is in the past.
    """
    raise NotImplementedError


def update_event(*, event_id: int, actor: User, fields: EventFields, now: datetime) -> Event:
    """Edit a draft or a published event (US-16/17/25).

    For a published event: diff old/new with `common.diff.diff_fields`; if anything
    changed, notify every RSVP'd attendee (US-16/22). If the actor is an admin, also
    notify the organizer and write an `AuditLog` entry with the changes (US-17).
    Published events must still pass `validate_event_publishable`, except the
    "start in the future" rule for an event that has already started.

    Args:
        event_id: Event primary key; the row is locked with `select_for_update()`.
        actor: Organizer (owner) or admin. Admins may not edit drafts (US-25).
        fields: Only the fields to change.
        now: Current time.

    Returns:
        The updated event.

    Raises:
        NotFoundError: (404) no such event, or a draft not owned by the actor.
        PermissionDeniedError: (403) the actor is neither owner nor admin.
        BusinessRuleError: (400) the event is cancelled or has ended (US-16).
        FieldValidationError: (422) a validation rule fails, or (field="capacity") the new
            capacity is below the current number of RSVPs (US-16).
    """
    raise NotImplementedError


def publish_event(*, event_id: int, actor: User, now: datetime) -> Event:
    """Publish a draft in place (US-25 → US-09).

    Args:
        event_id: Event primary key.
        actor: Must be the draft's organizer.
        now: Current time; sets `published_at`.

    Returns:
        The published event.

    Raises:
        NotFoundError: (404) no such event, or a draft not owned by the actor.
        BusinessRuleError: (400) the event is not a draft.
        FieldValidationError: (422) a required field is missing or start is in the past.
    """
    raise NotImplementedError


def delete_draft(*, event_id: int, actor: User) -> None:
    """Delete one of the organizer's drafts (US-25). Published events are cancelled, never deleted.

    Args:
        event_id: Event primary key.
        actor: Must be the draft's organizer.

    Raises:
        NotFoundError: (404) no such event, or a draft not owned by the actor.
        BusinessRuleError: (400) the event is not a draft.
    """
    raise NotImplementedError


def cancel_event(*, event_id: int, actor: User, reason: str, now: datetime) -> Event:
    """Cancel a published event (US-10/18).

    Sets status cancelled, `cancel_reason`, `cancelled_by`; RSVPs are kept so the event
    stays in "My events" with a tag (US-07). Notifies every RSVP'd attendee. If the
    actor is an admin, also notifies the organizer with the reason and writes an
    `AuditLog` entry (US-18).

    Args:
        event_id: Event primary key; row locked with `select_for_update()`.
        actor: Organizer (owner) or admin.
        reason: Free text; required (non-blank) for admins.
        now: Current time.

    Returns:
        The cancelled event.

    Raises:
        NotFoundError: (404) no such event, or a draft.
        PermissionDeniedError: (403) the actor is neither owner nor admin.
        BusinessRuleError: (400) already cancelled or already ended.
        FieldValidationError: (422, field="reason") admin gave no reason.
    """
    raise NotImplementedError


# --- Attending ------------------------------------------------------------------------


def rsvp(*, event_id: int, user: User, now: datetime) -> RSVP:
    """Add the user's "I'm going" (US-06).

    Runs with `select_for_update()` on the event row so two last-seat RSVPs cannot both
    succeed (architecture.md §2 "Capacity race").

    Args:
        event_id: Event primary key.
        user: Attendee or organizer; never an admin.
        now: Current time.

    Returns:
        The new RSVP.

    Raises:
        NotFoundError: (404) no such event, or a draft.
        PermissionDeniedError: (403) the user is an admin (US-19).
        BusinessRuleError: (400) the event is cancelled or has ended.
        ConflictError: (409) already going, or (detail="Event is full") at capacity.
    """
    raise NotImplementedError


def cancel_rsvp(*, event_id: int, user: User) -> None:
    """Withdraw "I'm going" (US-06) or "Remove from my events" on a cancelled event (US-07).

    The user's `PaidMark` is kept (US-08).

    Args:
        event_id: Event primary key.
        user: The attendee.

    Raises:
        NotFoundError: (404) no such event, or the user has no RSVP for it.
        PermissionDeniedError: (403) the user is an admin (US-19).
    """
    raise NotImplementedError


def mark_paid(*, event_id: int, user: User, now: datetime) -> PaidMark:
    """Tick "I have paid" (US-08); also RSVPs via `rsvp` if the user is not going yet.

    Idempotent: ticking twice returns the existing mark.

    Args:
        event_id: Event primary key.
        user: The attendee.
        now: Current time.

    Returns:
        The user's paid mark.

    Raises:
        NotFoundError: (404) no such event, or a draft.
        PermissionDeniedError: (403) the user is an admin (US-19).
        BusinessRuleError: (400) the event is free, cancelled or has ended.
        ConflictError: (409, detail="Event is full") the implied RSVP does not fit.
    """
    raise NotImplementedError


def unmark_paid(*, event_id: int, user: User) -> None:
    """Untick "I have paid" (US-08). Leaves the RSVP unchanged. Idempotent.

    Args:
        event_id: Event primary key.
        user: The attendee.

    Raises:
        NotFoundError: (404) no such event.
        PermissionDeniedError: (403) the user is an admin (US-19).
    """
    raise NotImplementedError
