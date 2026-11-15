from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """Users, roles and organizer requests (US-19..21)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
