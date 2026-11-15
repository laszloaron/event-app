"""Reference data, discovery, event card, attending and organizing endpoints (architecture.md §3).

Mounted at the API root with full paths, because `/me/events` and `/me/drafts` share the
`/me` prefix with the accounts app. Every view: permission helper → schema → selector /
service → response; business rules stay in services.
"""
from django.http import HttpRequest
from ninja import Query, Router
from ninja.security import django_auth

from common.schemas import ErrorOut
from events.schemas import (
    AttendanceOut,
    CancelIn,
    CityOut,
    DraftOut,
    EventCreateIn,
    EventDetailOut,
    EventListOut,
    EventPatchIn,
    EventSearchQuery,
    MyEventOut,
    SportOut,
)

router = Router(tags=["events"])


# --- Reference data -------------------------------------------------------------------


@router.get("/sports", response={200: list[SportOut]})
def list_sports(request: HttpRequest) -> list[SportOut]:
    """List sports for the filter dropdown and the form.

    Calls `events.selectors.list_sports`.

    Returns:
        200 with every sport, ordered by name.
    """
    raise NotImplementedError


@router.get("/cities/lookup", response={200: CityOut, 404: ErrorOut})
def lookup_city(request: HttpRequest, name: str) -> CityOut:
    """Resolve a typed city name to its centre (US-04).

    Calls `events.selectors.lookup_city`.

    Returns:
        200 `{name, lat, lng, timezone}`.

    Raises:
        NotFoundError: 404 `{"detail": "City not found"}`.
    """
    raise NotImplementedError


# --- Discovery ------------------------------------------------------------------------


@router.get("/events", response={200: EventListOut})
def search_events(request: HttpRequest, filters: Query[EventSearchQuery]) -> EventListOut:
    """Return the events for the map and the List tab (US-01/02/03/12/23/24).

    Calls `events.selectors.search_events`. Not paginated: `count` always equals
    `len(items)` (AC 2). An empty result is a normal 200 (US-03).

    Returns:
        200 `{count, items}`, ongoing first then by start time.

    Raises:
        422 (Ninja validation) missing `lat`/`lng` or `radius_km` outside (0, 50].
    """
    raise NotImplementedError


# --- Event card -----------------------------------------------------------------------


@router.get("/events/{event_id}", response={200: EventDetailOut, 404: ErrorOut})
def get_event(request: HttpRequest, event_id: int) -> EventDetailOut:
    """Return the full event card with viewer flags (US-05/11/14).

    Calls `events.selectors.get_event_for_viewer` and `get_viewer_flags`.

    Returns:
        200 with the card; cancelled events included with `is_cancelled=true`.

    Raises:
        NotFoundError: 404 unknown id, or a draft the viewer does not own (US-25).
    """
    raise NotImplementedError


# --- Attending ------------------------------------------------------------------------


@router.post(
    "/events/{event_id}/rsvp",
    response={201: AttendanceOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut, 409: ErrorOut},
    auth=django_auth,
)
def create_rsvp(request: HttpRequest, event_id: int) -> tuple[int, AttendanceOut]:
    """Click "I'm going" (US-06).

    Calls `common.permissions.require_not_admin`, `events.services.rsvp`,
    then `events.selectors.get_attendance`.

    Returns:
        201 with the new attendee count and `is_going=true`.

    Raises:
        401 (Ninja `django_auth`) not logged in → SPA redirects to login.
        PermissionDeniedError: 403 admin (US-19).
        NotFoundError: 404 unknown event or draft.
        BusinessRuleError: 400 cancelled or ended.
        ConflictError: 409 already going or "Event is full".
    """
    raise NotImplementedError


