from django.apps import AppConfig


class InboxConfig(AppConfig):
    """In-app notifications (US-22)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "inbox"
