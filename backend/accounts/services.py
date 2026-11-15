"""Writes and business rules for accounts: registration, session login/logout, organizer requests.

Session-cookie auth on one origin (architecture.md §1), so login/logout wrap
`django.contrib.auth.login/logout` and need the request.
"""
from django.http import HttpRequest

from accounts.models import OrganizerRequest, User


def register_user(*, username: str, email: str, password: str) -> User:
    """Create an attendee account (default role, architecture.md §2).

    Args:
        username: Unique login name.
        email: Contact address.
        password: Raw password; checked by `AUTH_PASSWORD_VALIDATORS`, stored hashed.

    Returns:
        The new user with role `attendee`.

    Raises:
        FieldValidationError: (422, field="username") the username is taken;
            (422, field="email") the email is not a valid address;
            (422, field="password") the password fails a validator.
    """
    raise NotImplementedError


def login_user(*, request: HttpRequest, username: str, password: str) -> User:
    """Check credentials and start a session (sets the httpOnly session cookie).

    Args:
        request: Current request; its session is rotated on login.
        username: Login name.
        password: Raw password.

    Returns:
        The authenticated user.

    Raises:
        AuthenticationFailedError: (401) unknown user, wrong password or inactive account.
    """
    raise NotImplementedError


def logout_user(*, request: HttpRequest) -> None:
    """End the session of the current user (no-op for anonymous requests).

    Args:
        request: Current request.
    """
    raise NotImplementedError


def create_organizer_request(*, user: User) -> OrganizerRequest:
    """File a "Become an organizer" request (US-20).

    Args:
        user: The requesting user; must be an attendee.

    Returns:
        The new request with status `pending`.

    Raises:
        PermissionDeniedError: (403) the user is an admin (US-19) or already an organizer.
        ConflictError: (409) a pending request already exists (US-20 AC; backed by the
            `one_pending_request_per_user` constraint).
    """
    raise NotImplementedError
