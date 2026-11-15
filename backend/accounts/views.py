"""Auth and account endpoints (architecture.md §3 "Auth & account").

Mounted at the API root with full paths, because `/me/*` is shared with the events app.
"""
from django.http import HttpRequest
from django.views.decorators.csrf import ensure_csrf_cookie
from ninja import Router
from ninja.decorators import decorate_view
from ninja.security import django_auth

from accounts import selectors, services
from accounts.schemas import LoginIn, MeOut, OrganizerRequestOut, RegisterIn, UserOut
from common.permissions import require_not_admin
from common.schemas import ErrorOut, OkOut
from inbox.selectors import count_unread

router = Router(tags=["auth & account"])


@router.get("/auth/csrf", response={200: OkOut})
@decorate_view(ensure_csrf_cookie)
def get_csrf(request: HttpRequest) -> OkOut:
    """Set the CSRF cookie the SPA echoes back in the `X-CSRFToken` header.

    Returns:
        200 `{ok: true}`; the cookie is the real payload.
    """
    return OkOut()


@router.post("/auth/register", response={201: UserOut, 422: ErrorOut})
def register(request: HttpRequest, payload: RegisterIn) -> tuple[int, UserOut]:
    """Create an attendee account and log it in.

    Calls `accounts.services.register_user` then `login_user`.

    Returns:
        201 with the new user.

    Raises:
        FieldValidationError: 422 taken username, invalid email or weak password.
    """
    user = services.register_user(
        username=payload.username, email=payload.email, password=payload.password
    )
    services.login_user(request=request, username=payload.username, password=payload.password)
    return 201, user


@router.post("/auth/login", response={200: UserOut, 401: ErrorOut})
def login(request: HttpRequest, payload: LoginIn) -> UserOut:
    """Start a session (US-06 AC "redirected to login" lands here).

    Calls `accounts.services.login_user`.

    Returns:
        200 with the logged-in user.

    Raises:
        AuthenticationFailedError: 401 wrong credentials.
    """
    return services.login_user(
        request=request, username=payload.username, password=payload.password
    )


@router.post("/auth/logout", response={200: OkOut, 401: ErrorOut}, auth=django_auth)
def logout(request: HttpRequest) -> OkOut:
    """End the current session.

    Calls `accounts.services.logout_user`.

    Returns:
        200 `{ok: true}`.

    Raises:
        401 (Ninja `django_auth`) when not logged in.
    """
    services.logout_user(request=request)
    return OkOut()


@router.get("/me", response={200: MeOut, 401: ErrorOut}, auth=django_auth)
def get_me(request: HttpRequest) -> MeOut:
    """Return role, unread inbox count and organizer-request status (drives UI visibility).

    Calls `accounts.selectors.get_latest_organizer_request` and `inbox.selectors.count_unread`.

    Returns:
        200 with `MeOut`.

    Raises:
        401 (Ninja `django_auth`) when not logged in.
    """
    user = request.user
    latest = selectors.get_latest_organizer_request(user=user)
    return {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "unread_count": count_unread(user=user),
        "organizer_request_status": latest.status if latest else None,
    }


@router.post(
    "/me/organizer-request",
    response={201: OrganizerRequestOut, 401: ErrorOut, 403: ErrorOut, 409: ErrorOut},
    auth=django_auth,
)
def create_organizer_request(request: HttpRequest) -> tuple[int, OrganizerRequestOut]:
    """Send a "Become an organizer" request (US-20).

    Calls `common.permissions.require_not_admin`, then
    `accounts.services.create_organizer_request`.

    Returns:
        201 with the pending request.

    Raises:
        PermissionDeniedError: 403 admin (US-19) or already organizer.
        ConflictError: 409 a request is already pending.
    """
    user = require_not_admin(request.user)
    return 201, services.create_organizer_request(user=user)
