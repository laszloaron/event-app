"""API contract tests for reference data, discovery, card, attending and organizing.

Covers US-01..16 and US-23..25 (architecture.md §3).
"""
from datetime import timedelta
from typing import Any

from django.test import tag
from django.utils import timezone

from accounts.models import User
from events.models import RSVP, Event, PaidMark
from inbox.models import Notification
from moderation.models import AuditLog
from test.helpers import (
    API_CONTRACT_TAG,
    BUDAPEST_LAT,
    BUDAPEST_LNG,
    ApiTestCase,
    add_rsvps,
    iso,
    make_city,
    make_event,
    make_paid_event,
    make_sport,
    make_user,
)


class EventApiTestCase(ApiTestCase):
    """Common users for the event tests."""

    def setUp(self) -> None:
        self.organizer = make_user("olga", role=User.Role.ORGANIZER)
        self.other_organizer = make_user("oscar", role=User.Role.ORGANIZER)
        self.attendee = make_user("anna")
        self.attendee2 = make_user("bela")
        self.admin = make_user("adam", role=User.Role.ADMIN)

    def search(self, **params: Any) -> dict[str, Any]:
        """Call `GET /events` around Budapest and return the JSON body (asserts 200)."""
        query: dict[str, Any] = {"lat": BUDAPEST_LAT, "lng": BUDAPEST_LNG}
        query.update(params)
        response = self.get_json("/events", query)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def search_ids(self, **params: Any) -> list[int]:
        """Return the ids of `GET /events`, in response order."""
        return [item["id"] for item in self.search(**params)["items"]]

    @staticmethod
    def form(**overrides: Any) -> dict[str, Any]:
        """Return a complete, valid event form body (US-09 table)."""
        start = timezone.now() + timedelta(days=2)
        body: dict[str, Any] = {
            "title": "Modern pentathlon taster",
            "sport": make_sport("pentathlon").slug,
            "start_at": iso(start),
            "end_at": iso(start + timedelta(hours=3)),
            "venue_name": "Sports centre",
            "venue_address": "2 Park road",
            "lat": BUDAPEST_LAT,
            "lng": BUDAPEST_LNG,
            "price_amount": None,
            "price_currency": None,
        }
        body.update(overrides)
        return body


# --- Reference data -------------------------------------------------------------------


