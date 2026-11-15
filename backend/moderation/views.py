"""Admin endpoints (US-17/18/21), mounted at `/admin`.

Admin edit and cancel of events reuse `PATCH /events/{id}` and `POST /events/{id}/cancel`
(architecture.md §3), so this router only holds what is admin-only.
"""
from django.http import HttpRequest
from ninja import Query, Router
from ninja.security import django_auth

from common.schemas import ErrorOut
from moderation.schemas import AuditLogOut, OrganizerRequestAdminOut, OrganizerRequestFilter

router = Router(tags=["admin"], auth=django_auth)


@router.get("/organizer-requests", response={200: list[OrganizerRequestAdminOut], 403: ErrorOut})
def list_organizer_requests(
    request: HttpRequest, filters: Query[OrganizerRequestFilter]
) -> list[OrganizerRequestAdminOut]:
    """List organizer requests with the requesting user's details (US-21).

    Calls `common.permissions.require_role(ADMIN)` and
    `moderation.selectors.list_organizer_requests`.

    Returns:
        200 with the requests (default `status=pending`).

    Raises:
        PermissionDeniedError: 403 not an admin.
    """
    raise NotImplementedError


@router.post(
    "/organizer-requests/{request_id}/approve",
    response={200: OrganizerRequestAdminOut, 403: ErrorOut, 404: ErrorOut, 409: ErrorOut},
)
def approve_organizer_request(request: HttpRequest, request_id: int) -> OrganizerRequestAdminOut:
    """Approve a request: role change + inbox message + audit entry (US-21).

    Calls `common.permissions.require_role(ADMIN)` and
    `moderation.services.approve_organizer_request`.

    Returns:
        200 with the approved request.

    Raises:
        PermissionDeniedError: 403 not an admin.
        NotFoundError: 404 unknown request.
        ConflictError: 409 already decided.
    """
    raise NotImplementedError


@router.post(
    "/organizer-requests/{request_id}/reject",
    response={200: OrganizerRequestAdminOut, 403: ErrorOut, 404: ErrorOut, 409: ErrorOut},
)
def reject_organizer_request(request: HttpRequest, request_id: int) -> OrganizerRequestAdminOut:
    """Reject a request: inbox message + audit entry; user stays attendee (US-21).

    Calls `common.permissions.require_role(ADMIN)` and
    `moderation.services.reject_organizer_request`.

    Returns:
        200 with the rejected request.

    Raises:
        PermissionDeniedError: 403 not an admin.
        NotFoundError: 404 unknown request.
        ConflictError: 409 already decided.
    """
    raise NotImplementedError


@router.get("/audit-log", response={200: list[AuditLogOut], 403: ErrorOut})
def list_audit_log(request: HttpRequest) -> list[AuditLogOut]:
    """Return the admin audit trail, newest first (US-17/18/21).

    Calls `common.permissions.require_role(ADMIN)` and `moderation.selectors.list_audit_log`.

    Returns:
        200 with every entry.

    Raises:
        PermissionDeniedError: 403 not an admin.
    """
    raise NotImplementedError
