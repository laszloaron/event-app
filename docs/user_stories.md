Written for: your homework submission (instructor / team reading the EventMap spec).

# EventMap – User Stories

Each story uses the "As a… I want… so that…" form, has Given/When/Then acceptance criteria, and points back to the spec section it comes from.

**Roles used below**
- **Visitor** – not logged in; can browse, search and open event cards.
- **Attendee** – any registered user; can RSVP and has a "My events" list.
- **Organizer** – a registered user whose organizer request was approved by an admin; keeps all attendee features and can also create, edit and cancel own events.
- **Admin** – moderates events and organizers; cannot attend or organize events.

---

## Discovering events

### US-01 – See nearby events today
**As a** visitor, **I want** to open the map and see sports events happening near me today, **so that** I can quickly find something to do.
*Source: Scenario 1, AC 1 · Priority: Must*

**Acceptance criteria**
- *Given* location permission is granted, *when* I open the map, *then* all published events taking place today within 10 km (default radius) appear as markers. This includes events that are already ongoing.
- *Given* an event is outside the radius, on another date, cancelled or already ended, *then* it is not shown.
- *Given* I change the radius, *then* the markers update to match the new radius.

---

### US-02 – Filter events
**As a** visitor, **I want** to filter events by sport, date, price and distance, **so that** I only see events that interest me.
*Source: Scenario 2, AC 2 · Priority: Must*

**Acceptance criteria**
- *Given* filters sport = "pentathlon", price = "free", date = "this weekend", *then* only events matching all three are shown.
- *Then* the displayed result count equals the number of markers and list entries.
- *Then* the filters apply to both the map and the List tab (US-23).
- *When* I clear the filters, *then* the default view (today, 10 km) comes back.

---

### US-03 – Handle empty results
**As a** visitor, **I want** a helpful message when no events match my filters or search, **so that** I know what to change instead of seeing an empty or broken page.
*Source: AC 3 · Priority: Should*

**Acceptance criteria**
- *Given* no event matches the filters or search text, *then* "No events found" is shown with a suggestion to widen the radius or change filters.
- *Then* no error page appears and the filters stay editable.

---

### US-04 – Choose a city when location is denied
**As a** visitor who doesn't share my location, **I want** to type in a city name, **so that** I can still browse events on the map.
*Source: AC 4 · Priority: Must*

**Acceptance criteria**
- *Given* location permission is denied, *when* the map opens, *then* I am asked for a city name.
- *When* I enter a known city (e.g. "Budapest"), *then* the map centers on it, and distances are measured from the city centre.
- *When* I enter an unknown city, *then* "City not found" is shown and the map stays unchanged.

---

### US-23 – Browse events in a list
**As a** visitor, **I want** a List tab showing the same events as the map, **so that** I can scan them in order of time instead of by location.
*Source: Section 1 ("see sports events on a map, filter them…"), AC 2 · Priority: Should*

**Acceptance criteria**
- *Then* the List tab shows exactly the events that the map shows with the same filters and search, and the same result count.
- *Then* ongoing events are at the top, followed by the others sorted by start date and time, earliest first.
- *Then* each entry shows title, sport, start time, venue and price (or "Free").
- *When* I click an entry, *then* its event card opens (US-11).
- *Then* cancelled and ended events are not listed.

---

### US-24 – Search events by name
**As a** visitor, **I want** to search events by their name, **so that** I can find a specific event I've heard about.
*Source: Scenario 2 · Priority: Should*

**Acceptance criteria**
- *When* I type text into the search box, *then* only events whose title contains that text are shown. The match is case-insensitive.
- *Then* the search combines with the active filters and applies to both the map and the List tab.
- *Given* nothing matches, *then* the "No events found" message from US-03 is shown.
- *When* I clear the search box, *then* the results return to the filters-only view.

---

### US-12 – Compact markers on the map
**As a** visitor, **I want** the map to show only each event's name and a small icon, **so that** the map stays readable even when there are many events.
*Source: Scenario 1 · Priority: Must*