@tag(API_CONTRACT_TAG)
class ReferenceDataApiTests(EventApiTestCase):
    def test_us02_sports_listed_by_name(self) -> None:
        make_sport("pentathlon")
        make_sport("fencing")

        response = self.get_json("/sports")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([s["slug"] for s in response.json()], ["fencing", "pentathlon"])

    def test_us04_known_city_returns_centre(self) -> None:
        make_city("Budapest")

        response = self.get_json("/cities/lookup", {"name": "budapest"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["name"], "Budapest")
        self.assertAlmostEqual(body["lat"], BUDAPEST_LAT, places=3)
        self.assertAlmostEqual(body["lng"], BUDAPEST_LNG, places=3)

    def test_us04_unknown_city_404(self) -> None:
        make_city("Budapest")

        response = self.get_json("/cities/lookup", {"name": "Atlantis"})

        self.assert_error(response, 404)
        self.assertEqual(response.json()["detail"], "City not found")


# --- Discovery ------------------------------------------------------------------------


@tag(API_CONTRACT_TAG)
class SearchEventsApiTests(EventApiTestCase):
    def test_us01_nearby_event_today_listed(self) -> None:
        event = make_event(self.organizer, km_east=2)

        self.assertEqual(self.search_ids(), [event.id])

    def test_us01_ongoing_event_listed(self) -> None:
        event = make_event(self.organizer, starts_in=timedelta(hours=-1))

        body = self.search()

        self.assertEqual([i["id"] for i in body["items"]], [event.id])
        self.assertTrue(body["items"][0]["is_ongoing"])

    def test_us01_outside_default_radius_hidden(self) -> None:
        make_event(self.organizer, km_east=15)

        self.assertEqual(self.search_ids(), [])

    def test_us01_changing_radius_updates_results(self) -> None:
        event = make_event(self.organizer, km_east=15)

        self.assertEqual(self.search_ids(radius_km=20), [event.id])

    def test_us01_ended_cancelled_and_draft_hidden(self) -> None:
        make_event(self.organizer, starts_in=timedelta(hours=-3), duration=timedelta(hours=1))
        make_event(self.organizer, status=Event.Status.CANCELLED)
        make_event(self.organizer, status=Event.Status.DRAFT)

        self.assertEqual(self.search_ids(), [])

    def test_us01_other_date_hidden_by_date_window(self) -> None:
        make_event(self.organizer, starts_in=timedelta(days=5))
        now = timezone.now()

        ids = self.search_ids(date_from=iso(now), date_to=iso(now + timedelta(days=1)))

        self.assertEqual(ids, [])

    def test_us02_filters_combine(self) -> None:
        pentathlon = make_sport("pentathlon")
        match = make_event(self.organizer, sport=pentathlon)
        make_paid_event(self.organizer, sport=pentathlon)
        make_event(self.organizer, sport=make_sport("football"))

        self.assertEqual(self.search_ids(sport=["pentathlon"], price="free"), [match.id])

    def test_us02_count_equals_items(self) -> None:
        for km in (1, 2, 3):
            make_event(self.organizer, km_east=km)

        body = self.search()

        self.assertEqual(body["count"], 3)
        self.assertEqual(len(body["items"]), body["count"])

    def test_us02_max_price_keeps_free_events(self) -> None:
        free = make_event(self.organizer)
        make_paid_event(self.organizer)  # 2500 HUF

        self.assertEqual(self.search_ids(max_price="1000"), [free.id])

    def test_us02_radius_above_50_rejected(self) -> None:
        response = self.get_json("/events", {"lat": BUDAPEST_LAT, "lng": BUDAPEST_LNG, "radius_km": 51})

        self.assert_error(response, 422)

    def test_us03_no_match_is_empty_200(self) -> None:
        body = self.search(q="nothing like this")

        self.assertEqual(body, {"count": 0, "items": []})

    def test_us23_ongoing_first_then_by_start(self) -> None:
        later = make_event(self.organizer, starts_in=timedelta(hours=5))
        sooner = make_event(self.organizer, starts_in=timedelta(hours=1))
        ongoing = make_event(self.organizer, starts_in=timedelta(hours=-1), duration=timedelta(hours=8))

        self.assertEqual(self.search_ids(), [ongoing.id, sooner.id, later.id])

    def test_us23_item_has_list_fields(self) -> None:
        make_paid_event(self.organizer)

        item = self.search()["items"][0]

        for key in ("title", "sport", "start_at", "venue_name", "price", "is_free", "lat", "lng", "distance_km"):
            self.assertIn(key, item)
        self.assertEqual(item["price"]["currency"], "HUF")

    def test_us24_title_search_case_insensitive(self) -> None:
        match = make_event(self.organizer, title="Night Fencing Cup")
        make_event(self.organizer, title="Football")

        self.assertEqual(self.search_ids(q="fencing"), [match.id])


# --- Event card -----------------------------------------------------------------------


@tag(API_CONTRACT_TAG)
class EventCardApiTests(EventApiTestCase):
    def test_us05_card_shows_all_fields(self) -> None:
        event = make_event(
            self.organizer,
            description="Bring sneakers",
            sport_explainer="Five sports in one day",
            social_links=[{"label": "Instagram", "url": "https://instagram.com/x"}],
            capacity=20,
        )
        add_rsvps(event, self.attendee)

        response = self.get_json(f"/events/{event.id}")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["sport_explainer"], "Five sports in one day")
        self.assertEqual(body["timezone"], "Europe/Budapest")
        self.assertEqual(body["organizer"]["username"], "olga")
        self.assertEqual(body["attendee_count"], 1)
        self.assertEqual(body["capacity"], 20)
        self.assertTrue(body["is_free"])

    def test_us11_cancelled_card_reachable_by_link(self) -> None:
        event = make_event(self.organizer, status=Event.Status.CANCELLED)

        response = self.get_json(f"/events/{event.id}")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_cancelled"])

    def test_us14_cancelled_card_offers_no_rsvp(self) -> None:
        event = make_event(self.organizer, status=Event.Status.CANCELLED)
        self.login(self.attendee)

        viewer = self.get_json(f"/events/{event.id}").json()["viewer"]

        self.assertFalse(viewer["can_rsvp"])

    def test_us11_unknown_event_404(self) -> None:
        self.assert_error(self.get_json("/events/999999"), 404)

    def test_us25_draft_hidden_from_others_404(self) -> None:
        draft = make_event(self.organizer, status=Event.Status.DRAFT)

        for viewer in (None, self.attendee, self.other_organizer, self.admin):
            with self.subTest(viewer=viewer):
                self.client.logout()
                if viewer is not None:
                    self.login(viewer)
                self.assert_error(self.get_json(f"/events/{draft.id}"), 404)

    def test_us25_owner_sees_own_draft(self) -> None:
        draft = make_event(self.organizer, status=Event.Status.DRAFT, title="Half done")
        self.login(self.organizer)

        response = self.get_json(f"/events/{draft.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], Event.Status.DRAFT)
        self.assertTrue(response.json()["viewer"]["can_publish"])

    def test_us16_viewer_flags_owner_can_edit(self) -> None:
        event = make_event(self.organizer)
        self.login(self.organizer)

        viewer = self.get_json(f"/events/{event.id}").json()["viewer"]

        self.assertTrue(viewer["can_edit"])
        self.assertTrue(viewer["can_cancel"])

    def test_us16_viewer_flags_other_organizer_cannot_edit(self) -> None:
        event = make_event(self.organizer)
        self.login(self.other_organizer)

        viewer = self.get_json(f"/events/{event.id}").json()["viewer"]

        self.assertFalse(viewer["can_edit"])
        self.assertFalse(viewer["can_cancel"])

    def test_us19_viewer_flags_admin_moderates_not_attends(self) -> None:
        event = make_paid_event(self.organizer)
        self.login(self.admin)

        viewer = self.get_json(f"/events/{event.id}").json()["viewer"]

        self.assertTrue(viewer["can_edit"])
        self.assertTrue(viewer["can_cancel"])
        self.assertFalse(viewer["can_rsvp"])
        self.assertFalse(viewer["can_mark_paid"])


# --- Attending ------------------------------------------------------------------------


@tag(API_CONTRACT_TAG)
class RsvpApiTests(EventApiTestCase):
    def test_us06_rsvp_increments_count(self) -> None:
        event = make_event(self.organizer)
        self.login(self.attendee)

        response = self.post_json(f"/events/{event.id}/rsvp")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["attendee_count"], 1)
        self.assertTrue(response.json()["is_going"])

    def test_us06_rsvp_paid_event_allowed(self) -> None:
        event = make_paid_event(self.organizer)
        self.login(self.attendee)

        self.assertEqual(self.post_json(f"/events/{event.id}/rsvp").status_code, 201)

    def test_us06_duplicate_rsvp_409(self) -> None:
        event = make_event(self.organizer)
        add_rsvps(event, self.attendee)
        self.login(self.attendee)

        self.assert_error(self.post_json(f"/events/{event.id}/rsvp"), 409)

    def test_us06_full_event_409(self) -> None:
        event = make_event(self.organizer, capacity=1)
        add_rsvps(event, self.attendee2)
        self.login(self.attendee)

        response = self.post_json(f"/events/{event.id}/rsvp")

        self.assert_error(response, 409)
        self.assertEqual(response.json()["detail"], "Event is full")

    def test_us06_anonymous_rsvp_401(self) -> None:
        event = make_event(self.organizer)

        self.assertEqual(self.post_json(f"/events/{event.id}/rsvp").status_code, 401)

    def test_us06_rsvp_cancelled_event_400(self) -> None:
        event = make_event(self.organizer, status=Event.Status.CANCELLED)
        self.login(self.attendee)

        self.assert_error(self.post_json(f"/events/{event.id}/rsvp"), 400)

    def test_us06_rsvp_ended_event_400(self) -> None:
        event = make_event(self.organizer, starts_in=timedelta(hours=-3), duration=timedelta(hours=1))
        self.login(self.attendee)

        self.assert_error(self.post_json(f"/events/{event.id}/rsvp"), 400)

    def test_us06_rsvp_draft_404(self) -> None:
        event = make_event(self.organizer, status=Event.Status.DRAFT)
        self.login(self.attendee)

        self.assert_error(self.post_json(f"/events/{event.id}/rsvp"), 404)

    def test_us19_admin_rsvp_403(self) -> None:
        event = make_event(self.organizer)
        self.login(self.admin)

        self.assert_error(self.post_json(f"/events/{event.id}/rsvp"), 403)

    def test_us20_organizer_keeps_attendee_rsvp(self) -> None:
        event = make_event(self.other_organizer)
        self.login(self.organizer)

        self.assertEqual(self.post_json(f"/events/{event.id}/rsvp").status_code, 201)

    def test_us06_cancel_attendance_decrements_count(self) -> None:
        event = make_event(self.organizer)
        add_rsvps(event, self.attendee, self.attendee2)
        self.login(self.attendee)

        response = self.delete(f"/events/{event.id}/rsvp")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["attendee_count"], 1)
        self.assertFalse(response.json()["is_going"])

    def test_us06_cancel_without_rsvp_404(self) -> None:
        event = make_event(self.organizer)
        self.login(self.attendee)

        self.assert_error(self.delete(f"/events/{event.id}/rsvp"), 404)

    def test_us07_remove_cancelled_event_from_my_events(self) -> None:
        event = make_event(self.organizer, status=Event.Status.CANCELLED)
        add_rsvps(event, self.attendee)
        self.login(self.attendee)

        self.assertEqual(self.delete(f"/events/{event.id}/rsvp").status_code, 200)
        self.assertEqual(self.get_json("/me/events").json(), [])


