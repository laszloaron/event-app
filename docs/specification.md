# EventMap – Local Sports Event Discovery

## 1. Objective
Many sports events (e.g. pentathlon, fencing, amateur leagues) are poorly
known, so potential spectators and participants never attend. EventMap is a
mobile-first web app where users see sports events on a map, filter them,
learn what the sport is about, and register or find ticket information.
The first release covers sports only, in one launch region.

## 2. Roles
- **Visitor**: browses map, list and event details without an account.
- **Attendee** (registered): additionally RSVPs and keeps a "My events" list.
- **Organizer** (registered): creates, edits and cancels own events.
- **Admin**: moderates events and organizers.

## 3. Main scenarios
1. "What can I do today?": a user opens the map and sees nearby events.
2. A user filters by sport, date, price and distance, then opens a detail
   page with a sport explainer and the organizer's social media links.
3. An attendee RSVPs to an event and for paid event follows a link to buy a ticket.
4. An organizer publishes an event so it becomes discoverable.

## 4. Acceptance criteria
1. **Nearby today.** Given location permission is granted, when the map is
   opened, then all published events taking place today within the selected
   radius (default 10 km) appear as markers; events outside the radius or
   on other dates do not.
2. **Filtering.** Given the filters sport = "pentathlon", price = "free" and
   date = "this weekend", then only events matching all three are shown, and
   the result count equals the number of markers/list entries.
3. **No results.** If no event matches the filters, the app shows "No events
   found" with a suggestion to widen the radius or change filters; no error
   page appears.
4. **Location denied.** If location permission is denied, the app asks for
   a city name and centers the map on it. An unknown city yields the message
   "City not found" and the map stays unchanged.
5. **Event details.** A detail page shows title, start/end time in the
   venue's local time zone, venue, price or "Free", sport explainer and
   organizer social links. If no explainer exists, "No description yet" is
   shown instead of an empty section.
6. **Event creation.** Given an organizer submits an event with all required
   fields (title, sport, start, end, venue, price), it appears in search
   within 1 minute. If a required field is missing or the end is before the
   start, the event is not published and a field-specific error is shown.
7. **RSVP.** Given an attendee clicks "I'm going" on a free event, the
   attendee count increases by 1 and the event appears in "My events";
   clicking again does not create a duplicate. If the event is at capacity,
   the RSVP is rejected with "Event is full". An unauthenticated visitor 
   attempting to RSVP is redirected to login.
8. **Paid and cancelled events.** For a paid event, "Get tickets" opens the
   organizer's external ticket URL; no payment is processed in the app. When
   an organizer cancels an event, it is labelled "Cancelled", removed from
   the map, and all RSVP'd attendees are notified.

## 5. Uncertainties and chosen interpretation
| Uncertainty | Chosen interpretation |
|---|---|
| Built-in ticketing vs. external links | External links only; in-app payments are out of scope (payments, refunds, VAT add heavy complexity). |
| Where the initial events come from | Organizers enter them manually; automatic import is a later step. |
| Launch region | A single city (e.g. Budapest). |
| Recurring events | Not supported; each occurrence is a separate event. |
| Other categories (e.g. tech events) | The data model uses a generic category, but only sports are offered now. |