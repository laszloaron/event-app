from django.apps import AppConfig


class EventsConfig(AppConfig):
    """Sports, cities, events and attendance (US-01..16, US-23..25)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "events"