@tag(API_CONTRACT_TAG)
class PaidMarkApiTests(EventApiTestCase):
    def test_us08_mark_paid_also_rsvps(self) -> None:
        event = make_paid_event(self.organizer)
        self.login(self.attendee)

        response = self.put_json(f"/events/{event.id}/paid")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["has_paid"])
        self.assertTrue(response.json()["is_going"])
        self.assertTrue(RSVP.objects.filter(user=self.attendee, event=event).exists())

    def test_us08_mark_paid_twice_is_idempotent(self) -> None:
        event = make_paid_event(self.organizer)
        self.login(self.attendee)
        self.put_json(f"/events/{event.id}/paid")

        self.assertEqual(self.put_json(f"/events/{event.id}/paid").status_code, 200)
        self.assertEqual(PaidMark.objects.filter(user=self.attendee, event=event).count(), 1)

    def test_us08_paid_tick_survives_cancel_attendance(self) -> None:
        event = make_paid_event(self.organizer)
        self.login(self.attendee)
        self.put_json(f"/events/{event.id}/paid")

        response = self.delete(f"/events/{event.id}/rsvp")

        self.assertTrue(response.json()["has_paid"])
        self.assertFalse(response.json()["is_going"])

    def test_us08_unmark_paid_keeps_rsvp(self) -> None:
        event = make_paid_event(self.organizer)
        self.login(self.attendee)
        self.put_json(f"/events/{event.id}/paid")

        response = self.delete(f"/events/{event.id}/paid")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["has_paid"])
        self.assertTrue(response.json()["is_going"])

    def test_us08_mark_paid_free_event_400(self) -> None:
        event = make_event(self.organizer)
        self.login(self.attendee)

        self.assert_error(self.put_json(f"/events/{event.id}/paid"), 400)

    def test_us08_mark_paid_full_event_409(self) -> None:
        event = make_paid_event(self.organizer, capacity=1)
        add_rsvps(event, self.attendee2)
        self.login(self.attendee)

        self.assert_error(self.put_json(f"/events/{event.id}/paid"), 409)

    def test_us08_paid_tick_private_to_user(self) -> None:
        event = make_paid_event(self.organizer)
        PaidMark.objects.create(user=self.attendee, event=event)
        self.login(self.organizer)

        self.assertFalse(self.get_json(f"/events/{event.id}").json()["viewer"]["has_paid"])

    def test_us19_admin_mark_paid_403(self) -> None:
        event = make_paid_event(self.organizer)
        self.login(self.admin)

        self.assert_error(self.put_json(f"/events/{event.id}/paid"), 403)
        self.assert_error(self.delete(f"/events/{event.id}/paid"), 403)


