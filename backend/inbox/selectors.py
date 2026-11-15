"""Read-only queries for the inbox (US-22)."""
from django.db.models import QuerySet

from accounts.models import User
from inbox.models import Notification


def list_notifications(*, user: User) -> QuerySet[Notification]:
    """Return the user's messages, newest first, with `event` selected (for its title).

    Args:
        user: The recipient.
    """
    return (
        Notification.objects.filter(recipient=user)
        .select_related("event")
        .order_by("-created_at", "-id")
    )


def count_unread(*, user: User) -> int:
    """Return how many of the user's messages are unread (badge, US-22).

    Args:
        user: The recipient.
    """
    return Notification.objects.filter(recipient=user, is_read=False).count()