**Acceptance criteria**
- *Then* each event on the map shows only its name (shortened with "…" if it is too long) and an info icon. No other details appear on the map.
- *When* I click the icon or the name, *then* the event card for that event opens (US-11).
- *Given* an event is cancelled or has ended, *then* it does not appear on the map.
- *Given* the marker is shown on a phone screen, *then* the clickable area is large enough to tap reliably (at least 44×44 px).

---

### US-13 – Group crowded markers
**As a** visitor, **I want** events that are close together on the map to be grouped into one marker showing a count, **so that** names don't overlap and I can still see where the events are.
*Source: Scenario 1 (extension for crowded maps) · Priority: Should*

**Acceptance criteria**
- *Given* several events would overlap at the current zoom level, *then* they are shown as one group marker with the number of events, e.g. "5".
- *When* I click a group marker, *then* the map zooms in until the events separate. If they share the same venue, a short list of their names opens instead, and clicking a name opens its card.
- *Then* the total of all group and single markers equals the result count shown (consistent with AC 2).

---

## The event card

### US-05 – Learn about the event and the sport
**As a** visitor, **I want** the event card to explain the sport and link to the organizer, **so that** I can understand an unfamiliar sport and decide whether to attend.
*Source: Scenario 2, AC 5 · Priority: Must*

**Acceptance criteria**
- *When* I open an event, *then* I see title, sport, start/end time in the venue's local time zone, venue, price (or "Free"), description, the sport explainer written by the organizer, and the organizer's social media links if provided.
- *Given* the organizer wrote no sport explainer, *then* "No description yet" is shown instead of an empty section.

---

### US-11 – Open the event card from anywhere
**As a** user, **I want** to open the same event card whether I click an event on the map, in the List tab, in "My events" or in an inbox message, **so that** I always get the full information in a consistent way.
*Source: AC 5 (the detail page is the event card) · Priority: Must*

**Acceptance criteria**
- *When* I click an event on the map, in the List tab, in "My events" or in an inbox message, *then* the event card opens.
- *Then* the card shows the same content whichever way I opened it.
- *Then* the card shows the attendee count, and the capacity if one is set.
- *When* I close the card, *then* I return to where I came from, with the same map position, zoom and filters.
- *Given* the card has its own URL, *when* I open or share that link, *then* the same card opens directly.
- *Given* the event is cancelled, *when* anyone opens its link, *then* the card is shown with a "Cancelled" label.

---

### US-14 – Card shows only the information that exists
**As a** visitor, **I want** the event card to hide empty optional fields and show only the actions that apply, **so that** I'm not confused by blank sections or broken buttons.
*Source: AC 5, AC 7, AC 8, plus the optional fields in US-09 · Priority: Must*

**Acceptance criteria**
- *Given* the event has no description, *then* the description section is hidden.
- *Given* the event has a ticket link, *then* a "Get tickets" button opens it externally. Without a ticket link, no "Get tickets" button is shown.
- *Given* the event has a registration link, *then* a "Register" button opens it externally. Without a registration link, no "Register" button is shown.
- *Given* the event has no social links, *then* that section is hidden.
- *Given* the event is cancelled, *then* the card shows a "Cancelled" label and no "I'm going", "Get tickets" or "Register" buttons.

---

## Attending events

### US-06 – RSVP to an event and take it back
**As an** attendee, **I want** to click "I'm going" on an event and be able to withdraw it later, **so that** the organizer knows who is coming and my plans stay up to date.
*Source: Scenario 3, AC 7 · Priority: Must*

**Acceptance criteria**
- *Given* I am logged in and the event is not full, *when* I click "I'm going", *then* the attendee count increases by 1, the event appears in "My events", and the button changes to "Cancel my attendance".
- *Then* "I'm going" is available on both free and paid events. The app does not check whether I have paid; it trusts the user.
- *Then* I cannot RSVP twice to the same event.
- *Given* the event is at capacity, *then* the RSVP is rejected with "Event is full".
- *Given* I am not logged in, *when* I click "I'm going", *then* I am redirected to login.
- *When* I click "Cancel my attendance", *then* an "Are you sure?" dialog appears.
  - *When* I confirm, *then* the attendee count decreases by 1, the event disappears from "My events", and the button changes back to "I'm going".
  - *When* I dismiss the dialog, *then* nothing changes.