@tag(API_CONTRACT_TAG)
class MyEventsApiTests(EventApiTestCase):
    def test_us07_lists_rsvped_events_ongoing_first(self) -> None:
        later = make_event(self.organizer, starts_in=timedelta(days=2))
        ongoing = make_event(self.organizer, starts_in=timedelta(hours=-1))
        make_event(self.organizer)  # not RSVP'd
        add_rsvps(later, self.attendee)
        add_rsvps(ongoing, self.attendee)
        self.login(self.attendee)

        response = self.get_json("/me/events")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([e["id"] for e in response.json()], [ongoing.id, later.id])

    def test_us07_cancelled_event_stays_with_tag(self) -> None:
        event = make_event(self.organizer, status=Event.Status.CANCELLED)
        add_rsvps(event, self.attendee)
        self.login(self.attendee)

        rows = self.get_json("/me/events").json()

        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["is_cancelled"])

    def test_us07_ended_event_disappears(self) -> None:
        event = make_event(self.organizer, starts_in=timedelta(hours=-3), duration=timedelta(hours=1))
        add_rsvps(event, self.attendee)
        self.login(self.attendee)

        self.assertEqual(self.get_json("/me/events").json(), [])

    def test_us07_paid_tag_in_list(self) -> None:
        event = make_paid_event(self.organizer)
        add_rsvps(event, self.attendee)
        PaidMark.objects.create(user=self.attendee, event=event)
        self.login(self.attendee)

        self.assertTrue(self.get_json("/me/events").json()[0]["has_paid"])

    def test_us07_anonymous_401(self) -> None:
        self.assertEqual(self.get_json("/me/events").status_code, 401)

    def test_us19_admin_has_no_my_events_403(self) -> None:
        self.login(self.admin)

        self.assert_error(self.get_json("/me/events"), 403)


