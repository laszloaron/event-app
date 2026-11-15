"""Writes and business rules for accounts: registration, session login/logout, organizer requests.

Session-cookie auth on one origin (architecture.md §1), so login/logout wrap
`django.contrib.auth.login/logout` and need the request.
"""
import logging

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import HttpRequest

from accounts.models import OrganizerRequest, User
from accounts.selectors import has_pending_organizer_request
from common.errors import (
    AuthenticationFailedError,
    ConflictError,
    FieldValidationError,
    PermissionDeniedError,
)

logger = logging.getLogger(__name__)


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
    if User.objects.filter(username__iexact=username).exists():
        raise FieldValidationError("This username is already taken", field="username")
    try:
        validate_email(email)
    except ValidationError as exc:
        raise FieldValidationError("Enter a valid email address", field="email") from exc
    try:
        validate_password(password, user=User(username=username, email=email))
    except ValidationError as exc:
        raise FieldValidationError(" ".join(exc.messages), field="password") from exc
    try:
        with transaction.atomic():
            user = User.objects.create_user(username=username, email=email, password=password)
    except IntegrityError as exc:  # lost a race with a parallel registration
        raise FieldValidationError("This username is already taken", field="username") from exc
    logger.info("User registered: id=%s", user.pk)
    return user


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
    user = authenticate(request, username=username, password=password)
    if user is None:
        raise AuthenticationFailedError("Wrong username or password")
    login(request, user)
    logger.info("User logged in: id=%s", user.pk)
    return user  # type: ignore[return-value]


def logout_user(*, request: HttpRequest) -> None:
    """End the session of the current user (no-op for anonymous requests).

    Args:
        request: Current request.
    """
    logout(request)


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
    if user.role != User.Role.ATTENDEE:
        raise PermissionDeniedError("Only attendees can request organizer rights")
    if has_pending_organizer_request(user=user):
        raise ConflictError("You already have a pending request")
    try:
        with transaction.atomic():
            request = OrganizerRequest.objects.create(user=user)
    except IntegrityError as exc:  # parallel double-click hit the partial unique constraint
        raise ConflictError("You already have a pending request") from exc
    logger.info("Organizer request filed: id=%s user=%s", request.pk, user.pk)
    return request