---

### US-07 – My events list
**As an** attendee, **I want** a "My events" list of everything I've RSVP'd to, **so that** I can see my upcoming plans in one place.
*Source: Role definition, AC 7 · Priority: Should*

**Acceptance criteria**
- *Given* I RSVP'd to an event, *then* it appears in "My events".
- *Then* ongoing events are at the top, followed by the others sorted by start date, earliest first.
- *Then* events I marked as paid show a "Paid" tag in the list, without my opening the card (US-08).
- *Given* an organizer or admin cancelled an event in my list, *then* it stays in my list with a "Cancelled" tag.
  - *When* I click "Remove from my events" on it, *then* it disappears from my list.
- *Given* an event has ended, *then* it disappears from my list automatically.
- *Given* I am a visitor without an account, or an admin, *then* "My events" is not available.

---

### US-08 – Get tickets and mark them as paid
**As an** attendee, **I want** to buy a ticket on the organizer's site and mark the event as paid in the app, **so that** I don't forget whether I already have a ticket.
*Source: Scenario 3, AC 8, Uncertainty "Ticketing" · Priority: Must*

**Acceptance criteria**
- *Given* a paid event has a ticket link, *then* a "Get tickets" button is shown next to "I'm going". *When* I click it, *then* the organizer's external ticket URL opens.
- *Then* no payment is processed inside EventMap.
- *Given* I am logged in, *then* the card shows an "I have paid" checkbox for paid events.
  - *Then* only I can see my own tick. The organizer and other users cannot, and the app does not verify it.
  - *When* I tick it, *then* "I'm going" is also triggered automatically (rules as in US-06).
  - *When* I cancel my attendance, *then* the tick stays. I can untick it manually.
- *Given* I ticked "I have paid", *then* a "Paid" tag is shown at the top of the event card and in "My events".

---

### US-22 – In-app inbox
**As a** registered user, **I want** an inbox inside the app, **so that** I find out about changes to events I care about and about my account.
*Source: AC 8 ("all RSVP'd attendees are notified") · Priority: Must*

**Acceptance criteria**
- *Then* I receive an inbox message when:
  - an event I RSVP'd to is cancelled (by its organizer or an admin);
  - an event I RSVP'd to is changed; the message lists each changed field as old → new value;
  - an admin edits or cancels one of my own events (organizers only); the message includes the admin's changes or reason;
  - my organizer request is approved or rejected.
- *Then* an unread counter is shown on the inbox icon. Opening a message marks it as read.
- *Then* each event-related message links to the event card (US-11).
- *Then* no emails or push notifications are sent; the inbox is the only channel in this release.

---

## Organizing events

### US-20 – Request to become an organizer
**As a** registered user, **I want** to request organizer permissions from my account, **so that** I can publish events without creating a separate account.
*Source: Role definition · Priority: Must*

**Acceptance criteria**
- *Then* the "My account" tab has a "Become an organizer" button.
- *When* I send the request, *then* its status shows "Pending", and I cannot send another request while one is pending.
- *When* an admin approves it, *then* I get an inbox message, and the organizer features ("Create event", "My drafts", Edit and Cancel on my own events) appear in my account.
- *When* an admin rejects it, *then* I get an inbox message and can send a new request later.
- *Then* I keep all attendee features after becoming an organizer.

---

### US-09 – Create and publish an event
**As an** organizer, **I want** to create an event using a form with required and optional fields, and publish it when it's ready, **so that** people can discover it on the map with as much information as I have.
*Source: Scenario 4, AC 6 · Priority: Must*