# --- Organizing -----------------------------------------------------------------------


@tag(API_CONTRACT_TAG)
class CreateEventApiTests(EventApiTestCase):
    def test_us09_publish_complete_form_appears_in_search(self) -> None:
        self.login(self.organizer)

        response = self.post_json("/events", {**self.form(), "action": "publish"})

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["status"], Event.Status.PUBLISHED)
        self.client.logout()
        later = timezone.now() + timedelta(days=3)
        self.assertIn(response.json()["id"], self.search_ids(date_to=iso(later)))

    def test_us09_paid_event_with_ticket_link_publishes(self) -> None:
        self.login(self.organizer)
        body = self.form(
            price_amount="2500", price_currency="HUF", ticket_url="https://example.com/t", capacity=30
        )

        response = self.post_json("/events", {**body, "action": "publish"})

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["price"], {"amount": "2500.00", "currency": "HUF"})

    def test_us09_attendee_cannot_create_403(self) -> None:
        self.login(self.attendee)

        self.assert_error(self.post_json("/events", {**self.form(), "action": "publish"}), 403)

    def test_us19_admin_cannot_create_403(self) -> None:
        self.login(self.admin)

        self.assert_error(self.post_json("/events", {**self.form(), "action": "draft"}), 403)

    def test_us09_anonymous_create_401(self) -> None:
        self.assertEqual(self.post_json("/events", {**self.form(), "action": "draft"}).status_code, 401)

    def test_us25_incomplete_draft_saves(self) -> None:
        self.login(self.organizer)

        response = self.post_json("/events", {"title": "Half done", "action": "draft"})

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["status"], Event.Status.DRAFT)
        self.assertEqual(response.json()["title"], "Half done")

    def test_us09_publish_missing_required_field_422(self) -> None:
        self.login(self.organizer)
        body = self.form()
        del body["sport"]

        response = self.post_json("/events", {**body, "action": "publish"})

        self.assert_error(response, 422, field="sport")
        self.assertFalse(Event.objects.exists())

    def test_us09_end_before_start_blocks_draft_422(self) -> None:
        self.login(self.organizer)
        start = timezone.now() + timedelta(days=1)
        body = {"start_at": iso(start), "end_at": iso(start - timedelta(hours=1)), "action": "draft"}

        self.assert_error(self.post_json("/events", body), 422, field="end_at")

    def test_us09_invalid_url_blocks_draft_422(self) -> None:
        self.login(self.organizer)

        response = self.post_json("/events", {"registration_url": "not a url", "action": "draft"})

        self.assert_error(response, 422, field="registration_url")

    def test_us09_title_too_short_422(self) -> None:
        self.login(self.organizer)

        self.assert_error(self.post_json("/events", {"title": "ab", "action": "draft"}), 422, field="title")

    def test_us09_start_in_past_blocks_publish_422(self) -> None:
        self.login(self.organizer)
        start = timezone.now() - timedelta(days=1)
        body = self.form(start_at=iso(start), end_at=iso(start + timedelta(hours=2)))

        self.assert_error(self.post_json("/events", {**body, "action": "publish"}), 422, field="start_at")

    def test_us09_ticket_link_on_free_event_422(self) -> None:
        self.login(self.organizer)
        body = self.form(ticket_url="https://example.com/t")

        self.assert_error(self.post_json("/events", {**body, "action": "publish"}), 422, field="ticket_url")

    def test_us09_amount_without_currency_422(self) -> None:
        self.login(self.organizer)
        body = self.form(price_amount="2500", price_currency=None)

        self.assert_error(self.post_json("/events", {**body, "action": "publish"}), 422, field="price_currency")

    def test_us09_zero_capacity_422(self) -> None:
        self.login(self.organizer)

        self.assert_error(self.post_json("/events", {"capacity": 0, "action": "draft"}), 422, field="capacity")


