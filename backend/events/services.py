"""Writes and business rules for events: create/edit/publish/cancel, RSVP and paid marks.

Every function runs inside `transaction.atomic()`. Notifications and audit rows are written
in the same transaction as the change (architecture.md §2), by calling
`inbox.services.notify_*` and `moderation.services.record_audit`.
"""
import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, TypedDict
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.gis.geos import Point
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from common.diff import diff_fields
from common.errors import (
    BusinessRuleError,
    ConflictError,
    FieldValidationError,
    NotFoundError,
    PermissionDeniedError,
)
from common.permissions import require_owner, require_owner_or_admin
from events.models import RSVP, Event, PaidMark, Sport, default_event_timezone
from inbox.services import (
    notify_event_cancelled,
    notify_event_changed,
    notify_organizer_of_admin_cancel,
    notify_organizer_of_admin_edit,
)
from moderation.models import AuditLog
from moderation.services import record_audit

logger = logging.getLogger(__name__)


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


# --- Private helpers (shared by several services; no duplicated code) ------------------

_TEXT_FIELDS = frozenset(
    {"title", "venue_name", "venue_address", "description", "sport_explainer", "price_currency"}
)
_URL_FIELDS = frozenset({"ticket_url", "registration_url"})


def _lock_event(*, event_id: int, actor: User) -> Event:
    """Lock one event row for the rest of the transaction (`select_for_update`).

    Args:
        event_id: Event primary key.
        actor: The acting user; a draft is only visible to its organizer (US-25).

    Returns:
        The locked event.

    Raises:
        NotFoundError: (404) no such event, or a draft the actor does not own.
    """
    event = Event.objects.select_for_update().filter(pk=event_id).first()
    if event is None or (event.status == Event.Status.DRAFT and event.organizer_id != actor.pk):
        raise NotFoundError("Event not found")
    return event


def _apply_fields(*, event: Event, fields: EventFields) -> None:
    """Copy form values onto the event (create and edit share this mapping).

    `None` clears a field: "" for text/URL columns (never NULL, backend/AGENTS.md), the
    default time zone for `timezone`. `sport` is a slug, `lat`/`lng` become the PointField.

    Args:
        event: The event to change in memory (not saved).
        fields: Only the fields to set.

    Raises:
        FieldValidationError: (422, field="sport") unknown slug; (422, field="lat"/"lng")
            only one coordinate of the venue pin is set.
    """
    for name, value in fields.items():
        if name in ("lat", "lng"):
            continue
        if name == "sport":
            sport = None if value is None else Sport.objects.filter(slug=value).first()
            if value is not None and sport is None:
                raise FieldValidationError("Unknown sport", field="sport")
            event.sport = sport
        elif name in _TEXT_FIELDS or name in _URL_FIELDS:
            setattr(event, name, "" if value is None else str(value))
        elif name == "timezone":
            event.timezone = value or default_event_timezone()
        elif name == "social_links":
            event.social_links = [
                {"label": link["label"], "url": str(link["url"])} for link in value or []
            ]
        else:  # start_at, end_at, price_amount, capacity
            setattr(event, name, value)
    if "lat" in fields or "lng" in fields:
        current = event.location
        lat = fields.get("lat", current.y if current else None)
        lng = fields.get("lng", current.x if current else None)
        if lat is None and lng is None:
            event.location = None
        elif lat is None or lng is None:
            raise FieldValidationError(
                "Set the venue pin on the map", field="lat" if lat is None else "lng"
            )
        else:
            event.location = Point(lng, lat, srid=4326)


def _snapshot(*, event: Event) -> dict[str, Any]:
    """Return the editable fields as JSON-safe display values, for `diff_fields` (US-16/17).

    Values are normalised (UTC ISO times, 2-decimal amounts) so an unchanged value read
    back from the database never shows up as a change.

    Args:
        event: The event to describe.
    """
    start = event.start_at.astimezone(UTC).isoformat() if event.start_at else None
    end = event.end_at.astimezone(UTC).isoformat() if event.end_at else None
    location = event.location
    return {
        "title": event.title,
        "sport": event.sport.name if event.sport_id else None,
        "start_at": start,
        "end_at": end,
        "venue_name": event.venue_name,
        "venue_address": event.venue_address,
        "lat": location.y if location else None,
        "lng": location.x if location else None,
        "timezone": event.timezone,
        "price_amount": f"{event.price_amount:.2f}" if event.price_amount is not None else None,
        "price_currency": event.price_currency,
        "description": event.description,
        "sport_explainer": event.sport_explainer,
        "ticket_url": event.ticket_url,
        "registration_url": event.registration_url,
        "capacity": event.capacity,
        "social_links": event.social_links,
    }