**Acceptance criteria**
- *Given* I am an approved organizer, *then* I see a "Create event" option. Other users do not.
- *Given* all required fields (title, sport, start, end, venue, price) are filled in and valid, *when* I click "Publish", *then* the event appears in search within 1 minute.
- *Given* any required field is missing, *then* "Publish" cannot be clicked, but "Save as draft" can (US-25). The values I entered are kept.
- *Given* a field contains an invalid value (end before start, or an invalid URL in a link field), *then* a red message appears under that field, and both "Save as draft" and "Publish" cannot be clicked until it is fixed.
- *Given* I leave optional fields (description, sport explainer, ticket link, registration link, capacity, social links) empty, *then* the event can still be published.
- *Given* the price is "Free", *then* the ticket link field is hidden. *Given* the price is an amount, *then* the ticket link field is shown.
- *Given* I want to repeat an event, *then* I create each occurrence as a separate event.

---

### US-25 – Manage my drafts
**As an** organizer, **I want** a list of my unfinished events, **so that** I can come back later, complete them and publish them.
*Source: Extension of US-09 · Priority: Should*

**Acceptance criteria**
- *Then* a "My drafts" menu is available only to organizers, and it lists only the drafts I created.
- *When* I open a draft, *then* the form opens with all the values I saved. I can keep editing, save again, or publish once it is valid (US-09).
- *When* I delete a draft, *then* an "Are you sure?" dialog appears. After I confirm, the draft is removed.
- *Then* drafts are never visible to anyone else, including admins, and never appear on the map, in the List tab or in search.

---

### US-15 – Preview the event card before publishing
**As an** organizer, **I want** to preview how my event card will look before I publish it, **so that** I can spot missing or wrong information first.
*Source: Scenario 4 · Priority: Could*

**Acceptance criteria**
- *Given* all required fields are valid, *when* I click "Preview", *then* the event card is shown exactly as visitors will see it.
- *Given* "Publish" cannot be clicked (US-09), *then* "Preview" cannot be clicked either.
- *When* I go back from the preview, *then* the form keeps everything I entered.
- *Then* the event is not visible to the public until I click "Publish".

---

### US-16 – Modify my event
**As an** organizer, **I want** to edit any detail of my published event, **so that** I can correct mistakes or react to changes, while attendees are kept informed.
*Source: Role definition ("creates, edits and cancels own events"), AC 6 · Priority: Must*

**Acceptance criteria**
- *Given* I am the organizer of the event, *when* I open it, *then* I see an "Edit" button. *Given* I am not its organizer, *then* no "Edit" button is shown, and a direct edit request is rejected.
- *Then* every field can be edited, including start time, end time and venue. The same validation rules apply as in US-09.
- *When* I save, *then* the changes appear on the event card within 1 minute, and every RSVP'd attendee gets an inbox message listing what changed (US-22).
- *Then* existing RSVPs are kept after a change. Attendees decide themselves whether to cancel their attendance.
- *Given* I reduce the capacity below the current number of RSVPs, *then* the change is rejected with a red message under the capacity field.
- *Given* the event is cancelled or has already ended, *then* it cannot be edited.

---

### US-10 – Cancel my event
**As an** organizer, **I want** to cancel one of my events, **so that** people don't show up to something that isn't happening.
*Source: AC 8 · Priority: Must*

**Acceptance criteria**
- *When* I click "Cancel event", *then* an "Are you sure?" dialog appears.
- *When* I confirm, *then* the event is labelled "Cancelled" and removed from the map, the List tab and search for everybody.
- *Then* its card remains reachable through its link, showing the "Cancelled" label (US-11).
- *Then* every RSVP'd attendee gets an inbox message, and the event stays in their "My events" with a "Cancelled" tag until they remove it (US-07).
- *Given* the event belongs to another organizer, *then* I cannot cancel or edit it.

---

## Administration

### US-21 – Review organizer requests
**As an** admin, **I want** to approve or reject requests to become an organizer, **so that** only trustworthy people can publish events.
*Source: Role definition ("moderates … organizers") · Priority: Must*

**Acceptance criteria**
- *Then* I see a list of pending organizer requests, with the requesting user's account details.
- *When* I approve a request, *then* the user gets organizer features (US-20) and an inbox message.
- *When* I reject a request, *then* the user gets an inbox message and remains a normal attendee.
- *Then* every decision is logged with the admin and the time.

---

