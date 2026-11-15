"""Event tables: reference data, events and attendance (architecture.md §2).

Conventions (see backend/AGENTS.md):
- Text fields use `blank=True` with "" as their single empty value, never `null=True`.
- Fields that are required only on publish are nullable/blank, so drafts can save (US-09/25).
  Every CHECK constraint therefore lets NULL through and only rejects wrong values.
"""
from django.conf import settings
from django.contrib.gis.db import models
from django.db.models import F, Q
from django.utils import timezone

from common.models import CreatedAtModel, TimeStampedModel


def default_event_timezone() -> str:
    """Return the launch city's timezone, used until the organizer picks a venue."""
    return settings.EVENTMAP_DEFAULT_TIMEZONE


class Sport(models.Model):
    """A category events are filed under (generic category, specification §5)."""

    class Kind(models.TextChoices):
        SPORT = "sport", "Sport"

    name = models.CharField(max_length=64)
    slug = models.SlugField(max_length=64, unique=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.SPORT)
    icon = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class City(models.Model):
    """A known city for the location-denied fallback (US-04). Seeded, not geocoded."""

    name = models.CharField(max_length=100)
    name_normalized = models.CharField(max_length=100, unique=True)  # lower-case, unaccented
    center = models.PointField(geography=True, srid=4326)
    timezone = models.CharField(max_length=64)

    class Meta:
        verbose_name_plural = "cities"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Event(TimeStampedModel):
    """A sports event. Drafts share this table so a draft is published in place (US-25)."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CANCELLED = "cancelled", "Cancelled"

    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="organized_events"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    # Required on publish (US-09 form table), optional while a draft.
    title = models.CharField(max_length=100, blank=True)
    sport = models.ForeignKey(
        Sport, on_delete=models.PROTECT, null=True, blank=True, related_name="events"
    )
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    venue_name = models.CharField(max_length=200, blank=True)
    venue_address = models.CharField(max_length=300, blank=True)
    location = models.PointField(geography=True, srid=4326, null=True, blank=True)  # GiST index
    timezone = models.CharField(max_length=64, default=default_event_timezone)
    price_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_currency = models.CharField(max_length=3, blank=True)  # ISO 4217, e.g. "HUF"

    # Optional fields (US-09 form table).
    description = models.TextField(blank=True)
    sport_explainer = models.TextField(blank=True)
    ticket_url = models.URLField(max_length=500, blank=True)
    registration_url = models.URLField(max_length=500, blank=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)  # null = unlimited
    social_links = models.JSONField(default=list, blank=True)  # [{"label": ..., "url": ...}]

    # Lifecycle (US-10/18).
    cancel_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_events",
    )
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "start_at"], name="event_status_start_idx"),
            models.Index(fields=["status", "end_at"], name="event_status_end_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(start_at__isnull=True)
                | Q(end_at__isnull=True)
                | Q(end_at__gt=F("start_at")),
                name="event_end_after_start",
            ),
            models.CheckConstraint(
                condition=Q(capacity__isnull=True) | Q(capacity__gt=0),
                name="event_capacity_positive",
            ),
            # A ticket link only makes sense for a paid event (US-08 "Get tickets").
            models.CheckConstraint(
                condition=Q(ticket_url="") | Q(price_amount__isnull=False),
                name="event_ticket_url_requires_price",
            ),
            # Price is "Free" (no amount) or "an amount with a currency" (US-09 form table).
            models.CheckConstraint(
                condition=(Q(price_amount__isnull=True) & Q(price_currency=""))
                | (Q(price_amount__isnull=False) & ~Q(price_currency="")),
                name="event_price_amount_and_currency_together",
            ),
            # An amount of 0 would be a second way to say "Free"; null is the only one.
            models.CheckConstraint(
                condition=Q(price_amount__isnull=True) | Q(price_amount__gt=0),
                name="event_price_amount_positive",
            ),
        ]

    def __str__(self) -> str:
        return self.title or f"Event #{self.pk} (untitled)"

    @property
    def is_free(self) -> bool:
        """Return True if the event has no price (shown as "Free")."""
        return self.price_amount is None

    @property
    def is_ended(self) -> bool:
        """Return True if the event's end time has passed (computed, never stored)."""
        return self.end_at is not None and self.end_at <= timezone.now()

    @property
    def is_ongoing(self) -> bool:
        """Return True if the event has started but not yet ended."""
        if self.start_at is None or self.end_at is None:
            return False
        return self.start_at <= timezone.now() < self.end_at


class RSVP(CreatedAtModel):
    """A user's "I'm going" for an event (US-06/07)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rsvps")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="rsvps")

    class Meta:
        verbose_name = "RSVP"
        constraints = [
            models.UniqueConstraint(fields=["user", "event"], name="unique_rsvp_per_user_event"),
        ]

    def __str__(self) -> str:
        return f"RSVP({self.user_id} -> {self.event_id})"


class PaidMark(CreatedAtModel):
    """A user's own "I have paid" tick (US-08).

    A separate table because the tick must survive cancelling attendance, so it
    cannot live on the RSVP row.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="paid_marks"
    )
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="paid_marks")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "event"], name="unique_paid_mark_per_user_event"),
        ]

    def __str__(self) -> str:
        return f"PaidMark({self.user_id} -> {self.event_id})"
