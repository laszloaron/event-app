"""Read-only queries for accounts."""
from accounts.models import OrganizerRequest, User


def get_latest_organizer_request(*, user: User) -> OrganizerRequest | None:
    """Return the user's most recent organizer request (drives "Pending" in My account, US-20).

    Args:
        user: The requesting user.

    Returns:
        The newest request by `created_at`, or None if the user never asked.
    """
    return OrganizerRequest.objects.filter(user=user).order_by("-created_at", "-id").first()


def has_pending_organizer_request(*, user: User) -> bool:
    """Return True if the user has a request still waiting for an admin (US-20).

    Args:
        user: The requesting user.
    """
    return OrganizerRequest.objects.filter(
        user=user, status=OrganizerRequest.Status.PENDING
    ).exists()
