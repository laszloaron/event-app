/**
 * Placeholder data so every screen can be clicked through before the API is wired in.
 * Typed with the generated API types (src/api/schema.d.ts), so the screens already consume
 * the real response shapes and swapping in `src/api/*` calls later changes no component props.
 */
import type {
  AuditLogOut,
  DraftOut,
  EventDetailOut,
  EventListItemOut,
  MeOut,
  MyEventOut,
  NotificationOut,
  OrganizerRequestAdminOut,
  SportOut,
} from "../api/schema";

/** ISO timestamp `dayOffset` days from today at the given local hour. */
function at(dayOffset: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** ISO timestamp relative to now, in hours (negative = past). */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export const BUDAPEST = { name: "Budapest", lat: 47.4979, lng: 19.0402 };

export const sports: SportOut[] = [
  { id: 1, name: "Football", slug: "football", kind: "sport", icon: "football" },
  { id: 2, name: "Fencing", slug: "fencing", kind: "sport", icon: "fencing" },
  { id: 3, name: "Running", slug: "running", kind: "sport", icon: "running" },
  { id: 4, name: "Modern pentathlon", slug: "pentathlon", kind: "sport", icon: "pentathlon" },
  { id: 5, name: "Swimming", slug: "swimming", kind: "sport", icon: "swimming" },
  { id: 6, name: "Cycling", slug: "cycling", kind: "sport", icon: "cycling" },
];

const sport = (slug: string): SportOut => sports.find((item) => item.slug === slug) ?? sports[0];

const organizer = { id: 7, username: "bp_sports_club" };

/** Full event cards; the list items below are derived from these. */
export const eventDetails: EventDetailOut[] = [
  {
    id: 1,
    title: "Sunday 5-a-side Cup",
    sport: sport("football"),
    start_at: hoursFromNow(-1),
    end_at: hoursFromNow(1),
    timezone: "Europe/Budapest",
    venue_name: "Margaret Island Stadium",
    venue_address: "Margitsziget, 1138 Budapest",
    lat: 47.5265,
    lng: 19.0476,
    price: null,
    is_free: true,
    is_ongoing: true,
    is_cancelled: false,
    is_ended: false,
    status: "published",
    description: "Friendly 5-a-side tournament for mixed teams. Bring your own team or join one on the spot.",
    sport_explainer: "",
    ticket_url: "",
    registration_url: "https://example.com/register",
    capacity: 40,
    attendee_count: 12,
    social_links: [
      { label: "Facebook", url: "https://facebook.com" },
      { label: "Instagram", url: "https://instagram.com" },
    ],
    organizer,
    published_at: at(-5, 10),
    viewer: { is_going: false, has_paid: false, can_rsvp: true, can_mark_paid: false, can_edit: true, can_cancel: true, can_delete: false, can_publish: false },
  },
  {
    id: 2,
    title: "Budapest Fencing Open – Épée Finals",
    sport: sport("fencing"),
    start_at: at(0, 18),
    end_at: at(0, 21),
    timezone: "Europe/Budapest",
    venue_name: "BOK Sports Hall",
    venue_address: "Dózsa György út 1, 1146 Budapest",
    lat: 47.5076,
    lng: 19.0865,
    price: { amount: "2500", currency: "HUF" },
    is_free: false,
    is_ongoing: false,
    is_cancelled: false,
    is_ended: false,
    status: "published",
    description: "The best épée fencers of the region compete for the title. Seats are not numbered.",
    sport_explainer:
      "Épée is one of the three fencing weapons. Touches score anywhere on the body, and both fencers can score at the same time.",
    ticket_url: "https://example.com/tickets",
    registration_url: "",
    capacity: null,
    attendee_count: 87,
    social_links: [{ label: "Website", url: "https://example.com" }],
    organizer,
    published_at: at(-10, 9),
    viewer: { is_going: true, has_paid: true, can_rsvp: true, can_mark_paid: true, can_edit: true, can_cancel: true, can_delete: false, can_publish: false },
  },
  {
    id: 3,
    title: "Modern Pentathlon Open Day",
    sport: sport("pentathlon"),
    start_at: at(0, 15),
    end_at: at(0, 19),
    timezone: "Europe/Budapest",
    venue_name: "Margaret Island Stadium",
    venue_address: "Margitsziget, 1138 Budapest",
    lat: 47.5265,
    lng: 19.0476,
    price: null,
    is_free: true,
    is_ongoing: false,
    is_cancelled: false,
    is_ended: false,
    status: "published",
    description: "",
    sport_explainer:
      "Modern pentathlon combines fencing, swimming, obstacle course and a final laser-run of running and pistol shooting.",
    ticket_url: "",
    registration_url: "",
    capacity: 30,
    attendee_count: 30,
    social_links: [],
    organizer,
    published_at: at(-3, 12),
    viewer: { is_going: false, has_paid: false, can_rsvp: false, can_mark_paid: false, can_edit: true, can_cancel: true, can_delete: false, can_publish: false },
  },
  {
    id: 4,
    title: "Danube Night Run 10K",
    sport: sport("running"),
    start_at: at(0, 20),
    end_at: at(0, 22),
    timezone: "Europe/Budapest",
    venue_name: "Kopaszi Dam",
    venue_address: "Kopaszi gát, 1117 Budapest",
    lat: 47.4625,
    lng: 19.0644,
    price: { amount: "4900", currency: "HUF" },
    is_free: false,
    is_ongoing: false,
    is_cancelled: false,
    is_ended: false,
    status: "published",
    description: "10 km along the Danube with head torches. Finisher medal for everyone.",
    sport_explainer: "",
    ticket_url: "https://example.com/tickets",
    registration_url: "https://example.com/register",
    capacity: 500,
    attendee_count: 312,
    social_links: [],
    organizer,
    published_at: at(-20, 9),
    viewer: { is_going: false, has_paid: false, can_rsvp: true, can_mark_paid: true, can_edit: true, can_cancel: true, can_delete: false, can_publish: false },
  },
  {
    id: 5,
    title: "Masters Swimming Gala",
    sport: sport("swimming"),
    start_at: at(0, 17),
    end_at: at(0, 20),
    timezone: "Europe/Budapest",
    venue_name: "Alfréd Hajós Swimming Complex",
    venue_address: "Margitsziget, 1138 Budapest",
    lat: 47.5196,
    lng: 19.0457,
    price: null,
    is_free: true,
    is_ongoing: false,
    is_cancelled: false,
    is_ended: false,
    status: "published",
    description: "",
    sport_explainer: "",
    ticket_url: "",
    registration_url: "",
    capacity: null,
    attendee_count: 4,
    social_links: [],
    organizer,
    published_at: at(-2, 9),
    viewer: { is_going: false, has_paid: false, can_rsvp: true, can_mark_paid: false, can_edit: true, can_cancel: true, can_delete: false, can_publish: false },
  },
  {
    id: 6,
    title: "City Park Criterium",
    sport: sport("cycling"),
    start_at: at(1, 10),
    end_at: at(1, 14),
    timezone: "Europe/Budapest",
    venue_name: "City Park",
    venue_address: "Városliget, 1146 Budapest",
    lat: 47.5146,
    lng: 19.0817,
    price: null,
    is_free: true,
    is_ongoing: false,
    is_cancelled: true,
    is_ended: false,
    status: "cancelled",
    description: "Short-circuit bike race around the park.",
    sport_explainer: "",
    ticket_url: "",
    registration_url: "",
    capacity: null,
    attendee_count: 25,
    social_links: [],
    organizer,
    published_at: at(-7, 9),
    viewer: { is_going: true, has_paid: false, can_rsvp: false, can_mark_paid: false, can_edit: false, can_cancel: false, can_delete: false, can_publish: false },
  },
];

const BUDAPEST_DISTANCES: Record<number, number> = { 1: 3.2, 2: 3.7, 3: 3.2, 4: 4.0, 5: 2.4, 6: 3.3 };

/** Discovery results (map + List tab), ongoing first, cancelled ones excluded as the API does. */
export const eventList: EventListItemOut[] = eventDetails
  .filter((event) => !event.is_cancelled)
  .map((event) => ({
    id: event.id,
    title: event.title,
    sport: event.sport ?? sports[0],
    start_at: event.start_at ?? "",
    end_at: event.end_at ?? "",
    timezone: event.timezone,
    venue_name: event.venue_name,
    lat: event.lat ?? BUDAPEST.lat,
    lng: event.lng ?? BUDAPEST.lng,
    price: event.price,
    is_free: event.is_free,
    is_ongoing: event.is_ongoing,
    distance_km: BUDAPEST_DISTANCES[event.id] ?? 1,
  }))
  .sort((a, b) => Number(b.is_ongoing) - Number(a.is_ongoing) || a.start_at.localeCompare(b.start_at));

/** "My events": the RSVP'd ones, including a cancelled one with its tag (US-07). */
export const myEvents: MyEventOut[] = [1, 2, 4, 6].map((id) => {
  const event = eventDetails.find((item) => item.id === id)!;
  return {
    id: event.id,
    title: event.title,
    sport: event.sport ?? sports[0],
    start_at: event.start_at ?? "",
    end_at: event.end_at ?? "",
    timezone: event.timezone,
    venue_name: event.venue_name,
    price: event.price,
    is_free: event.is_free,
    is_ongoing: event.is_ongoing,
    is_cancelled: event.is_cancelled,
    has_paid: event.viewer.has_paid,
  };
});

export const drafts: DraftOut[] = [
  { id: 101, title: "Spring Football Cup", sport: sport("football"), start_at: at(30, 10), updated_at: hoursFromNow(-2) },
  { id: 102, title: "", sport: null, start_at: null, updated_at: hoursFromNow(-72) },
];

export const notifications: NotificationOut[] = [
  {
    id: 1,
    kind: "event_changed",
    event_id: 2,
    event_title: "Budapest Fencing Open – Épée Finals",
    is_read: false,
    created_at: hoursFromNow(-2),
    payload: {
      changes: [
        { field: "Start", old: "17:00", new: "18:00" },
        { field: "Venue", old: "Tüskecsarnok", new: "BOK Sports Hall" },
      ],
    },
  },
  {
    id: 2,
    kind: "event_cancelled",
    event_id: 6,
    event_title: "City Park Criterium",
    is_read: false,
    created_at: hoursFromNow(-20),
    payload: {},
  },
  {
    id: 3,
    kind: "admin_cancelled",
    event_id: 6,
    event_title: "City Park Criterium",
    is_read: true,
    created_at: hoursFromNow(-21),
    payload: { reason: "The park is closed for maintenance on this day." },
  },
  {
    id: 4,
    kind: "organizer_approved",
    event_id: null,
    event_title: null,
    is_read: true,
    created_at: hoursFromNow(-72),
    payload: {},
  },
];

export const organizerRequests: OrganizerRequestAdminOut[] = [
  {
    id: 1,
    status: "pending",
    created_at: hoursFromNow(-48),
    decided_at: null,
    decided_by_id: null,
    user: { id: 21, username: "kata_runs", email: "kata@example.com", date_joined: at(-120, 9) },
  },
  {
    id: 2,
    status: "pending",
    created_at: hoursFromNow(-5),
    decided_at: null,
    decided_by_id: null,
    user: { id: 22, username: "fencing_hu", email: "info@fencing.example", date_joined: at(-15, 9) },
  },
];

export const auditLog: AuditLogOut[] = [
  {
    id: 1,
    action: "event_cancel",
    actor_id: 1,
    actor_username: "admin1",
    target_type: "event",
    target_id: 6,
    changes: [],
    reason: "The park is closed for maintenance on this day.",
    created_at: hoursFromNow(-21),
  },
  {
    id: 2,
    action: "event_edit",
    actor_id: 1,
    actor_username: "admin1",
    target_type: "event",
    target_id: 2,
    changes: [{ field: "Title", old: "Fencing open", new: "Budapest Fencing Open – Épée Finals" }],
    reason: "",
    created_at: hoursFromNow(-30),
  },
  {
    id: 3,
    action: "organizer_approve",
    actor_id: 1,
    actor_username: "admin1",
    target_type: "user",
    target_id: 7,
    changes: [],
    reason: "",
    created_at: hoursFromNow(-72),
  },
];

/** The fake logged-in user (no real login yet). */
export const me: MeOut = {
  id: 7,
  username: "anna_k",
  email: "anna@example.com",
  role: "organizer",
  unread_count: notifications.filter((item) => !item.is_read).length,
  organizer_request_status: "approved",
};