@tag(API_CONTRACT_TAG)
class DraftsApiTests(EventApiTestCase):
    def test_us25_my_drafts_lists_only_own_drafts(self) -> None:
        own = make_event(self.organizer, status=Event.Status.DRAFT)
        make_event(self.organizer)  # published
        make_event(self.other_organizer, status=Event.Status.DRAFT)
        self.login(self.organizer)

        response = self.get_json("/me/drafts")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([d["id"] for d in response.json()], [own.id])

    def test_us25_attendee_has_no_drafts_403(self) -> None:
        self.login(self.attendee)

        self.assert_error(self.get_json("/me/drafts"), 403)

    def test_us25_publish_complete_draft(self) -> None:
        draft = make_event(self.organizer, status=Event.Status.DRAFT, starts_in=timedelta(days=1))
        self.login(self.organizer)

        response = self.post_json(f"/events/{draft.id}/publish")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], Event.Status.PUBLISHED)
        self.assertIsNotNone(response.json()["published_at"])

    def test_us25_publish_incomplete_draft_422(self) -> None:
        draft = make_event(self.organizer, status=Event.Status.DRAFT, venue_name="")
        self.login(self.organizer)

        self.assert_error(self.post_json(f"/events/{draft.id}/publish"), 422, field="venue_name")

    def test_us25_publish_others_draft_404(self) -> None:
        draft = make_event(self.organizer, status=Event.Status.DRAFT)
        self.login(self.other_organizer)

        self.assert_error(self.post_json(f"/events/{draft.id}/publish"), 404)

    def test_us25_publish_already_published_400(self) -> None:
        event = make_event(self.organizer)
        self.login(self.organizer)

        self.assert_error(self.post_json(f"/events/{event.id}/publish"), 400)

    def test_us25_edit_draft_keeps_draft(self) -> None:
        draft = make_event(self.organizer, status=Event.Status.DRAFT)
        self.login(self.organizer)

        response = self.patch_json(f"/events/{draft.id}", {"title": "Better title"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], Event.Status.DRAFT)
        self.assertEqual(response.json()["title"], "Better title")

    def test_us25_delete_draft_204(self) -> None:
        draft = make_event(self.organizer, status=Event.Status.DRAFT)
        self.login(self.organizer)

        response = self.delete(f"/events/{draft.id}")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Event.objects.filter(pk=draft.id).exists())

    def test_us25_delete_others_draft_404(self) -> None:
        draft = make_event(self.organizer, status=Event.Status.DRAFT)
        self.login(self.admin)

        self.assert_error(self.delete(f"/events/{draft.id}"), 404)

    def test_us25_delete_published_event_400(self) -> None:
        event = make_event(self.organizer)
        self.login(self.organizer)

        self.assert_error(self.delete(f"/events/{event.id}"), 400)


