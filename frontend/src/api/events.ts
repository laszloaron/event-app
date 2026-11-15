/** Reference data, discovery, card, attending and organizing endpoints (architecture.md §3). */
import { request } from "./client";
import type {
  AttendanceOut,
  CityOut,
  DraftOut,
  EventCreateIn,
  EventDetailOut,
  EventListOut,
  EventPatchIn,
  MyEventOut,
  SportOut,
  operations,
} from "./schema";

export type EventSearchParams = operations["events_views_search_events"]["parameters"]["query"];

export function listSports(): Promise<SportOut[]> {
  return request("GET", "/sports");
}

/** US-04: 404 "City not found" for unknown names. */
export function lookupCity(name: string): Promise<CityOut> {
  return request("GET", "/cities/lookup", { query: { name } });
}

/** Map and List share this one call, so count == markers == rows (US-02 AC 2). */
export function searchEvents(query: EventSearchParams): Promise<EventListOut> {
  return request("GET", "/events", { query });
}

export function getEvent(id: number): Promise<EventDetailOut> {
  return request("GET", `/events/${id}`);
}

export function rsvp(id: number): Promise<AttendanceOut> {
  return request("POST", `/events/${id}/rsvp`);
}

/** Cancel my attendance (US-06) or "Remove from my events" (US-07). */
export function cancelRsvp(id: number): Promise<AttendanceOut> {
  return request("DELETE", `/events/${id}/rsvp`);
}

/** Tick "I have paid"; the backend RSVPs too (US-08). */
export function markPaid(id: number): Promise<AttendanceOut> {
  return request("PUT", `/events/${id}/paid`);
}

export function unmarkPaid(id: number): Promise<AttendanceOut> {
  return request("DELETE", `/events/${id}/paid`);
}

export function listMyEvents(): Promise<MyEventOut[]> {
  return request("GET", "/me/events");
}

export function listMyDrafts(): Promise<DraftOut[]> {
  return request("GET", "/me/drafts");
}

export function createEvent(body: EventCreateIn): Promise<EventDetailOut> {
  return request("POST", "/events", { body });
}

export function updateEvent(id: number, body: EventPatchIn): Promise<EventDetailOut> {
  return request("PATCH", `/events/${id}`, { body });
}

export function publishEvent(id: number): Promise<EventDetailOut> {
  return request("POST", `/events/${id}/publish`);
}

export function deleteDraft(id: number): Promise<void> {
  return request("DELETE", `/events/${id}`);
}

/** Organizer (US-10, reason optional) or admin (US-18, reason required). */
export function cancelEvent(id: number, reason: string): Promise<EventDetailOut> {
  return request("POST", `/events/${id}/cancel`, { body: { reason } });
}
