/** Inbox and moderation building blocks: InboxRow, ChangeList, RequestCard, AuditRow (§3.3, §5.8, §5.12). */
import type { ReactNode } from "react";
import { CalendarX2, ChevronDown, ChevronRight, Pencil, ShieldAlert, UserCheck, UserX } from "lucide-react";
import type { AuditLogOut, NotificationOut, OrganizerRequestAdminOut } from "../../api/schema";
import { Button } from "../ui";
import { formatAgo } from "../../utils/format";

interface Change {
  field: string;
  old: string;
  new: string;
}

function readChanges(value: unknown): Change[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Change => typeof item === "object" && item !== null && "field" in item);
}

/** "Start · ~~14:00~~ → 16:00" for each changed field (US-22). */
export function ChangeList({ changes }: { changes: unknown }) {
  const items = readChanges(changes);
  if (!items.length) return null;
  return (
    <dl className="d-changes">
      {items.map((change) => (
        <div key={change.field} className="d-changes__row">
          <dt>{change.field}</dt>
          <dd>
            <del>{String(change.old)}</del> → <strong>{String(change.new)}</strong>
          </dd>
        </div>
      ))}
    </dl>
  );
}

const KIND_TEXT: Record<NotificationOut["kind"], { icon: ReactNode; text: (title: string) => string }> = {
  event_changed: { icon: <Pencil size={20} />, text: (title) => `${title} was changed` },
  event_cancelled: { icon: <CalendarX2 size={20} />, text: (title) => `${title} was cancelled` },
  admin_edited: { icon: <ShieldAlert size={20} />, text: (title) => `An admin edited ${title}` },
  admin_cancelled: { icon: <ShieldAlert size={20} />, text: (title) => `An admin cancelled ${title}` },
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

/** Admin: one pending organizer request with Reject / Approve (US-21). Buttons do nothing yet. */
export function RequestCard({ request }: { request: OrganizerRequestAdminOut }) {
  const joined = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(request.user.date_joined));
  return (
    <article className="d-request">
      <h3 className="t-title-m">{request.user.username}</h3>
      <p className="t-body-s t-muted">
        {request.user.email} · Member since {joined}
      </p>
      <p className="t-body-s">Requested {formatAgo(request.created_at)}</p>
      <div className="d-request__actions">
        <Button variant="danger-outline">Reject</Button>
        <Button>Approve</Button>
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
