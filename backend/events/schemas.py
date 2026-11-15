"""Ninja I/O schemas for discovery, the event card, attending and organizing.

Output schemas are `ModelSchema`s, so field names and types come from the models (one
source of truth); the OpenAPI schema built from them generates the frontend's TypeScript
types (architecture.md §3 "Typed client"). Fields that are not model columns are
declared explicitly and filled either by a selector annotation, a model property, or a
`resolve_*` static method (presentation mapping only, no queries).

Input schemas stay hand-written: the form differs from the table (sport slug instead of
FK id, `lat`/`lng` instead of one PointField, every field optional for drafts).
Single-field format rules (title length, URL format, capacity > 0, ...) are declared on
them, so they always run, for drafts and publishes alike (US-09). Rules that need more
than one field or the current time live in `events.services.validate_*`.
"""
from datetime import datetime
from decimal import Decimal
from typing import Literal

from ninja import Field, ModelSchema, Schema
from pydantic import HttpUrl

from accounts.models import User
from common.schemas import OUT_MODEL_CONFIG
from events.models import City, Event, Sport


# --- Reference data -------------------------------------------------------------------


class SportOut(ModelSchema):
    """One sport for the filter dropdown and the form (spec §5)."""

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = Sport
        fields = ["id", "name", "slug", "kind", "icon"]


class CityOut(ModelSchema):
    """A known city centre for the location-denied fallback (US-04)."""

    lat: float
    lng: float

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = City
        fields = ["name", "timezone"]

    @staticmethod
    def resolve_lat(obj: City) -> float:
        """Return the latitude of `City.center`."""
        return obj.center.y

    @staticmethod
    def resolve_lng(obj: City) -> float:
        """Return the longitude of `City.center`."""
        return obj.center.x


# --- Shared pieces --------------------------------------------------------------------


class PriceOut(Schema):
    """An amount with its currency; absent (null) means "Free". Not a model: two columns."""

    amount: Decimal
    currency: str


class SocialLinkSchema(Schema):
    """One organizer social link, e.g. `{"label": "Instagram", "url": "https://..."}`.

    Plain schema: it describes items inside the `Event.social_links` JSON column.
    """

    label: str = Field(..., min_length=1, max_length=50)
    url: HttpUrl


class OrganizerOut(ModelSchema):
    """Public organizer identity shown on the card (US-05)."""

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = User
        fields = ["id", "username"]


def _price_of(event: Event) -> PriceOut | None:
    """Map `price_amount` + `price_currency` to `PriceOut`, or None for "Free"."""
    if event.price_amount is None:
        return None
    return PriceOut(amount=event.price_amount, currency=event.price_currency)


def _lat_of(event: Event) -> float | None:
    """Return the latitude of `Event.location`, or None while a draft has no pin."""
    return event.location.y if event.location else None


def _lng_of(event: Event) -> float | None:
    """Return the longitude of `Event.location`, or None while a draft has no pin."""
    return event.location.x if event.location else None


# --- Discovery ------------------------------------------------------------------------


class EventSearchQuery(Schema):
    """Query string of `GET /events` (US-01/02/03/23/24).

    The client derives "today" / "this weekend" in venue local time and sends ISO bounds.
    """

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(10, gt=0, le=50)
    date_from: datetime | None = None
    date_to: datetime | None = None
    sport: list[str] = Field(default_factory=list)  # slugs, OR-combined
    price: Literal["free", "paid"] | None = None
    max_price: Decimal | None = Field(None, gt=0)
    q: str | None = Field(None, max_length=100)  # title icontains (US-24)


class EventListItemOut(ModelSchema):
    """One marker / list row (US-12/23): only what the map and the list show.

    Published events always have start/end/location, so those are non-null here.
    `distance_km` comes from the `distance` annotation of `search_events`.
    """

    sport: SportOut
    start_at: datetime
    end_at: datetime
    lat: float
    lng: float
    price: PriceOut | None
    is_free: bool  # model property
    is_ongoing: bool  # model property
    distance_km: float

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = Event
        fields = ["id", "title", "timezone", "venue_name"]

    @staticmethod
    def resolve_lat(obj: Event) -> float | None:
        """Latitude of the venue pin."""
        return _lat_of(obj)

    @staticmethod
    def resolve_lng(obj: Event) -> float | None:
        """Longitude of the venue pin."""
        return _lng_of(obj)

    @staticmethod
    def resolve_price(obj: Event) -> PriceOut | None:
        """Amount + currency, or None for "Free"."""
        return _price_of(obj)

    @staticmethod
    def resolve_distance_km(obj: Event) -> float:
        """Convert the `distance` annotation (a `Distance`) to kilometres."""
        return round(obj.distance.km, 2)


class EventListOut(Schema):
    """Map and list share this response, so `count == markers == rows` (AC 2)."""

    count: int
    items: list[EventListItemOut]


# --- Event card -----------------------------------------------------------------------


