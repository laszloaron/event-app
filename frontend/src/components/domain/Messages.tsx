/** Inbox and moderation building blocks: InboxRow, ChangeList, RequestCard, AuditRow (§3.3, §5.8, §5.12). */
import type { ReactNode } from "react";
import { CalendarX2, ChevronDown, ChevronRight, Pencil, ShieldAlert, UserCheck, UserX } from "lucide-react";
import type { AuditLogOut, NotificationOut, OrganizerRequestAdminOut } from "../../api/schema";
import { Button } from "../ui";
import { formatAgo } from "../../utils/format";

interface Change {
  field: string;
  old: unknown;
  new: unknown;
}

/** Form labels for the backend's field names (events.services._snapshot), so messages read like the form. */
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  sport: "Sport",
  start_at: "Start",
  end_at: "End",
  venue_name: "Venue",
  venue_address: "Address",
  lat: "Map pin",
  lng: "Map pin",
  timezone: "Time zone",
  price_amount: "Price",
  price_currency: "Currency",
  description: "Description",
  sport_explainer: "Sport explainer",
  ticket_url: "Ticket link",
  registration_url: "Registration link",
  capacity: "Capacity",
  social_links: "Social links",
};

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Display form of one old/new value: times in the reader's zone, empty → "none", links by label. */
function displayValue(value: unknown, field: string): string {
  if (value === null || value === undefined || value === "") {
    if (field === "price_amount") return "Free";
    return field === "capacity" ? "unlimited" : "none";
  }
  if (typeof value === "string" && ISO_TIME.test(value)) {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }
  if (typeof value === "number") return field === "lat" || field === "lng" ? value.toFixed(4) : String(value);
  if (Array.isArray(value)) {
    const labels = value.map((item) => (typeof item === "object" && item !== null && "label" in item ? String(item.label) : String(item)));
    return labels.length ? labels.join(", ") : "none";
  }
  return String(value);
}

function readChanges(value: unknown): Change[] {
  if (!Array.isArray(value)) return [];
  const items = value.filter((item): item is Change => typeof item === "object" && item !== null && "field" in item);
  // Latitude and longitude change together when the pin moves: show one "Map pin" line.
  return items.filter((item) => !(item.field === "lng" && items.some((other) => other.field === "lat")));
}

