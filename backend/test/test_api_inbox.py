"""API tests for the in-app inbox (US-22)."""
from inbox.models import Notification
from test.helpers import ApiTestCase, make_event, make_user


class InboxApiTests(ApiTestCase):
    def setUp(self) -> None:
        self.user = make_user("anna")
        self.other = make_user("bela")
        organizer = make_user("olga", role="organizer")
        self.event = make_event(organizer, title="Fencing night")

    def notify(self, recipient: object = None, **fields: object) -> Notification:
        """Create a notification for `self.user` unless another recipient is given."""
        values: dict[str, object] = {
            "recipient": recipient or self.user,
            "kind": Notification.Kind.EVENT_CANCELLED,
            "event": self.event,
        }
        values.update(fields)
        return Notification.objects.create(**values)

    def test_us22_anonymous_inbox_401(self) -> None:
        self.assertEqual(self.get_json("/inbox").status_code, 401)
        self.assertEqual(self.get_json("/inbox/unread-count").status_code, 401)

    def test_us22_lists_only_own_messages_newest_first(self) -> None:
        first = self.notify()
        second = self.notify(kind=Notification.Kind.EVENT_CHANGED, payload={"changes": []})
        self.notify(recipient=self.other)
        self.login(self.user)

        response = self.get_json("/inbox")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["count"], 2)
        self.assertEqual([m["id"] for m in body["items"]], [second.id, first.id])

    def test_us22_event_message_links_to_card(self) -> None:
        self.notify()
        self.login(self.user)

        item = self.get_json("/inbox").json()["items"][0]

        self.assertEqual(item["event_id"], self.event.id)
        self.assertEqual(item["event_title"], "Fencing night")

    def test_us22_inbox_is_paginated(self) -> None:
        for _ in range(25):
            self.notify()
        self.login(self.user)

        first_page = self.get_json("/inbox").json()
        second_page = self.get_json("/inbox", {"page": 2}).json()

        self.assertEqual(first_page["count"], 25)
        self.assertEqual(len(first_page["items"]), 20)
        self.assertEqual(len(second_page["items"]), 5)

    def test_us22_unread_count(self) -> None:
        self.notify()
        self.notify(is_read=True)
        self.notify(recipient=self.other)
        self.login(self.user)

        response = self.get_json("/inbox/unread-count")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"count": 1})

    def test_us22_open_marks_read(self) -> None:
        note = self.notify()
        self.login(self.user)

        response = self.post_json(f"/inbox/{note.id}/read")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_read"])
        self.assertEqual(self.get_json("/inbox/unread-count").json(), {"count": 0})

    def test_us22_mark_read_twice_is_idempotent(self) -> None:
        note = self.notify(is_read=True)
        self.login(self.user)

        self.assertEqual(self.post_json(f"/inbox/{note.id}/read").status_code, 200)

    def test_us22_cannot_read_others_message_404(self) -> None:
        note = self.notify(recipient=self.other)
        self.login(self.user)

        self.assert_error(self.post_json(f"/inbox/{note.id}/read"), 404)
        note.refresh_from_db()
        self.assertFalse(note.is_read)