@router.delete(
    "/events/{event_id}/rsvp",
    response={200: AttendanceOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    auth=django_auth,
)
def delete_rsvp(request: HttpRequest, event_id: int) -> AttendanceOut:
    """Cancel my attendance (US-06) or remove a cancelled event from My events (US-07).

    Calls `common.permissions.require_not_admin`, `events.services.cancel_rsvp`,
    then `events.selectors.get_attendance`.

    Returns:
        200 with the new attendee count and `is_going=false`; `has_paid` unchanged (US-08).

    Raises:
        PermissionDeniedError: 403 admin.
        NotFoundError: 404 unknown event or no RSVP.
    """
    raise NotImplementedError


@router.put(
    "/events/{event_id}/paid",
    response={200: AttendanceOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut, 409: ErrorOut},
    auth=django_auth,
)
def mark_paid(request: HttpRequest, event_id: int) -> AttendanceOut:
    """Tick "I have paid" (US-08); also RSVPs if needed.

    Calls `common.permissions.require_not_admin`, `events.services.mark_paid`,
    then `events.selectors.get_attendance`.

    Returns:
        200 with `has_paid=true`, `is_going=true`.

    Raises:
        PermissionDeniedError: 403 admin.
        NotFoundError: 404 unknown event or draft.
        BusinessRuleError: 400 free, cancelled or ended event.
        ConflictError: 409 "Event is full".
    """
    raise NotImplementedError


@router.delete(
    "/events/{event_id}/paid",
    response={200: AttendanceOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut},
    auth=django_auth,
)
def unmark_paid(request: HttpRequest, event_id: int) -> AttendanceOut:
    """Untick "I have paid" (US-08); the RSVP is left as it is.

    Calls `common.permissions.require_not_admin`, `events.services.unmark_paid`,
    then `events.selectors.get_attendance`.

    Returns:
        200 with `has_paid=false`.

    Raises:
        PermissionDeniedError: 403 admin.
        NotFoundError: 404 unknown event.
    """
    raise NotImplementedError


@router.get("/me/events", response={200: list[MyEventOut], 401: ErrorOut, 403: ErrorOut}, auth=django_auth)
def list_my_events(request: HttpRequest) -> list[MyEventOut]:
    """Return "My events" (US-07).

    Calls `common.permissions.require_not_admin` and `events.selectors.list_my_events`.

    Returns:
        200 with RSVP'd, not-ended events (cancelled ones tagged), ongoing first.

    Raises:
        PermissionDeniedError: 403 admin (US-07/19).
    """
    raise NotImplementedError


# --- Organizing -----------------------------------------------------------------------


@router.post(
    "/events",
    response={201: EventDetailOut, 401: ErrorOut, 403: ErrorOut, 422: ErrorOut},
    auth=django_auth,
)
def create_event(request: HttpRequest, payload: EventCreateIn) -> tuple[int, EventDetailOut]:
    """Save a new event as draft or publish it (US-09/25).

    Calls `common.permissions.require_role(ORGANIZER)` and `events.services.create_event`.

    Returns:
        201 with the card of the new event.

    Raises:
        PermissionDeniedError: 403 not an organizer (attendee or admin).
        FieldValidationError: 422 `{detail, field}`; on "draft" only format errors,
            on "publish" also missing required fields.
    """
    raise NotImplementedError


@router.get("/me/drafts", response={200: list[DraftOut], 401: ErrorOut, 403: ErrorOut}, auth=django_auth)
def list_my_drafts(request: HttpRequest) -> list[DraftOut]:
    """Return "My drafts" (US-25).

    Calls `common.permissions.require_role(ORGANIZER)` and `events.selectors.list_my_drafts`.

    Returns:
        200 with the organizer's own drafts only.

    Raises:
        PermissionDeniedError: 403 not an organizer.
    """
    raise NotImplementedError


@router.patch(
    "/events/{event_id}",
    response={200: EventDetailOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut, 422: ErrorOut},
    auth=django_auth,
)
def update_event(request: HttpRequest, event_id: int, payload: EventPatchIn) -> EventDetailOut:
    """Edit an event: owner (US-16/25) or admin (US-17).

    Calls `events.services.update_event` with `payload.dict(exclude_unset=True)`.

    Returns:
        200 with the updated card.

    Raises:
        NotFoundError: 404 unknown event, or a draft not owned by the user.
        PermissionDeniedError: 403 neither owner nor admin.
        BusinessRuleError: 400 cancelled or ended.
        FieldValidationError: 422 validation failure or capacity below RSVPs.
    """
    raise NotImplementedError


@router.post(
    "/events/{event_id}/publish",
    response={200: EventDetailOut, 400: ErrorOut, 401: ErrorOut, 404: ErrorOut, 422: ErrorOut},
    auth=django_auth,
)
def publish_event(request: HttpRequest, event_id: int) -> EventDetailOut:
    """Publish a saved draft (US-25 → US-09).

    Calls `events.services.publish_event`.

    Returns:
        200 with the published card.

    Raises:
        NotFoundError: 404 unknown event, or a draft not owned by the user.
        BusinessRuleError: 400 not a draft.
        FieldValidationError: 422 incomplete or invalid draft.
    """
    raise NotImplementedError


@router.delete(
    "/events/{event_id}",
    response={204: None, 400: ErrorOut, 401: ErrorOut, 404: ErrorOut},
    auth=django_auth,
)
def delete_draft(request: HttpRequest, event_id: int) -> tuple[int, None]:
    """Delete a draft (US-25). Published events must be cancelled instead.

    Calls `events.services.delete_draft`.

    Returns:
        204 no content.

    Raises:
        NotFoundError: 404 unknown event, or a draft not owned by the user.
        BusinessRuleError: 400 not a draft.
    """
    raise NotImplementedError


@router.post(
    "/events/{event_id}/cancel",
    response={200: EventDetailOut, 400: ErrorOut, 401: ErrorOut, 403: ErrorOut, 404: ErrorOut, 422: ErrorOut},
    auth=django_auth,
)
def cancel_event(request: HttpRequest, event_id: int, payload: CancelIn) -> EventDetailOut:
    """Cancel an event: owner (US-10) or admin with a reason (US-18).

    Calls `events.services.cancel_event`.

    Returns:
        200 with the card, `is_cancelled=true`.

    Raises:
        NotFoundError: 404 unknown event or draft.
        PermissionDeniedError: 403 neither owner nor admin.
        BusinessRuleError: 400 already cancelled or ended.
        FieldValidationError: 422 (field="reason") admin without a reason.
    """
    raise NotImplementedError