# --- Validation (US-09 "Saving rules") ------------------------------------------------


def validate_event_format(*, event: Event) -> None:
    """Check cross-field format rules; they block both "Save as draft" and "Publish".

    Rules: `end_at > start_at`; amount and currency come together; a ticket link only
    with a price; `timezone` is a valid IANA name. Single-field rules are already
    enforced by `EventFieldsIn`; an unknown sport slug and a half-set pin are rejected
    while the form is mapped onto the event (`_apply_fields`).

    Args:
        event: Unsaved event with the new values applied.

    Raises:
        FieldValidationError: (422, field=<form field>) the first broken rule.
    """
    if event.start_at and event.end_at and event.end_at <= event.start_at:
        raise FieldValidationError("The end must be after the start", field="end_at")
    if event.price_amount is not None and not event.price_currency:
        raise FieldValidationError("Choose a currency for the price", field="price_currency")
    if event.price_amount is None and event.price_currency:
        raise FieldValidationError("Enter an amount, or choose Free", field="price_amount")
    if event.ticket_url and event.price_amount is None:
        raise FieldValidationError("A ticket link is only for paid events", field="ticket_url")
    try:
        ZoneInfo(event.timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise FieldValidationError("Unknown time zone", field="timezone") from exc


def validate_event_publishable(
    *, event: Event, now: datetime, require_future_start: bool = True
) -> None:
    """Check publish-only rules (US-09): every required field set and start in the future.

    Required: title, sport, start_at, end_at, venue_name, location, price (Free or
    amount+currency).

    Args:
        event: Event with the final values applied.
        now: Current time.
        require_future_start: False when editing a published event without moving its
            start, so an event that has already started stays editable (US-16).

    Raises:
        FieldValidationError: (422, field=<form field>) a required field is missing,
            or (field="start_at") the start is not in the future.
    """
    required = (
        ("title", event.title),
        ("sport", event.sport_id),
        ("start_at", event.start_at),
        ("end_at", event.end_at),
        ("venue_name", event.venue_name),
        ("lat", event.location),
    )
    for field, value in required:
        if value is None or value == "":
            raise FieldValidationError("This field is required to publish", field=field)
    if require_future_start and event.start_at <= now:
        raise FieldValidationError("The start must be in the future", field="start_at")


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
    if not organizer.is_organizer:
        raise PermissionDeniedError("Only organizers can create events")
    with transaction.atomic():
        event = Event(organizer=organizer)
        _apply_fields(event=event, fields=fields)
        validate_event_format(event=event)
        if publish:
            now = timezone.now()
            validate_event_publishable(event=event, now=now)
            event.status = Event.Status.PUBLISHED
            event.published_at = now
        event.save()
    logger.info("Event %s created (%s) by user %s", event.pk, event.status, organizer.pk)
    return event


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
    with transaction.atomic():
        event = _lock_event(event_id=event_id, actor=actor)
        require_owner_or_admin(actor, event)
        if event.status == Event.Status.CANCELLED or (
            event.end_at is not None and event.end_at <= now
        ):
            raise BusinessRuleError("A cancelled or ended event cannot be edited")
        before = _snapshot(event=event)
        original_start = event.start_at
        _apply_fields(event=event, fields=fields)
        validate_event_format(event=event)
        if event.status == Event.Status.PUBLISHED:
            validate_event_publishable(
                event=event, now=now, require_future_start=event.start_at != original_start
            )
        if event.capacity is not None:
            going = event.rsvps.count()
            if event.capacity < going:
                raise FieldValidationError(
                    f"Capacity cannot be lower than the {going} people already going",
                    field="capacity",
                )
        event.save()
        changes = diff_fields(old=before, new=_snapshot(event=event))
        if event.status == Event.Status.PUBLISHED and changes:
            notify_event_changed(event=event, changes=changes)
            if actor.is_admin_role:
                notify_organizer_of_admin_edit(event=event, changes=changes)
                record_audit(
                    actor=actor,
                    action=AuditLog.Action.EVENT_EDIT,
                    target_type="event",
                    target_id=event.pk,
                    changes=changes,
                )
    logger.info("Event %s edited by user %s (%d changes)", event.pk, actor.pk, len(changes))
    return event


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
    with transaction.atomic():
        event = _lock_event(event_id=event_id, actor=actor)
        require_owner(actor, event)
        if event.status != Event.Status.DRAFT:
            raise BusinessRuleError("Only drafts can be published")
        validate_event_format(event=event)
        validate_event_publishable(event=event, now=now)
        event.status = Event.Status.PUBLISHED
        event.published_at = now
        event.save(update_fields=["status", "published_at", "updated_at"])
    logger.info("Event %s published by user %s", event.pk, actor.pk)
    return event


def delete_draft(*, event_id: int, actor: User) -> None:
    """Delete one of the organizer's drafts (US-25). Published events are cancelled, never deleted.

    Args:
        event_id: Event primary key.
        actor: Must be the draft's organizer.

    Raises:
        NotFoundError: (404) no such event, or a draft not owned by the actor.
        BusinessRuleError: (400) the event is not a draft.
    """
    with transaction.atomic():
        event = _lock_event(event_id=event_id, actor=actor)
        require_owner(actor, event)
        if event.status != Event.Status.DRAFT:
            raise BusinessRuleError("Only drafts can be deleted; cancel a published event")
        event.delete()
    logger.info("Draft %s deleted by user %s", event_id, actor.pk)


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
    reason = reason.strip()
    with transaction.atomic():
        event = _lock_event(event_id=event_id, actor=actor)
        if event.status == Event.Status.DRAFT:
            raise NotFoundError("Event not found")
        require_owner_or_admin(actor, event)
        if event.status == Event.Status.CANCELLED:
            raise BusinessRuleError("This event is already cancelled")
        if event.end_at <= now:
            raise BusinessRuleError("An ended event cannot be cancelled")
        by_admin = actor.is_admin_role
        if by_admin and not reason:
            raise FieldValidationError("Give a reason for cancelling", field="reason")
        event.status = Event.Status.CANCELLED
        event.cancel_reason = reason
        event.cancelled_by = actor
        event.save(update_fields=["status", "cancel_reason", "cancelled_by", "updated_at"])
        notify_event_cancelled(event=event)
        if by_admin:
            notify_organizer_of_admin_cancel(event=event, reason=reason)
            record_audit(
                actor=actor,
                action=AuditLog.Action.EVENT_CANCEL,
                target_type="event",
                target_id=event.pk,
                reason=reason,
            )
    logger.info("Event %s cancelled by user %s", event.pk, actor.pk)
    return event


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
    if user.is_admin_role:
        raise PermissionDeniedError("Admins cannot attend events")
    with transaction.atomic():
        # The row lock serialises RSVPs for one event, so the last seat goes to exactly
        # one user (architecture.md section 2, "Capacity race").
        event = _lock_event(event_id=event_id, actor=user)
        if event.status == Event.Status.DRAFT:
            raise NotFoundError("Event not found")
        if event.status == Event.Status.CANCELLED or event.end_at <= now:
            raise BusinessRuleError("This event is cancelled or has ended")
        if RSVP.objects.filter(user=user, event=event).exists():
            raise ConflictError("You are already going to this event")
        if event.capacity is not None and event.rsvps.count() >= event.capacity:
            raise ConflictError("Event is full")
        attendance = RSVP.objects.create(user=user, event=event)
    logger.info("RSVP: user %s -> event %s", user.pk, event.pk)
    return attendance


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
    if user.is_admin_role:
        raise PermissionDeniedError("Admins cannot attend events")
    with transaction.atomic():
        if not Event.objects.filter(pk=event_id).exists():
            raise NotFoundError("Event not found")
        deleted, _ = RSVP.objects.filter(user=user, event_id=event_id).delete()
        if not deleted:
            raise NotFoundError("You are not going to this event")
    logger.info("RSVP cancelled: user %s -> event %s", user.pk, event_id)


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
    if user.is_admin_role:
        raise PermissionDeniedError("Admins cannot mark events as paid")
    with transaction.atomic():
        event = _lock_event(event_id=event_id, actor=user)
        if event.status == Event.Status.DRAFT:
            raise NotFoundError("Event not found")
        if event.is_free:
            raise BusinessRuleError("Free events have nothing to pay")
        if event.status == Event.Status.CANCELLED or event.end_at <= now:
            raise BusinessRuleError("This event is cancelled or has ended")
        if not RSVP.objects.filter(user=user, event=event).exists():
            rsvp(event_id=event_id, user=user, now=now)  # US-08: ticking also RSVPs
        mark, _ = PaidMark.objects.get_or_create(user=user, event=event)
    logger.info("Paid mark: user %s -> event %s", user.pk, event_id)
    return mark


def unmark_paid(*, event_id: int, user: User) -> None:
    """Untick "I have paid" (US-08). Leaves the RSVP unchanged. Idempotent.

    Args:
        event_id: Event primary key.
        user: The attendee.

    Raises:
        NotFoundError: (404) no such event.
        PermissionDeniedError: (403) the user is an admin (US-19).
    """
    if user.is_admin_role:
        raise PermissionDeniedError("Admins cannot mark events as paid")
    with transaction.atomic():
        if not Event.objects.filter(pk=event_id).exists():
            raise NotFoundError("Event not found")
        PaidMark.objects.filter(user=user, event_id=event_id).delete()