class ViewerFlagsOut(Schema):
    """What the current viewer may do; the SPA only hides/shows buttons (US-14/16/19).

    Plain schema: mirrors the `events.selectors.ViewerFlags` dataclass, not a model.
    """

    is_going: bool
    has_paid: bool
    can_rsvp: bool
    can_mark_paid: bool
    can_edit: bool
    can_cancel: bool
    can_publish: bool
    can_delete: bool


class EventDetailOut(ModelSchema):
    """The full event card (US-05/11/14). Draft fields may be null (owner-only view, US-25).

    `attendee_count` is an annotation from `get_event_for_viewer`; `viewer` is attached
    to the event by the view from `get_viewer_flags` (it depends on the request user).
    """

    organizer: OrganizerOut
    sport: SportOut | None
    lat: float | None
    lng: float | None
    price: PriceOut | None
    is_free: bool  # model property
    social_links: list[SocialLinkSchema]
    attendee_count: int
    is_cancelled: bool
    is_ongoing: bool  # model property
    is_ended: bool  # model property
    viewer: ViewerFlagsOut

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = Event
        fields = [
            "id",
            "status",
            "title",
            "start_at",
            "end_at",
            "timezone",
            "venue_name",
            "venue_address",
            "description",
            "sport_explainer",
            "ticket_url",
            "registration_url",
            "capacity",
            "published_at",
        ]

    @staticmethod
    def resolve_lat(obj: Event) -> float | None:
        """Latitude of the venue pin, None for a draft without one."""
        return _lat_of(obj)

    @staticmethod
    def resolve_lng(obj: Event) -> float | None:
        """Longitude of the venue pin, None for a draft without one."""
        return _lng_of(obj)

    @staticmethod
    def resolve_price(obj: Event) -> PriceOut | None:
        """Amount + currency, or None for "Free"."""
        return _price_of(obj)

    @staticmethod
    def resolve_is_cancelled(obj: Event) -> bool:
        """True if `status` is cancelled (card shows the "Cancelled" label, US-11)."""
        return obj.status == Event.Status.CANCELLED


# --- Attending ------------------------------------------------------------------------


class AttendanceOut(Schema):
    """State of the card's attendance controls after an RSVP/paid action (US-06/08).

    Plain schema: built from `events.selectors.get_attendance`, not from one model row.
    """

    event_id: int
    attendee_count: int
    is_going: bool
    has_paid: bool


class MyEventOut(ModelSchema):
    """One row of "My events" (US-07): includes cancelled events with a tag.

    `has_paid` is an annotation from `list_my_events`.
    """

    sport: SportOut
    start_at: datetime
    end_at: datetime
    price: PriceOut | None
    is_free: bool  # model property
    is_ongoing: bool  # model property
    is_cancelled: bool
    has_paid: bool

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = Event
        fields = ["id", "title", "timezone", "venue_name"]

    @staticmethod
    def resolve_price(obj: Event) -> PriceOut | None:
        """Amount + currency, or None for "Free"."""
        return _price_of(obj)

    @staticmethod
    def resolve_is_cancelled(obj: Event) -> bool:
        """True if `status` is cancelled ("Cancelled" tag, US-07)."""
        return obj.status == Event.Status.CANCELLED


# --- Organizing -----------------------------------------------------------------------


class EventFieldsIn(Schema):
    """The event form (US-09 table). Every field optional so drafts can save (US-25).

    `None` on PATCH clears an optional field; fields not sent are left unchanged.
    """

    title: str | None = Field(None, min_length=3, max_length=100)
    sport: str | None = Field(None, max_length=64)  # slug
    start_at: datetime | None = None
    end_at: datetime | None = None
    venue_name: str | None = Field(None, max_length=200)
    venue_address: str | None = Field(None, max_length=300)
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    timezone: str | None = Field(None, max_length=64)
    price_amount: Decimal | None = Field(None, gt=0, max_digits=10, decimal_places=2)
    price_currency: str | None = Field(None, pattern=r"^[A-Z]{3}$")
    description: str | None = None
    sport_explainer: str | None = None
    ticket_url: HttpUrl | None = None
    registration_url: HttpUrl | None = None
    capacity: int | None = Field(None, gt=0)
    social_links: list[SocialLinkSchema] | None = None


class EventCreateIn(EventFieldsIn):
    """`POST /events` body: the form plus which button was pressed (US-09/25)."""

    action: Literal["draft", "publish"]


class EventPatchIn(EventFieldsIn):
    """`PATCH /events/{id}` body; only sent fields change (`exclude_unset`)."""


class DraftOut(ModelSchema):
    """One row of "My drafts" (US-25)."""

    sport: SportOut | None

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = Event
        fields = ["id", "title", "start_at", "updated_at"]


class CancelIn(Schema):
    """Cancel body. `reason` is required for admins (US-18), optional for organizers (US-10)."""

    reason: str = Field("", max_length=1000)
