"""Unversioned health probe at /api/health.

It lives outside the versioned NinjaAPI because the compose healthcheck depends on it,
and an infrastructure probe should not move when the API version changes
(docs/architecture.md §3).
"""
import logging

from django.db import connection
from django.http import HttpRequest, JsonResponse

logger = logging.getLogger(__name__)


def health(request: HttpRequest) -> JsonResponse:
    """Report whether the backend can reach the database.

    A real `SELECT 1` round-trip makes the probe cover the whole chain:
    nginx -> backend -> db.

    Returns:
        200 `{"status": "ok", "database": "ok"}` when the database answers,
        otherwise 503 `{"status": "error", "database": "unavailable"}`.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as exc:  # noqa: BLE001 - any DB failure means "unhealthy"
        logger.warning("Health check failed: database unavailable (%s)", type(exc).__name__)
        return JsonResponse({"status": "error", "database": "unavailable"}, status=503)
    return JsonResponse({"status": "ok", "database": "ok"})
