from django.apps import AppConfig


class ModerationConfig(AppConfig):
    """Admin audit trail (US-17, US-18, US-21)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "moderation"