@tag(API_CONTRACT_TAG)
class UpdateEventApiTests(EventApiTestCase):
    def test_us16_owner_edit_notifies_attendees_with_diff(self) -> None:
        event = make_event(self.organizer, title="Old title")
        add_rsvps(event, self.attendee, self.attendee2)
        self.login(self.organizer)

        response = self.patch_json(f"/events/{event.id}", {"title": "New title"})

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["title"], "New title")
        notes = Notification.objects.filter(kind=Notification.Kind.EVENT_CHANGED, event=event)
        self.assertEqual({n.recipient_id for n in notes}, {self.attendee.id, self.attendee2.id})
        self.assertIn(
            {"field": "title", "old": "Old title", "new": "New title"}, notes[0].payload["changes"]
        )

    def test_us16_rsvps_kept_after_edit(self) -> None:
        event = make_event(self.organizer)
        add_rsvps(event, self.attendee)
        self.login(self.organizer)

        self.patch_json(f"/events/{event.id}", {"venue_name": "New hall"})

        self.assertTrue(RSVP.objects.filter(user=self.attendee, event=event).exists())

    def test_us16_no_change_sends_no_notification(self) -> None:
        event = make_event(self.organizer, title="Same")
        add_rsvps(event, self.attendee)
        self.login(self.organizer)

        self.patch_json(f"/events/{event.id}", {"title": "Same"})

        self.assertFalse(Notification.objects.exists())

    def test_us16_other_organizer_edit_403(self) -> None:
        event = make_event(self.organizer)
        self.login(self.other_organizer)

        self.assert_error(self.patch_json(f"/events/{event.id}", {"title": "Hijack"}), 403)

    def test_us16_attendee_edit_403(self) -> None:
        event = make_event(self.organizer)
        self.login(self.attendee)

        self.assert_error(self.patch_json(f"/events/{event.id}", {"title": "Hijack"}), 403)

    def test_us16_capacity_below_rsvps_422(self) -> None:
        event = make_event(self.organizer, capacity=5)
        add_rsvps(event, self.attendee, self.attendee2)
        self.login(self.organizer)

        self.assert_error(self.patch_json(f"/events/{event.id}", {"capacity": 1}), 422, field="capacity")

    def test_us16_same_validation_as_create_422(self) -> None:
        event = make_event(self.organizer)
        self.login(self.organizer)
        new_end = event.start_at - timedelta(hours=1)

        self.assert_error(self.patch_json(f"/events/{event.id}", {"end_at": iso(new_end)}), 422, field="end_at")

    def test_us16_cancelled_event_not_editable_400(self) -> None:
        event = make_event(self.organizer, status=Event.Status.CANCELLED)
        self.login(self.organizer)

        self.assert_error(self.patch_json(f"/events/{event.id}", {"title": "Revive"}), 400)

    def test_us16_ended_event_not_editable_400(self) -> None:
        event = make_event(self.organizer, starts_in=timedelta(hours=-3), duration=timedelta(hours=1))
        self.login(self.organizer)

        self.assert_error(self.patch_json(f"/events/{event.id}", {"title": "Too late"}), 400)

    def test_us17_admin_edit_notifies_organizer_and_logs(self) -> None:
        event = make_event(self.organizer, title="Spam title")
        add_rsvps(event, self.attendee)
        self.login(self.admin)

        response = self.patch_json(f"/events/{event.id}", {"title": "Clean title"})

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.organizer, kind=Notification.Kind.ADMIN_EDITED, event=event
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(recipient=self.attendee, kind=Notification.Kind.EVENT_CHANGED).exists()
        )
        log = AuditLog.objects.get(action=AuditLog.Action.EVENT_EDIT, target_id=event.id)
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.changes, [{"field": "title", "old": "Spam title", "new": "Clean title"}])

    def test_us17_organizer_can_edit_after_admin(self) -> None:
        event = make_event(self.organizer)
        self.login(self.admin)
        self.patch_json(f"/events/{event.id}", {"title": "Admin title"})
        self.login(self.organizer)

        self.assertEqual(self.patch_json(f"/events/{event.id}", {"title": "Own title"}).status_code, 200)

    def test_us16_owner_edit_writes_no_audit(self) -> None:
        event = make_event(self.organizer)
        self.login(self.organizer)

        self.patch_json(f"/events/{event.id}", {"title": "New title"})

        self.assertFalse(AuditLog.objects.exists())