### US-17 – Admin modifies any event
**As an** admin, **I want** to edit any organizer's event, **so that** I can fix wrong, misleading or inappropriate content without waiting for the organizer.
*Source: Role definition ("moderates events") · Priority: Should*

**Acceptance criteria**
- *Given* I am logged in as admin, *when* I open any event card, *then* I see an "Edit" button, whoever the organizer is.
- *Then* I can edit every field, including time and venue, with the same validation as US-09.
- *When* I save a change, *then* the organizer gets an inbox message describing my changes, and RSVP'd attendees are notified as in US-16.
- *Then* every admin change is logged with the admin, the time, and the old and new values.
- *Then* the organizer can still edit the event afterwards. Admin changes do not lock the event.

---

### US-18 – Admin cancels any event
**As an** admin, **I want** to cancel any event, **so that** I can remove fake, unsafe or rule-breaking events from the platform.
*Source: Role definition, AC 8 · Priority: Must*

**Acceptance criteria**
- *Given* I am logged in as admin, *when* I open any event card, *then* I see a "Cancel event" button.
- *When* I cancel an event, *then* I must give a reason. The event is then cancelled exactly as in US-10.
- *Then* the organizer and every RSVP'd attendee get an inbox message. The organizer's message includes the reason.
- *Then* the cancellation is logged with the admin, the time and the reason.

---

### US-19 – Admin role restrictions
**As the** platform owner, **I want** admin accounts to be limited to moderation, **so that** admins stay neutral and the attendee and organizer data stays clean.
*Source: Role definition · Priority: Should*

**Acceptance criteria**
- *Given* I am logged in as admin, *then* the "I'm going" button and "I have paid" checkbox are not shown on any event card, and a direct RSVP request is rejected.
- *Given* I am logged in as admin, *then* I have no "My events" list.
- *Given* I am logged in as admin, *then* the "Create event" option and "Become an organizer" button are not shown, and direct requests for them are rejected.
- *Then* "Get tickets" and "Register" buttons remain visible to me, so I can check that the links work.

---

## The event creation form (what the organizer fills in)

| Field | Required? | Notes / validation |
|---|---|---|
| Title | **Required** | 3–100 characters |
| Sport | **Required** | Chosen from a list, e.g. pentathlon, fencing, football |
| Start date & time | **Required** | Must be in the future |
| End date & time | **Required** | Must be after the start |
| Venue | **Required** | Address, plus a pin on the map that sets the coordinates |
| Price | **Required** | Either "Free" or an amount with a currency (e.g. 2 500 HUF) |
| Description | Optional | Free text about this specific event |
| Sport explainer | Optional | What the sport is about, for newcomers; if empty, the card shows "No description yet" |
| Ticket link | Optional | Only offered when the event is paid; must be a valid URL |
| Registration link | Optional | External sign-up page, e.g. for participants; must be a valid URL |
| Capacity | Optional | Positive whole number; empty means unlimited |
| Organizer social links | Optional | Facebook, Instagram, website, etc.; each must be a valid URL |

**Saving rules:** a missing required field blocks only "Publish" (the event can still be saved as a draft). An invalid value blocks both "Save as draft" and "Publish".

---

## Decisions

| Question | Decision |
|---|---|
| Can you RSVP to a paid event? | Yes. Paid events are handled like free ones; the app trusts the user and does not check payment. |
| Who can see a cancelled event? | Anyone with its link sees the card with a "Cancelled" label. It is removed from the map, list and search. |
| How do attendees withdraw? | "I'm going" turns into "Cancel my attendance", with an "Are you sure?" confirmation. |
| What happens after an event ends? | It disappears from the map, the List tab and every "My events" list. Events are visible while ongoing. |
| How are notifications sent? | In-app inbox only. |
| Who writes the sport explainer? | The organizer, as part of the event form. |
| Who can become an organizer? | Any registered user, after an admin approves their request. Same account. |
| Can time and venue be edited? | Yes, every field is editable; RSVP'd attendees get an inbox message about the change. |
| Can an organizer undo an admin's edit? | Yes. Admin edits do not lock the event. |
| Where does distance start when location is denied? | From the centre of the entered city (assumed). |
