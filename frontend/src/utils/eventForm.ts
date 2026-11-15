/**
 * Event form model: values, the US-09 "Saving rules" and the mapping to the API body.
 *
 * Kept apart from the screen so the rules read as one list: a **format** error blocks both
 * "Save as draft" and "Publish"; a **missing** required field blocks only "Publish" (and "Preview",
 * US-15). The backend checks the same rules again (architecture.md §3 "Where rules live").
 */
import type { EventCreateIn, EventDetailOut, EventPatchIn, SocialLinkSchema, SportOut } from "../api/schema";
import type { LatLng } from "../components/domain";
import { fromLocalInput, toLocalInput } from "../utils/dates";

export interface FormValues {
  title: string;
  sport: string;
  start: string;
  end: string;
  venueName: string;
  venueAddress: string;
  pin: LatLng | null;
  paid: boolean;
  amount: string;
  currency: string;
  ticketUrl: string;
  description: string;
  explainer: string;
  registrationUrl: string;
  capacity: string;
  links: SocialLinkSchema[];
}

export type FieldKey = keyof FormValues;

export const TITLE_MIN = 3;
export const TITLE_MAX = 100;
export const CURRENCIES = ["HUF", "EUR", "USD"];
export const LINK_LABELS = ["Facebook", "Instagram", "Website"];

export function emptyValues(): FormValues {
  return {
    title: "",
    sport: "",
    start: "",
    end: "",
    venueName: "",
    venueAddress: "",
    pin: null,
    paid: false,
    amount: "",
    currency: CURRENCIES[0],
    ticketUrl: "",
    description: "",
    explainer: "",
    registrationUrl: "",
    capacity: "",
    links: [],
  };
}

/** Form values of a saved draft or published event, with times in the venue zone (US-25 "all the values I saved"). */
export function valuesFromEvent(event: EventDetailOut): FormValues {
  return {
    title: event.title,
    sport: event.sport?.slug ?? "",
    start: toLocalInput(event.start_at, event.timezone),
    end: toLocalInput(event.end_at, event.timezone),
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    pin: event.lat !== null && event.lng !== null ? { lat: event.lat, lng: event.lng } : null,
    paid: event.price !== null,
    amount: event.price ? String(Number(event.price.amount)) : "",
    currency: event.price?.currency ?? CURRENCIES[0],
    ticketUrl: event.ticket_url,
    description: event.description,
    explainer: event.sport_explainer,
    registrationUrl: event.registration_url,
    capacity: event.capacity === null ? "" : String(event.capacity),
    links: event.social_links,
  };
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const INVALID_URL = "Enter a full link, e.g. https://example.com";

export interface Check {
  /** Red messages under fields; any of them blocks both buttons (US-09). */
  errors: Partial<Record<FieldKey, string>>;
  /** Red messages that block only Publish/Preview, e.g. a start in the past (publish rule, US-09 table). */
  publishErrors: Partial<Record<FieldKey, string>>;
  /** Labels of empty required fields; they block only Publish/Preview (US-09, US-15). */
  missing: string[];
}

interface CheckContext {
  /** RSVPs already made: capacity may not go below this (US-16). */
  attendeeCount: number;
  /** Publish rule "start must be in the future"; off when editing a started event without moving it (US-16). */
  requireFutureStart: boolean;
  timeZone: string;
}

/** The US-09 form table, field by field. */
export function checkValues(values: FormValues, context: CheckContext): Check {
  const errors: Check["errors"] = {};
  const publishErrors: Check["publishErrors"] = {};
  const missing: string[] = [];
  const title = values.title.trim();

  if (title && title.length < TITLE_MIN) errors.title = `Use at least ${TITLE_MIN} characters`;
  if (values.start && values.end && values.end <= values.start) errors.end = "The end must be after the start";
  if (values.paid && values.amount && !(Number(values.amount) > 0 && /^\d+(\.\d{1,2})?$/.test(values.amount))) {
    errors.amount = "Enter an amount above 0 (at most 2 decimals)";
  }
  if (values.paid && values.ticketUrl && !isUrl(values.ticketUrl)) errors.ticketUrl = INVALID_URL;
  if (values.registrationUrl && !isUrl(values.registrationUrl)) errors.registrationUrl = INVALID_URL;
  if (values.links.some((link) => link.url && !isUrl(link.url))) errors.links = INVALID_URL;
  if (values.capacity) {
    const capacity = Number(values.capacity);
    if (!Number.isInteger(capacity) || capacity <= 0) errors.capacity = "Enter a whole number above 0";
    else if (capacity < context.attendeeCount) errors.capacity = `${context.attendeeCount} people are already going`;
  }

  if (!title) missing.push("Title");
  if (!values.sport) missing.push("Sport");
  if (!values.start) missing.push("Start");
  if (!values.end) missing.push("End");
  if (!values.venueName.trim()) missing.push("Venue name");
  if (!values.venueAddress.trim()) missing.push("Address");
  if (!values.pin) missing.push("Map pin");
  if (values.paid && !values.amount) missing.push("Price");

  if (context.requireFutureStart && values.start) {
    const start = fromLocalInput(values.start, context.timeZone);
    if (start && new Date(start).getTime() <= Date.now()) publishErrors.start = "The start must be in the future";
  }
  return { errors, publishErrors, missing };
}

/** The API body for these values (every field; `null` clears, as the PATCH contract says). */
export function toBody(values: FormValues, timeZone: string): EventPatchIn {
  const text = (value: string) => value.trim() || null;
  return {
    title: text(values.title),
    sport: values.sport || null,
    start_at: fromLocalInput(values.start, timeZone),
    end_at: fromLocalInput(values.end, timeZone),
    timezone: timeZone,
    venue_name: text(values.venueName),
    venue_address: text(values.venueAddress),
    lat: values.pin?.lat ?? null,
    lng: values.pin?.lng ?? null,
    price_amount: values.paid && values.amount ? values.amount : null,
    price_currency: values.paid && values.amount ? values.currency : null,
    ticket_url: values.paid ? text(values.ticketUrl) : null, // US-09: no ticket link on free events
    description: text(values.description),
    sport_explainer: text(values.explainer),
    registration_url: text(values.registrationUrl),
    capacity: values.capacity ? Number(values.capacity) : null,
    social_links: values.links.filter((link) => link.url.trim()).map((link) => ({ label: link.label, url: link.url.trim() })),
  };
}

/**
 * Only the fields that differ from what was loaded, for PATCH. Why: an unchanged start time is not
 * sent, so an ongoing event stays editable (US-16), and attendees are only told about real changes.
 */
export function changedFields(initial: EventPatchIn, current: EventPatchIn): EventPatchIn {
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    if (JSON.stringify(value) !== JSON.stringify(initial[key as keyof EventPatchIn])) changed[key] = value;
  }
  return changed as EventPatchIn;
}

