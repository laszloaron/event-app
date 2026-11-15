"""Inbox endpoints (US-22), mounted at `/inbox`."""
from django.http import HttpRequest
from django.db.models import QuerySet
from ninja import Router
from ninja.pagination import PageNumberPagination, paginate
from ninja.security import django_auth

from common.schemas import ErrorOut
from inbox import selectors, services
from inbox.models import Notification
from inbox.schemas import NotificationOut, UnreadCountOut

router = Router(tags=["inbox"], auth=django_auth)


@router.get("", response={200: list[NotificationOut]})
@paginate(PageNumberPagination, page_size=20)
def list_notifications(request: HttpRequest) -> QuerySet[Notification]:
    """Return the user's messages, newest first, 20 per page (architecture.md §3).

    Calls `inbox.selectors.list_notifications`. Ninja wraps the result as
    `{items, count}` and reads `?page=`.

    Returns:
        The queryset to paginate.

    Raises:
        401 (Ninja `django_auth`) when not logged in.
    """
    return selectors.list_notifications(user=request.user)


@router.get("/unread-count", response={200: UnreadCountOut})
def unread_count(request: HttpRequest) -> UnreadCountOut:
    """Return the unread badge count (US-22).

    Calls `inbox.selectors.count_unread`.

    Returns:
        200 `{count}`.
    """
    return {"count": selectors.count_unread(user=request.user)}


@router.post("/{notification_id}/read", response={200: NotificationOut, 404: ErrorOut})
def mark_read(request: HttpRequest, notification_id: int) -> NotificationOut:
    """Mark a message as read when it is opened (US-22).

    Calls `inbox.services.mark_read`.

    Returns:
        200 with the message, `is_read=true`.

    Raises:
        NotFoundError: 404 unknown id or someone else's message.
    """
    return services.mark_read(notification_id=notification_id, user=request.user)
