"""Domain errors raised by services and selectors (architecture.md §3 "All errors are JSON").

Services raise these typed errors instead of returning HTTP responses, so business rules
stay testable without HTTP. One exception handler in `config/api.py` maps every
`DomainError` to `{"detail": ..., "field": ...}` with the class's `status_code` (DRY).
"""


class DomainError(Exception):
    """Base class for every expected, user-facing failure.

    Attributes:
        status_code: HTTP status the API handler answers with.
        detail: Human-readable message shown by the SPA.
        field: Form field the message belongs under ("red message under the field"
            ACs, US-09/16), or None for a general message.
    """

    status_code: int = 400
    detail: str
    field: str | None

    def __init__(self, detail: str, *, field: str | None = None) -> None:
        """Store the message and the optional form field.

        Args:
            detail: Human-readable message.
            field: Name of the input field the error belongs to, if any.
        """
        raise NotImplementedError


class BusinessRuleError(DomainError):
    """A request that is well-formed but not allowed in the current state (400).

    Example: RSVP to a cancelled or ended event (US-06).
    """

    status_code = 400


class AuthenticationFailedError(DomainError):
    """Wrong credentials or no session (401). The SPA redirects to login (US-06 AC)."""

    status_code = 401


class PermissionDeniedError(DomainError):
    """The user is logged in but their role/ownership forbids the action (403, US-19)."""

    status_code = 403


class NotFoundError(DomainError):
    """The object does not exist or must stay invisible to this user (404, US-04/25)."""

    status_code = 404


class ConflictError(DomainError):
    """The action collides with existing state (409): duplicate RSVP, full event, pending request."""

    status_code = 409


class FieldValidationError(DomainError):
    """An input value breaks a form rule (422); `field` names the form field (US-09/16)."""

    status_code = 422
