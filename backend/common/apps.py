from django.apps import AppConfig


class CommonConfig(AppConfig):
    """Shared base classes and helpers used by every domain app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "common"
