"""API contract tests for auth and account endpoints (architecture.md §3, US-19/20)."""
from django.test import tag

from accounts.models import OrganizerRequest, User
from test.helpers import API, API_CONTRACT_TAG, ApiTestCase, make_user


@tag(API_CONTRACT_TAG)
class AuthApiTests(ApiTestCase):
    def test_auth_csrf_sets_cookie(self) -> None:
        response = self.get_json("/auth/csrf")

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)

    def test_auth_register_creates_attendee_and_logs_in(self) -> None:
        response = self.post_json(
            "/auth/register",
            {"username": "anna", "email": "anna@example.com", "password": "Str0ng-pass!"},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["role"], User.Role.ATTENDEE)
        self.assertEqual(self.get_json("/me").status_code, 200)

    def test_auth_register_duplicate_username_422(self) -> None:
        make_user("anna")

        response = self.post_json(
            "/auth/register",
            {"username": "anna", "email": "other@example.com", "password": "Str0ng-pass!"},
        )

        self.assert_error(response, 422, field="username")

    def test_auth_register_weak_password_422(self) -> None:
        response = self.post_json(
            "/auth/register", {"username": "anna", "email": "anna@example.com", "password": "123"}
        )

        self.assert_error(response, 422, field="password")

    def test_auth_register_invalid_email_422(self) -> None:
        response = self.post_json(
            "/auth/register", {"username": "anna", "email": "not-an-email", "password": "Str0ng-pass!"}
        )

        self.assert_error(response, 422, field="email")

    def test_auth_login_ok(self) -> None:
        make_user("anna")

        response = self.post_json("/auth/login", {"username": "anna", "password": "pw-123456!"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "anna")
        self.assertIn("sessionid", response.cookies)

    def test_auth_login_wrong_password_401(self) -> None:
        make_user("anna")

        response = self.post_json("/auth/login", {"username": "anna", "password": "wrong"})

        self.assert_error(response, 401)

    def test_auth_logout_ends_session(self) -> None:
        self.login(make_user("anna"))

        response = self.post_json("/auth/logout")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.get_json("/me").status_code, 401)

    def test_auth_logout_anonymous_401(self) -> None:
        self.assertEqual(self.post_json("/auth/logout").status_code, 401)


@tag(API_CONTRACT_TAG)
class MeApiTests(ApiTestCase):
    def test_me_anonymous_401(self) -> None:
        self.assertEqual(self.get_json("/me").status_code, 401)

    def test_me_returns_role_unread_count_and_request_status(self) -> None:
        user = make_user("anna")
        OrganizerRequest.objects.create(user=user)
        self.login(user)

        response = self.get_json("/me")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["role"], User.Role.ATTENDEE)
        self.assertEqual(body["unread_count"], 0)
        self.assertEqual(body["organizer_request_status"], OrganizerRequest.Status.PENDING)

    def test_me_without_request_has_null_status(self) -> None:
        self.login(make_user("anna"))

        self.assertIsNone(self.get_json("/me").json()["organizer_request_status"])


@tag(API_CONTRACT_TAG)
class OrganizerRequestApiTests(ApiTestCase):
    def test_us20_request_created_pending(self) -> None:
        self.login(make_user("anna"))

        response = self.post_json("/me/organizer-request")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], OrganizerRequest.Status.PENDING)

    def test_us20_second_pending_request_409(self) -> None:
        self.login(make_user("anna"))
        self.post_json("/me/organizer-request")

        response = self.post_json("/me/organizer-request")

        self.assert_error(response, 409)

    def test_us20_new_request_allowed_after_rejection(self) -> None:
        user = make_user("anna")
        OrganizerRequest.objects.create(user=user, status=OrganizerRequest.Status.REJECTED)
        self.login(user)

        self.assertEqual(self.post_json("/me/organizer-request").status_code, 201)

    def test_us20_organizer_cannot_request_again_403(self) -> None:
        self.login(make_user("olga", role=User.Role.ORGANIZER))

        self.assert_error(self.post_json("/me/organizer-request"), 403)

    def test_us19_admin_cannot_request_organizer_403(self) -> None:
        self.login(make_user("adam", role=User.Role.ADMIN))

        self.assert_error(self.post_json("/me/organizer-request"), 403)

    def test_us20_anonymous_request_401(self) -> None:
        self.assertEqual(self.client.post(API + "/me/organizer-request").status_code, 401)
