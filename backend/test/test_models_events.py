"""Database constraint and simple-property tests for events models."""
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.contrib.gis.geos import Point
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from events.models import RSVP, City, Event, PaidMark, Sport


class EventConstraintTests(TestCase):
    def setUp(self) -> None:
        self.organizer = User.objects.create_user(
            username="org", password="pw-123456!", role=User.Role.ORGANIZER
        )
        self.now = timezone.now()

    def _create(self, **fields: Any) -> Event:
        return Event.objects.create(organizer=self.organizer, **fields)

    def _assert_rejected(self, **fields: Any) -> None:
        with self.assertRaises(IntegrityError), transaction.atomic():
            self._create(**fields)

    def test_us09_empty_draft_saves(self) -> None:
        event = self._create()

        self.assertEqual(event.status, Event.Status.DRAFT)
        self.assertEqual(event.timezone, "Europe/Budapest")
        self.assertTrue(event.is_free)

    def test_us09_complete_event_saves(self) -> None:
        sport = Sport.objects.create(name="Fencing", slug="fencing-test")
        event = self._create(
            title="Open fencing night",
            sport=sport,
            start_at=self.now + timedelta(days=1),
            end_at=self.now + timedelta(days=1, hours=2),
            venue_name="Hall",
            location=Point(19.04, 47.50, srid=4326),
            price_amount=Decimal("2500"),
            price_currency="HUF",
            ticket_url="https://example.com/tickets",
            capacity=20,
            social_links=[{"label": "Website", "url": "https://example.com"}],
        )

        self.assertFalse(event.is_free)

    def test_us09_end_before_start_rejected(self) -> None:
        self._assert_rejected(start_at=self.now, end_at=self.now - timedelta(hours=1))

    def test_us09_end_equal_start_rejected(self) -> None:
        self._assert_rejected(start_at=self.now, end_at=self.now)

    def test_us09_zero_capacity_rejected(self) -> None:
        self._assert_rejected(capacity=0)

    def test_us08_ticket_url_without_price_rejected(self) -> None:
        self._assert_rejected(ticket_url="https://example.com/tickets")

    def test_us09_amount_without_currency_rejected(self) -> None:
        self._assert_rejected(price_amount=Decimal("1000"))

    def test_us09_currency_without_amount_rejected(self) -> None:
        self._assert_rejected(price_currency="HUF")

    def test_us09_zero_price_rejected(self) -> None:
        self._assert_rejected(price_amount=Decimal("0"), price_currency="HUF")

    def test_us01_ongoing_and_ended_are_computed(self) -> None:
        ongoing = self._create(
            start_at=self.now - timedelta(hours=1), end_at=self.now + timedelta(hours=1)
        )
        ended = self._create(
            start_at=self.now - timedelta(hours=3), end_at=self.now - timedelta(hours=1)
        )

        self.assertTrue(ongoing.is_ongoing)
        self.assertFalse(ongoing.is_ended)
        self.assertTrue(ended.is_ended)
        self.assertFalse(ended.is_ongoing)


class AttendanceConstraintTests(TestCase):
    def setUp(self) -> None:
        organizer = User.objects.create_user(username="org", password="pw-123456!")
        self.attendee = User.objects.create_user(username="att", password="pw-123456!")
        self.event = Event.objects.create(organizer=organizer, status=Event.Status.PUBLISHED)

    def test_us06_duplicate_rsvp_rejected(self) -> None:
        RSVP.objects.create(user=self.attendee, event=self.event)

        with self.assertRaises(IntegrityError), transaction.atomic():
            RSVP.objects.create(user=self.attendee, event=self.event)

    def test_us08_duplicate_paid_mark_rejected(self) -> None:
        PaidMark.objects.create(user=self.attendee, event=self.event)

        with self.assertRaises(IntegrityError), transaction.atomic():
            PaidMark.objects.create(user=self.attendee, event=self.event)

    def test_us08_paid_mark_survives_rsvp_removal(self) -> None:
        rsvp = RSVP.objects.create(user=self.attendee, event=self.event)
        PaidMark.objects.create(user=self.attendee, event=self.event)

        rsvp.delete()

        self.assertTrue(PaidMark.objects.filter(user=self.attendee, event=self.event).exists())


class ReferenceDataTests(TestCase):
    fixtures = ["cities", "sports"]

    def test_us04_budapest_is_seeded(self) -> None:
        city = City.objects.get(name_normalized="budapest")

        self.assertAlmostEqual(city.center.x, 19.0402)
        self.assertEqual(city.timezone, "Europe/Budapest")

    def test_us09_sports_are_seeded(self) -> None:
        self.assertTrue(Sport.objects.filter(slug="fencing").exists())
