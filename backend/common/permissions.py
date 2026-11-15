"""Permission helpers shared by every write endpoint (architecture.md §4).

Views call these before touching a service, and services call them again on the locked
row, so a direct API request is rejected even when the SPA hides the button (US-16/19 ACs).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth.models import AnonymousUser

from common.errors import AuthenticationFailedError, PermissionDeniedError

if TYPE_CHECKING:
    from accounts.models import User
    from events.models import Event


def require_authenticated(user: User | AnonymousUser) -> User:
    """Ensure the request comes from a logged-in user.

    Args:
        user: `request.user`.

    Returns:
        The same user, narrowed to `User`.

    Raises:
        AuthenticationFailedError: (401) the user is anonymous; the SPA redirects to login.
    """
    if not user.is_authenticated:
        raise AuthenticationFailedError("Login required")
    return user  # type: ignore[return-value]


def require_role(user: User | AnonymousUser, *roles: str) -> User:
    """Ensure the user is logged in and has one of the given roles.

    Args:
        user: `request.user`.
        *roles: Allowed `User.Role` values, e.g. `User.Role.ORGANIZER`.

    Returns:
        The user, narrowed to `User`.

    Raises:
        AuthenticationFailedError: (401) the user is anonymous.
        PermissionDeniedError: (403) the user's role is not in `roles`.
    """
    account = require_authenticated(user)
    if account.role not in roles:
        raise PermissionDeniedError("Your role does not allow this action")
    return account


def require_not_admin(user: User | AnonymousUser) -> User:
    """Ensure a logged-in non-admin user (attendee features, US-19).

    Args:
        user: `request.user`.

    Returns:
        The user, narrowed to `User`.

    Raises:
        AuthenticationFailedError: (401) the user is anonymous.
        PermissionDeniedError: (403) the user is an admin.
    """
    account = require_authenticated(user)
    if account.is_admin_role:
        raise PermissionDeniedError("Admins cannot attend or organize events")
    return account


def require_owner(user: User, event: Event) -> None:
    """Ensure the user organizes the event (draft publish/delete, US-25).

    Args:
        user: The acting user.
        event: The event being changed.

    Raises:
        PermissionDeniedError: (403) the user is not the event's organizer.
    """
    if event.organizer_id != user.pk:
        raise PermissionDeniedError("Only the organizer can do this")


def require_owner_or_admin(user: User, event: Event) -> None:
    """Ensure the user organizes the event or is an admin (edit/cancel, US-10/16/17/18).

    Args:
        user: The acting user.
        event: The event being changed.

    Raises:
        PermissionDeniedError: (403) the user is neither the organizer nor an admin.
    """
    if event.organizer_id != user.pk and not user.is_admin_role:
        raise PermissionDeniedError("Only the organizer or an admin can do this")