/** "Start · ~~Sat 14:00~~ → Sat 16:00" for each changed field (US-22, US-17). */
export function ChangeList({ changes }: { changes: unknown }) {
  const items = readChanges(changes);
  if (!items.length) return null;
  return (
    <dl className="d-changes">
      {items.map((change) => (
        <div key={change.field} className="d-changes__row">
          <dt>{FIELD_LABELS[change.field] ?? change.field}</dt>
          <dd>
            {change.field === "lat" ? (
              <strong>moved</strong>
            ) : (
              <>
                <del>{displayValue(change.old, change.field)}</del> → <strong>{displayValue(change.new, change.field)}</strong>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const KIND_TEXT: Record<NotificationOut["kind"], { icon: ReactNode; text: (title: string) => string }> = {
  event_changed: { icon: <Pencil size={20} />, text: (title) => `${title} was changed` },
  event_cancelled: { icon: <CalendarX2 size={20} />, text: (title) => `${title} was cancelled` },
  admin_edited: { icon: <ShieldAlert size={20} />, text: (title) => `An admin edited your event ${title}` },
  admin_cancelled: { icon: <ShieldAlert size={20} />, text: (title) => `An admin cancelled your event ${title}` },
  organizer_approved: { icon: <UserCheck size={20} />, text: () => "Your organizer request was approved" },
  organizer_rejected: { icon: <UserX size={20} />, text: () => "Your organizer request was rejected" },
};

interface InboxRowProps {
  message: NotificationOut;
  expanded: boolean;
  onToggle: () => void;
  onOpenEvent: (id: number) => void;
}

/** One message; unread = blue dot + bold. Expands in place (accordion, §5.8). */
export function InboxRow({ message, expanded, onToggle, onOpenEvent }: InboxRowProps) {
  const kind = KIND_TEXT[message.kind];
  const reason = typeof message.payload.reason === "string" ? message.payload.reason : "";
  return (
    <div className={`d-inbox-row${message.is_read ? "" : " d-inbox-row--unread"}`}>
      <button type="button" className="d-inbox-row__head" aria-expanded={expanded} onClick={onToggle}>
        <span className="d-inbox-row__dot" aria-label={message.is_read ? undefined : "Unread"} />
        <span className="d-inbox-row__icon">{kind.icon}</span>
        <span className="d-inbox-row__text">
          <span className="d-inbox-row__title">{kind.text(message.event_title ?? "")}</span>
          <span className="d-inbox-row__meta">{formatAgo(message.created_at)}</span>
        </span>
        {expanded ? <ChevronDown size={20} aria-hidden /> : <ChevronRight size={20} aria-hidden />}
      </button>
      {expanded && (
        <div className="d-inbox-row__body">
          <ChangeList changes={message.payload.changes} />
          {reason && <blockquote className="d-quote">{reason}</blockquote>}
          {message.kind === "organizer_approved" && <p className="t-body-s">You can now create events from your Account.</p>}
          {message.kind === "organizer_rejected" && <p className="t-body-s">You can send a new request later from your Account.</p>}
          {message.event_id !== null && (
            <Button variant="secondary" size="s" onClick={() => onOpenEvent(message.event_id!)}>
              Open event
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface RequestCardProps {
  request: OrganizerRequestAdminOut;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}

/** Admin: one pending organizer request with the user's account details and Reject / Approve (US-21). */
export function RequestCard({ request, busy, onApprove, onReject }: RequestCardProps) {
  const joined = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(request.user.date_joined));
  return (
    <article className="d-request">
      <h3 className="t-title-m">{request.user.username}</h3>
      <p className="t-body-s t-muted">
        {request.user.email} · Member since {joined}
      </p>
      <p className="t-body-s">Requested {formatAgo(request.created_at)}</p>
      <div className="d-request__actions">
        <Button variant="danger-outline" disabled={busy} onClick={onReject}>
          Reject
        </Button>
        <Button loading={busy} onClick={onApprove}>
          Approve
        </Button>
      </div>
    </article>
  );
}

const ACTION_TEXT: Record<AuditLogOut["action"], string> = {
  event_edit: "edited",
  event_cancel: "cancelled",
  organizer_approve: "approved organizer",
  organizer_reject: "rejected organizer",
};

/** Admin audit entry; tap to see the changes / reason (§5.12). */
export function AuditRow({ entry, expanded, onToggle }: { entry: AuditLogOut; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="d-inbox-row">
      <button type="button" className="d-inbox-row__head" aria-expanded={expanded} onClick={onToggle}>
        <span className="d-inbox-row__icon">{entry.action.startsWith("organizer") ? <UserCheck size={20} /> : <Pencil size={20} />}</span>
        <span className="d-inbox-row__text">
          <span>
            <strong>{entry.actor_username}</strong> {ACTION_TEXT[entry.action]} {entry.target_type} #{entry.target_id}
          </span>
          <span className="d-inbox-row__meta">{formatAgo(entry.created_at)}</span>
        </span>
        {expanded ? <ChevronDown size={20} aria-hidden /> : <ChevronRight size={20} aria-hidden />}
      </button>
      {expanded && (
        <div className="d-inbox-row__body">
          <ChangeList changes={entry.changes} />
          {entry.reason && <blockquote className="d-quote">{entry.reason}</blockquote>}
          {!entry.reason && readChanges(entry.changes).length === 0 && <p className="t-body-s t-muted">No details.</p>}
        </div>
      )}
    </div>
  );
}
