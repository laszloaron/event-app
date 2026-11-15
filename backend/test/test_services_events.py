"""Service-level tests for events that need real concurrent transactions."""
import threading

from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone

from accounts.models import User
from common.errors import ConflictError
from events.models import RSVP
from events.services import rsvp
from test.helpers import make_event, make_user


class RsvpCapacityRaceTests(TransactionTestCase):
    """`TransactionTestCase`: each thread needs its own committed transaction to race."""

    def test_us06_capacity_race_last_seat_once(self) -> None:
        organizer = make_user("olga", role=User.Role.ORGANIZER)
        event = make_event(organizer, capacity=1)
        users = [make_user("anna"), make_user("bela")]
        start_together = threading.Barrier(len(users))
        outcomes: list[str] = []
        outcomes_lock = threading.Lock()

        def attempt(user: User) -> None:
            start_together.wait()
            try:
                rsvp(event_id=event.id, user=user, now=timezone.now())
                outcome = "ok"
            except ConflictError as exc:
                outcome = exc.detail
            finally:
                connection.close()  # each thread opened its own DB connection
            with outcomes_lock:
                outcomes.append(outcome)

        threads = [threading.Thread(target=attempt, args=(user,)) for user in users]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        self.assertEqual(sorted(outcomes), ["Event is full", "ok"])
        self.assertEqual(RSVP.objects.filter(event=event).count(), 1)
