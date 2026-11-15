"""Root Django Ninja API, served under /api/v1.

Mounts every domain router and maps errors to one JSON shape, `{detail, field?}`
(architecture.md §3). accounts and events are mounted at the root with full paths,
because both own endpoints under `/me`.
"""
import logging

from django.http import HttpRequest, HttpResponse
from ninja import NinjaAPI
from ninja.errors import ValidationError

from accounts.views import router as accounts_router
from common.errors import DomainError
from events.views import router as events_router
from inbox.views import router as inbox_router
from moderation.views import router as moderation_router

logger = logging.getLogger(__name__)

api = NinjaAPI(title="EventMap API", version="1")

api.add_router("", accounts_router)
api.add_router("", events_router)
api.add_router("/inbox", inbox_router)
api.add_router("/admin", moderation_router)


@api.exception_handler(DomainError)
def handle_domain_error(request: HttpRequest, exc: DomainError) -> HttpResponse:
    """Turn a service's `DomainError` into `{detail, field}` with `exc.status_code`.

    Args:
        request: Current request.
        exc: The raised domain error.

    Returns:
        JSON response with the error's status code.
    """
    # The one place every rejected action is logged (AGENTS.md: WARNING for rejections).
    logger.warning(
        "Rejected %s %s: %s %s", request.method, request.path, exc.status_code, exc.detail
    )
    return api.create_response(
        request, {"detail": exc.detail, "field": exc.field}, status=exc.status_code
    )


@api.exception_handler(ValidationError)
def handle_validation_error(request: HttpRequest, exc: ValidationError) -> HttpResponse:
    """Reshape Ninja's schema-validation 422 into `{detail, field}` (first error only).

    Keeps one error shape for the SPA's "red message under the field" (US-09/16),
    whether a rule is declared on the schema or checked in a service.

    Args:
        request: Current request.
        exc: Ninja's validation error; `exc.errors[0]["loc"][-1]` names the field.

    Returns:
        422 JSON response.
    """
    first = exc.errors[0] if exc.errors else {}
    # loc is (source, param name, field, ...) for bodies, e.g. ("body", "payload", "title"),
    # or (source, field) for flattened query/path params; nested errors map to the top field.
    loc = [str(part) for part in first.get("loc", ())]
    field = loc[2] if len(loc) > 2 else (loc[-1] if loc else None)
    detail = str(first.get("msg", "Invalid value"))
    logger.warning("Rejected %s %s: 422 invalid %s", request.method, request.path, field)
    return api.create_response(request, {"detail": detail, "field": field}, status=422)
