"""API contract tests for admin moderation endpoints (US-17/18/21)."""
from django.test import tag

from accounts.models import OrganizerRequest, User
from inbox.models import Notification
from moderation.models import AuditLog
from test.helpers import API_CONTRACT_TAG, ApiTestCase, make_user


@tag(API_CONTRACT_TAG)
class OrganizerRequestAdminApiTests(ApiTestCase):
    def setUp(self) -> None:
        self.admin = make_user("adam", role=User.Role.ADMIN)
        self.requester = make_user("anna")
        self.request = OrganizerRequest.objects.create(user=self.requester)

    def test_us21_lists_pending_with_user_details(self) -> None:
        decided = make_user("bela")
        OrganizerRequest.objects.create(user=decided, status=OrganizerRequest.Status.REJECTED)
        self.login(self.admin)

        response = self.get_json("/admin/organizer-requests")

        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual([r["id"] for r in rows], [self.request.id])
        self.assertEqual(rows[0]["user"]["username"], "anna")
        self.assertEqual(rows[0]["user"]["email"], "anna@example.com")

    def test_us21_filter_by_status(self) -> None:
        OrganizerRequest.objects.create(user=make_user("bela"), status=OrganizerRequest.Status.REJECTED)
        self.login(self.admin)

        rows = self.get_json("/admin/organizer-requests", {"status": "rejected"}).json()

        self.assertEqual([r["user"]["username"] for r in rows], ["bela"])

    def test_us21_non_admin_cannot_list_403(self) -> None:
        self.login(make_user("olga", role=User.Role.ORGANIZER))

        self.assert_error(self.get_json("/admin/organizer-requests"), 403)

    def test_us21_anonymous_list_401(self) -> None:
        self.assertEqual(self.get_json("/admin/organizer-requests").status_code, 401)

    def test_us21_approve_sets_role_notifies_and_logs(self) -> None:
        self.login(self.admin)

        response = self.post_json(f"/admin/organizer-requests/{self.request.id}/approve")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], OrganizerRequest.Status.APPROVED)
        self.requester.refresh_from_db()
        self.assertEqual(self.requester.role, User.Role.ORGANIZER)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.requester, kind=Notification.Kind.ORGANIZER_APPROVED
            ).exists()
        )
        log = AuditLog.objects.get(action=AuditLog.Action.ORGANIZER_APPROVE)
        self.assertEqual((log.actor, log.target_id), (self.admin, self.request.id))

    def test_us21_reject_keeps_attendee_notifies_and_logs(self) -> None:
        self.login(self.admin)

        response = self.post_json(f"/admin/organizer-requests/{self.request.id}/reject")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], OrganizerRequest.Status.REJECTED)
        self.requester.refresh_from_db()
        self.assertEqual(self.requester.role, User.Role.ATTENDEE)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.requester, kind=Notification.Kind.ORGANIZER_REJECTED
            ).exists()
        )
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.ORGANIZER_REJECT).exists())

    def test_us21_decision_records_admin_and_time(self) -> None:
        self.login(self.admin)

        body = self.post_json(f"/admin/organizer-requests/{self.request.id}/approve").json()

        self.assertEqual(body["decided_by_id"], self.admin.id)
        self.assertIsNotNone(body["decided_at"])

    def test_us21_decide_twice_409(self) -> None:
        self.login(self.admin)
        self.post_json(f"/admin/organizer-requests/{self.request.id}/approve")

        self.assert_error(self.post_json(f"/admin/organizer-requests/{self.request.id}/reject"), 409)

    def test_us21_unknown_request_404(self) -> None:
        self.login(self.admin)

        self.assert_error(self.post_json("/admin/organizer-requests/999999/approve"), 404)

    def test_us21_non_admin_cannot_approve_403(self) -> None:
        self.login(self.requester)

        self.assert_error(self.post_json(f"/admin/organizer-requests/{self.request.id}/approve"), 403)
        self.requester.refresh_from_db()
        self.assertEqual(self.requester.role, User.Role.ATTENDEE)


@tag(API_CONTRACT_TAG)
class AuditLogApiTests(ApiTestCase):
    def setUp(self) -> None:
        self.admin = make_user("adam", role=User.Role.ADMIN)

    def test_us17_audit_log_newest_first(self) -> None:
        older = AuditLog.objects.create(
            actor=self.admin, action=AuditLog.Action.EVENT_EDIT, target_type="event", target_id=1,
            changes=[{"field": "title", "old": "a", "new": "b"}],
        )
        newer = AuditLog.objects.create(
            actor=self.admin, action=AuditLog.Action.EVENT_CANCEL, target_type="event", target_id=1,
            reason="Fake",
        )
        self.login(self.admin)

        response = self.get_json("/admin/audit-log")

        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual([r["id"] for r in rows], [newer.id, older.id])
        self.assertEqual(rows[0]["actor_username"], "adam")
        self.assertEqual(rows[1]["changes"], [{"field": "title", "old": "a", "new": "b"}])

    def test_us17_non_admin_audit_log_403(self) -> None:
        self.login(make_user("anna"))

        self.assert_error(self.get_json("/admin/audit-log"), 403)
