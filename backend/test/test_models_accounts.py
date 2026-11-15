"""Database constraint tests for accounts models."""
from django.db import IntegrityError, transaction
from django.test import TestCase

from accounts.models import OrganizerRequest, User


class OrganizerRequestConstraintTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username="anna", password="pw-123456!")

    def test_us20_new_user_defaults_to_attendee(self) -> None:
        self.assertEqual(self.user.role, User.Role.ATTENDEE)

    def test_us20_second_pending_request_rejected(self) -> None:
        OrganizerRequest.objects.create(user=self.user)

        with self.assertRaises(IntegrityError), transaction.atomic():
            OrganizerRequest.objects.create(user=self.user)

    def test_us20_new_request_allowed_after_decision(self) -> None:
        OrganizerRequest.objects.create(user=self.user, status=OrganizerRequest.Status.REJECTED)

        OrganizerRequest.objects.create(user=self.user)

        self.assertEqual(self.user.organizer_requests.count(), 2)