export function createBody(values: FormValues, timeZone: string, action: EventCreateIn["action"]): EventCreateIn {
  return { ...toBody(values, timeZone), action };
}

/** Backend field name → form field, for the red message of a 422 (architecture.md §3 `{detail, field}`). */
export function fieldOf(apiField: string | null): FieldKey | null {
  const map: Record<string, FieldKey> = {
    title: "title",
    sport: "sport",
    start_at: "start",
    end_at: "end",
    timezone: "start",
    venue_name: "venueName",
    venue_address: "venueAddress",
    lat: "pin",
    lng: "pin",
    price_amount: "amount",
    price_currency: "currency",
    ticket_url: "ticketUrl",
    registration_url: "registrationUrl",
    capacity: "capacity",
    social_links: "links",
    description: "description",
    sport_explainer: "explainer",
  };
  return apiField ? map[apiField] ?? null : null;
}

/** The card exactly as visitors will see it, built from the form (US-15: no API call, nothing saved). */
export function previewEvent(values: FormValues, base: EventDetailOut | null, sports: SportOut[], timeZone: string, organizer: string): EventDetailOut {
  const body = toBody(values, timeZone);
  return {
    id: base?.id ?? 0,
    title: body.title ?? "",
    sport: sports.find((sport) => sport.slug === values.sport) ?? null,
    start_at: body.start_at ?? null,
    end_at: body.end_at ?? null,
    timezone: timeZone,
    venue_name: body.venue_name ?? "",
    venue_address: body.venue_address ?? "",
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    price: body.price_amount ? { amount: String(body.price_amount), currency: body.price_currency ?? "" } : null,
    is_free: !body.price_amount,
    description: body.description ?? "",
    sport_explainer: body.sport_explainer ?? "",
    ticket_url: body.ticket_url ?? "",
    registration_url: body.registration_url ?? "",
    capacity: body.capacity ?? null,
    social_links: body.social_links ?? [],
    attendee_count: base?.attendee_count ?? 0,
    organizer: base?.organizer ?? { id: 0, username: organizer },
    status: "published",
    is_cancelled: false,
    is_ended: false,
    is_ongoing: false,
    published_at: null,
    viewer: { is_going: false, has_paid: false, can_rsvp: false, can_mark_paid: false, can_edit: false, can_cancel: false, can_publish: false, can_delete: false },
  };
}