@tag(API_CONTRACT_TAG)
class CancelEventApiTests(EventApiTestCase):
    def test_us10_owner_cancel_hides_and_notifies(self) -> None:
        event = make_event(self.organizer)
        add_rsvps(event, self.attendee)
        self.login(self.organizer)

        response = self.post_json(f"/events/{event.id}/cancel", {})

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()["is_cancelled"])
        self.assertNotIn(event.id, self.search_ids())
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.attendee, kind=Notification.Kind.EVENT_CANCELLED, event=event
            ).exists()
        )

    def test_us10_cancelled_event_stays_in_my_events(self) -> None:
        event = make_event(self.organizer)
        add_rsvps(event, self.attendee)
        self.login(self.organizer)
        self.post_json(f"/events/{event.id}/cancel", {})
        self.login(self.attendee)

        rows = self.get_json("/me/events").json()

        self.assertEqual([(r["id"], r["is_cancelled"]) for r in rows], [(event.id, True)])

    def test_us10_other_organizer_cancel_403(self) -> None:
        event = make_event(self.organizer)
        self.login(self.other_organizer)

        self.assert_error(self.post_json(f"/events/{event.id}/cancel", {}), 403)

    def test_us10_cancel_twice_400(self) -> None:
        event = make_event(self.organizer, status=Event.Status.CANCELLED)
        self.login(self.organizer)

        self.assert_error(self.post_json(f"/events/{event.id}/cancel", {}), 400)

    def test_us18_admin_cancel_requires_reason_422(self) -> None:
        event = make_event(self.organizer)
        self.login(self.admin)

        self.assert_error(self.post_json(f"/events/{event.id}/cancel", {"reason": "  "}), 422, field="reason")

    def test_us18_admin_cancel_notifies_and_logs(self) -> None:
        event = make_event(self.organizer)
        add_rsvps(event, self.attendee)
        self.login(self.admin)

        response = self.post_json(f"/events/{event.id}/cancel", {"reason": "Fake event"})

        self.assertEqual(response.status_code, 200, response.content)
        organizer_note = Notification.objects.get(recipient=self.organizer, kind=Notification.Kind.ADMIN_CANCELLED)
        self.assertEqual(organizer_note.payload["reason"], "Fake event")
        self.assertTrue(
            Notification.objects.filter(recipient=self.attendee, kind=Notification.Kind.EVENT_CANCELLED).exists()
        )
        log = AuditLog.objects.get(action=AuditLog.Action.EVENT_CANCEL, target_id=event.id)
        self.assertEqual((log.actor, log.reason), (self.admin, "Fake event"))
