"""Shared builders for API tests (DRY across test_api_*.py).

Not a test module itself (no `test_` prefix), so the runner does not collect it.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from django.contrib.gis.geos import Point
from django.http import HttpResponse
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from events.models import RSVP, City, Event, Sport

API = "/api/v1"
API_CONTRACT_TAG = "api_contract"
"""Tag for tests written before their endpoint is implemented; run with `--tag api_contract`."""

# Budapest centre (lng, lat). One degree of longitude here is about 75 km.
BUDAPEST_LNG = 19.0402
BUDAPEST_LAT = 47.4979
KM_PER_LNG_DEGREE = 75.2


def point_km_east(km: float) -> Point:
    """Return a point `km` kilometres east of the Budapest centre."""
    return Point(BUDAPEST_LNG + km / KM_PER_LNG_DEGREE, BUDAPEST_LAT, srid=4326)


def make_user(username: str, role: str = User.Role.ATTENDEE) -> User:
    """Create a user with a fixed password and the given role."""
    return User.objects.create_user(
        username=username, email=f"{username}@example.com", password="pw-123456!", role=role
    )


def make_sport(slug: str = "fencing", name: str | None = None) -> Sport:
    """Return the sport with this slug, creating it if needed."""
    sport, _ = Sport.objects.get_or_create(slug=slug, defaults={"name": name or slug.title()})
    return sport


def make_city(name: str = "Budapest") -> City:
    """Create the seeded launch city."""
    return City.objects.create(
        name=name,
        name_normalized=name.lower(),
        center=Point(BUDAPEST_LNG, BUDAPEST_LAT, srid=4326),
        timezone="Europe/Budapest",
    )


def make_event(
    organizer: User,
    *,
    status: str = Event.Status.PUBLISHED,
    starts_in: timedelta = timedelta(hours=2),
    duration: timedelta = timedelta(hours=2),
    km_east: float = 1.0,
    sport: Sport | None = None,
    **fields: Any,
) -> Event:
    """Create a complete event relative to now; override any model field via `fields`."""
    start = timezone.now() + starts_in
    values: dict[str, Any] = {
        "title": "Open fencing night",
        "sport": sport or make_sport(),
        "start_at": start,
        "end_at": start + duration,
        "venue_name": "City Hall",
        "venue_address": "1 Main street",
        "location": point_km_east(km_east),
        "published_at": timezone.now() if status != Event.Status.DRAFT else None,
    }
    values.update(fields)
    return Event.objects.create(organizer=organizer, status=status, **values)


def make_paid_event(organizer: User, **fields: Any) -> Event:
    """Create a published paid event with a ticket link."""
    return make_event(
        organizer,
        price_amount=Decimal("2500"),
        price_currency="HUF",
        ticket_url="https://example.com/tickets",
        **fields,
    )


def add_rsvps(event: Event, *users: User) -> None:
    """RSVP the given users directly in the database (test setup, not under test)."""
    RSVP.objects.bulk_create([RSVP(user=user, event=event) for user in users])


def iso(value: datetime) -> str:
    """Format a datetime for a query string or JSON body."""
    return value.isoformat()


class ApiTestCase(TestCase):
    """Test case with JSON request helpers for the versioned API."""

    def get_json(self, path: str, params: dict[str, Any] | None = None) -> HttpResponse:
        """GET `API + path` with optional query parameters (lists become repeated keys)."""
        return self.client.get(API + path, params or {})

    def post_json(self, path: str, body: dict[str, Any] | None = None) -> HttpResponse:
        """POST a JSON body to `API + path`."""
        return self.client.post(API + path, body or {}, content_type="application/json")

    def patch_json(self, path: str, body: dict[str, Any]) -> HttpResponse:
        """PATCH a JSON body to `API + path`."""
        return self.client.patch(API + path, body, content_type="application/json")

    def put_json(self, path: str, body: dict[str, Any] | None = None) -> HttpResponse:
        """PUT a JSON body to `API + path`."""
        return self.client.put(API + path, body or {}, content_type="application/json")

    def delete(self, path: str) -> HttpResponse:
        """DELETE `API + path`."""
        return self.client.delete(API + path)

    def login(self, user: User) -> None:
        """Log `user` in through the session (login itself is tested in test_api_accounts)."""
        self.client.force_login(user)

    def assert_error(self, response: HttpResponse, status: int, field: str | None = None) -> None:
        """Assert the `{detail, field?}` error shape (architecture.md §3)."""
        self.assertEqual(response.status_code, status, response.content)
        body = response.json()
        self.assertIn("detail", body)
        if field is not None:
            self.assertEqual(body.get("field"), field)
