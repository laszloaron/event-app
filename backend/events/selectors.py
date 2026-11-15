"""Read-only queries for events: discovery, the event card, My events, My drafts."""
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal

from django.contrib.auth.models import AnonymousUser
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Case, Count, Exists, IntegerField, OuterRef, Q, QuerySet, Value, When

from accounts.models import User
from common.errors import NotFoundError
from events.models import RSVP, City, Event, PaidMark, Sport

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


def _ongoing_first(*, queryset: QuerySet[Event], now: datetime) -> QuerySet[Event]:
    """Order events ongoing first, then by start time, earliest first (US-07/23).

    Shared by `search_events` and `list_my_events` (no duplicated code). Both already
    exclude ended events, so "started" means "ongoing" here.

    Args:
        queryset: Events to order.
        now: Current time.

    Returns:
        The ordered queryset (`id` breaks ties so the order is stable).
    """
    return queryset.annotate(
        ongoing_rank=Case(
            When(start_at__lte=now, then=Value(0)), default=Value(1), output_field=IntegerField()
        )
    ).order_by("ongoing_rank", "start_at", "id")


def list_sports() -> QuerySet[Sport]:
    """Return every sport, ordered by name (filter dropdown and form)."""
    return Sport.objects.order_by("name")


def lookup_city(*, name: str) -> City:
    """Find a seeded city by name, ignoring case and accents (US-04).

    Args:
        name: What the visitor typed, e.g. "budapest".

    Returns:
        The matching city.

    Raises:
        NotFoundError: (404, detail="City not found") no seeded city matches.
    """
    decomposed = unicodedata.normalize("NFKD", name.strip())
    normalized = "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()
    city = City.objects.filter(name_normalized=normalized).first()
    if city is None:
        raise NotFoundError("City not found")
    return city


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
    queryset = (
        Event.objects.filter(
            status=Event.Status.PUBLISHED,
            end_at__gt=now,
            location__distance_lte=(center, D(km=radius_km)),
        )
        .select_related("sport")
        .annotate(distance=Distance("location", center), attendee_count=Count("rsvps"))
    )
    # Overlap, not containment: an event that started before date_from but is still
    # running stays visible (US-01 "includes events that are already ongoing").
    if date_from is not None:
        queryset = queryset.filter(end_at__gt=date_from)
    if date_to is not None:
        queryset = queryset.filter(start_at__lt=date_to)
    if sports:
        queryset = queryset.filter(sport__slug__in=sports)
    if price == "free":
        queryset = queryset.filter(price_amount__isnull=True)
    elif price == "paid":
        queryset = queryset.filter(price_amount__isnull=False)
    if max_price is not None:
        queryset = queryset.filter(Q(price_amount__isnull=True) | Q(price_amount__lte=max_price))
    if q:
        queryset = queryset.filter(title__icontains=q)
    return _ongoing_first(queryset=queryset, now=now)[:limit]


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
    event = (
        Event.objects.select_related("sport", "organizer")
        .annotate(attendee_count=Count("rsvps"))
        .filter(pk=event_id)
        .first()
    )
    if event is None or (event.status == Event.Status.DRAFT and event.organizer_id != user.pk):
        raise NotFoundError("Event not found")
    return event


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
    if not user.is_authenticated:
        return ViewerFlags(
            is_going=False, has_paid=False, can_rsvp=False, can_mark_paid=False,
            can_edit=False, can_cancel=False, can_publish=False, can_delete=False,
        )
    is_owner = event.organizer_id == user.pk
    is_admin = user.is_admin_role
    is_draft = event.status == Event.Status.DRAFT
    is_live = event.status == Event.Status.PUBLISHED and not (
        event.end_at is not None and event.end_at <= now
    )
    may_attend = is_live and not is_admin
    is_going = RSVP.objects.filter(user=user, event=event).exists()
    return ViewerFlags(
        is_going=is_going,
        has_paid=PaidMark.objects.filter(user=user, event=event).exists(),
        can_rsvp=may_attend and not is_going,
        can_mark_paid=may_attend and not event.is_free,
        can_edit=(is_live and (is_owner or is_admin)) or (is_draft and is_owner),
        can_cancel=is_live and (is_owner or is_admin),
        can_publish=is_draft and is_owner,
        can_delete=is_draft and is_owner,
    )


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
    if not Event.objects.filter(pk=event_id).exists():
        raise NotFoundError("Event not found")
    return (
        RSVP.objects.filter(event_id=event_id).count(),
        RSVP.objects.filter(event_id=event_id, user=user).exists(),
        PaidMark.objects.filter(event_id=event_id, user=user).exists(),
    )


def list_my_events(*, user: User, now: datetime) -> QuerySet[Event]:
    """Return the user's "My events" list (US-07).

    Includes every RSVP'd event that has not ended, cancelled ones too (shown with a tag).

    Args:
        user: The attendee or organizer.
        now: Current time.

    Returns:
        Events annotated with `has_paid`, ordered ongoing first, then by `start_at`.
    """
    queryset = (
        Event.objects.filter(
            rsvps__user=user,
            end_at__gt=now,
            status__in=[Event.Status.PUBLISHED, Event.Status.CANCELLED],
        )
        .select_related("sport")
        .annotate(has_paid=Exists(PaidMark.objects.filter(user=user, event=OuterRef("pk"))))
    )
    return _ongoing_first(queryset=queryset, now=now)


def list_my_drafts(*, user: User) -> QuerySet[Event]:
    """Return the organizer's own drafts, newest change first (US-25).

    Args:
        user: The organizer.
    """
    return (
        Event.objects.filter(organizer=user, status=Event.Status.DRAFT)
        .select_related("sport")
        .order_by("-updated_at", "-id")
    )
