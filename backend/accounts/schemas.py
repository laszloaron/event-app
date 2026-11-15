"""Ninja I/O schemas for auth and the account endpoints (architecture.md §3 "Auth & account").

Output schemas are `ModelSchema`s (field names/types come from the models and flow into
the generated frontend types); input schemas are hand-written forms.
"""
from ninja import Field, ModelSchema, Schema

from accounts.models import OrganizerRequest, User
from common.schemas import OUT_MODEL_CONFIG


class RegisterIn(Schema):
    """Registration form.

    Email format and password strength are checked in `register_user` with Django's own
    validators, so no extra dependency (pydantic `EmailStr` needs `email-validator`).
    """

    username: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=1)


class LoginIn(Schema):
    """Login form."""

    username: str
    password: str


class UserOut(ModelSchema):
    """Public view of the logged-in user, returned after register/login."""

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = User
        fields = ["id", "username", "role"]


class MeOut(ModelSchema):
    """Everything the SPA needs to show/hide role-dependent UI (US-07/09/19/20/22).

    The two extra fields are not on `User`: the view supplies them from
    `inbox.selectors.count_unread` and `accounts.selectors.get_latest_organizer_request`.
    """

    unread_count: int  # inbox badge, US-22
    organizer_request_status: OrganizerRequest.Status | None  # latest request, US-20

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = User
        fields = ["id", "username", "email", "role"]


class OrganizerRequestOut(ModelSchema):
    """The user's own organizer request (US-20)."""

    model_config = OUT_MODEL_CONFIG

    class Meta:
        model = OrganizerRequest
        fields = ["id", "status", "created_at", "decided_at"]
