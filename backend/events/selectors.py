"""Read-only queries for events: discovery, the event card, My events, My drafts."""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal

from django.contrib.auth.models import AnonymousUser
from django.contrib.gis.geos import Point
from django.db.models import QuerySet

from accounts.models import User
from events.models import City, Event, Sport

SEARCH_RESULT_LIMIT: int = 1000
"""Hard cap instead of pagination: map and list need the full set (AC 2, architecture.md §3)."""


@dataclass(frozen=True)
class ViewerFlags:
    """What one viewer may do with one event; computed in one place (architecture.md §3)."""

    is_going: bool
    has_paid: bool
    can_rsvp: bool
    can_mark_paid: bool
    can_edit: bool
    can_cancel: bool
    can_publish: bool
    can_delete: bool


def list_sports() -> QuerySet[Sport]:
    """Return every sport, ordered by name (filter dropdown and form)."""
    raise NotImplementedError


def lookup_city(*, name: str) -> City:
    """Find a seeded city by name, ignoring case and accents (US-04).

    Args:
        name: What the visitor typed, e.g. "budapest".

    Returns:
        The matching city.

    Raises:
        NotFoundError: (404, detail="City not found") no seeded city matches.
    """
    raise NotImplementedError


def search_events(
    *,
    center: Point,
    radius_km: float,
    now: datetime,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sports: list[str] | None = None,
    price: Literal["free", "paid"] | None = None,
    max_price: Decimal | None = None,
    q: str | None = None,
    limit: int = SEARCH_RESULT_LIMIT,
) -> QuerySet[Event]:
    """Return the events shown on the map and in the List tab (US-01/02/12/23/24).

    Always applies `status=published` and `end_at > now` (ended and cancelled events are
    never shown). Date bounds use overlap (`start_at < date_to AND end_at > date_from`),
    so ongoing events stay visible (US-01).

    Args:
        center: Search centre (device location or city centre, US-04), SRID 4326.
        radius_km: Distance limit in km.
        now: Current time; passed in so tests can freeze it.
        date_from: Lower bound of the time window, or None for "from now".
        date_to: Upper bound of the time window, or None for "no limit".
        sports: Sport slugs; an event matches if its sport is any of them.
        price: "free" = no amount, "paid" = has amount, None = both.
        max_price: Paid events above this amount are excluded; free events stay.
        q: Case-insensitive substring of the title (US-24).
        limit: Maximum rows.

    Returns:
        Events annotated with `distance` (metres) and `attendee_count`, ordered
        ongoing first, then by `start_at` (US-23), with `sport` selected.
    """
    raise NotImplementedError


def get_event_for_viewer(*, event_id: int, user: User | AnonymousUser) -> Event:
    """Load one event for its card (US-05/11/14).

    Published and cancelled events are public (cancelled cards stay reachable by link,
    US-11). Drafts are visible only to their organizer, not even to admins (US-25).

    Args:
        event_id: Event primary key.
        user: The viewer, possibly anonymous.

    Returns:
        The event annotated with `attendee_count`, with `sport` and `organizer` selected.

    Raises:
        NotFoundError: (404) no such event, or a draft the viewer does not own.
    """
    raise NotImplementedError


def get_viewer_flags(*, event: Event, user: User | AnonymousUser, now: datetime) -> ViewerFlags:
    """Compute which buttons the viewer gets on the card (US-06/08/14/16/17/18/19/25).

    Rules: admins never RSVP or mark paid (US-19); nobody RSVPs to cancelled/ended events
    (US-14); edit/cancel for owner or admin on live events (US-16/17/18);
    publish/delete only for the owner of a draft (US-25).

    Args:
        event: The event, as returned by `get_event_for_viewer`.
        user: The viewer, possibly anonymous (all flags False).
        now: Current time.

    Returns:
        The viewer's flags.
    """
    raise NotImplementedError


def get_attendance(*, event_id: int, user: User) -> tuple[int, bool, bool]:
    """Read the attendance state shown after an RSVP or paid action (US-06/08).

    Args:
        event_id: Event primary key.
        user: The acting user.

    Returns:
        `(attendee_count, is_going, has_paid)`.

    Raises:
        NotFoundError: (404) no such event.
    """
    raise NotImplementedError


def list_my_events(*, user: User, now: datetime) -> QuerySet[Event]:
    """Return the user's "My events" list (US-07).

    Includes every RSVP'd event that has not ended, cancelled ones too (shown with a tag).

    Args:
        user: The attendee or organizer.
        now: Current time.

    Returns:
        Events annotated with `has_paid`, ordered ongoing first, then by `start_at`.
    """
    raise NotImplementedError


def list_my_drafts(*, user: User) -> QuerySet[Event]:
    """Return the organizer's own drafts, newest change first (US-25).

    Args:
        user: The organizer.
    """
    raise NotImplementedError
