import { useEffect, useState } from "react";
import { Check, Clock, ExternalLink, Facebook, Globe, Instagram, MapPin, Pencil, Share2, Tag as TagIcon, Users, XCircle } from "lucide-react";
import type { EventDetailOut, MeOut, SocialLinkSchema } from "../../api/schema";
import { ActionBar, ActionRow, Banner, Button, ButtonLink, Checkbox, Dialog, ConfirmDialog, IconButton, InfoRow, Section, TextArea } from "../ui";
import { DateTimeRange, PriceLabel, SportBadge, StatusTags } from "./EventBits";
import { formatPrice } from "../../utils/format";

function socialIcon(link: SocialLinkSchema) {
  const label = link.label.toLowerCase();
  if (label.includes("facebook")) return <Facebook size={22} />;
  if (label.includes("instagram")) return <Instagram size={22} />;
  return <Globe size={22} />;
}

/** Card body: tags, title, info rows and the optional sections (ui_design.md §5.3, US-05/14). */
export function EventCardBody({ event }: { event: EventDetailOut }) {
  const isFull = event.capacity !== null && event.attendee_count >= event.capacity;
  return (
    <div className={`d-card${event.is_cancelled ? " d-card--cancelled" : ""}`}>
      {event.is_cancelled && (
        <Banner variant="danger" icon={<XCircle size={18} />}>
          This event has been cancelled.
        </Banner>
      )}
      {!event.is_cancelled && event.is_ended && (
        <Banner variant="info" icon={<Clock size={18} />}>
          This event has ended.
        </Banner>
      )}
      <StatusTags cancelled={event.is_cancelled} live={event.is_ongoing} paid={event.viewer.has_paid} full={isFull} />
      <SportBadge sport={event.sport} variant="chip" />
      <h2 className="d-card__title">{event.title || "Untitled event"}</h2>

      <div className="d-card__facts">
        {event.start_at && event.end_at && (
          <InfoRow icon={<Clock size={20} />}>
            <DateTimeRange start={event.start_at} end={event.end_at} timeZone={event.timezone} />
          </InfoRow>
        )}
        <InfoRow icon={<MapPin size={20} />} secondary={event.venue_address || undefined}>
          {event.venue_name || "Venue not set"}
        </InfoRow>
        <InfoRow icon={<TagIcon size={20} />}>{event.price ? formatPrice(event.price) : <PriceLabel price={null} />}</InfoRow>
        <InfoRow icon={<Users size={20} />}>
          {event.attendee_count} going{event.capacity !== null && ` · ${event.capacity} ${event.capacity === 1 ? "spot" : "spots"}`}
          {event.capacity !== null && (
            <span className="d-capacity" aria-hidden>
              <span className="d-capacity__fill" style={{ width: `${Math.min(100, (event.attendee_count / event.capacity) * 100)}%` }} />
            </span>
          )}
        </InfoRow>
      </div>

      <Section title="About this event">{event.description && <p>{event.description}</p>}</Section>
      <Section title="About the sport">
        {event.sport_explainer ? <p>{event.sport_explainer}</p> : <p className="d-card__placeholder">No description yet</p>}
      </Section>
      <Section title="Organizer">
        <div className="d-card__organizer">
          <span>{event.organizer.username}</span>
          {event.social_links.length > 0 && (
            <span className="d-card__socials">
              {event.social_links.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="ui-icon-button" aria-label={link.label} title={link.label}>
                  {socialIcon(link)}
                </a>
              ))}
            </span>
          )}
        </div>
      </Section>
    </div>
  );
}

/** Safety net: stop showing a spinner if the reloaded card never arrives (e.g. offline). */
const PENDING_LIMIT_MS = 5000;

interface EventCardActionsProps {
  event: EventDetailOut;
  /** Logged-in role, or null for a visitor. */
  role: MeOut["role"] | null;
  onEdit: () => void;
  /** Visitor clicked "I'm going": go to login and come back (US-06). */
  onLoginToRsvp: () => void;
  onRsvp: () => Promise<void>;
  onCancelRsvp: () => Promise<void>;
  onPaidChange: (paid: boolean) => Promise<void>;
  onCancelEvent: (reason: string) => Promise<void>;
}

/**
 * The card's sticky action area (ui_design.md §5.3 "ActionBar variants"). Which buttons appear comes
 * from the backend's `viewer` flags, so the SPA never re-implements a permission rule (architecture.md
 * §3 "viewer flags"); a visitor still sees "I'm going", which leads to login (US-06).
 */
export function EventCardActions({ event, role, onEdit, onLoginToRsvp, onRsvp, onCancelRsvp, onPaidChange, onCancelEvent }: EventCardActionsProps) {
  const [dialog, setDialog] = useState<"none" | "cancel-attendance" | "cancel-event">("none");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  /** The tick as the user just set it, shown until the reloaded card confirms it (no lag on click). */
  const [paidNow, setPaidNow] = useState<boolean | null>(null);

  // The caller reloads the card after every action (success or not): that ends the pending state,
  // so a button never flashes back to its old label before the new card arrives.
  useEffect(() => {
    setBusy(null);
    setPaidNow(null);
  }, [event]);

  /** Runs one action with its button in the loading state; errors are shown by the caller. */
  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try {
      await action();
    } finally {
      setDialog("none");
      window.setTimeout(() => setBusy((current) => (current === name ? null : current)), PENDING_LIMIT_MS);
    }
  };

  const { viewer } = event;
  const live = event.status === "published" && !event.is_cancelled && !event.is_ended;
  const manage = viewer.can_edit || viewer.can_cancel;
  if (!live && !manage) return null; // US-14: a cancelled card has no action buttons

  const isAdmin = role === "admin";
  const attends = live && !isAdmin; // US-19: no RSVP / paid tick for admins
  const isFull = event.capacity !== null && event.attendee_count >= event.capacity;
  const external = live && (
    <>
      {event.ticket_url && (
        <ButtonLink size="l" href={event.ticket_url} icon={<ExternalLink size={16} />}>
          Get tickets
        </ButtonLink>
      )}
      {event.registration_url && (
        <ButtonLink size="l" href={event.registration_url} icon={<ExternalLink size={16} />}>
          Register
        </ButtonLink>
      )}
    </>
  );
  const hasExternal = live && Boolean(event.ticket_url || event.registration_url);

  return (
    <ActionBar>
      {manage && (
        <ActionRow>
          {viewer.can_edit && (
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={onEdit}>
              {event.status === "draft" ? "Continue editing" : "Edit"}
            </Button>
          )}
          {viewer.can_cancel && (
            <Button variant="danger-outline" onClick={() => setDialog("cancel-event")}>
              Cancel event
            </Button>
          )}
        </ActionRow>
      )}

      {attends && viewer.is_going && (
        <ActionRow>
          <span className="d-going">
            <Check size={18} /> You're going
          </span>
          <Button variant="danger-outline" onClick={() => setDialog("cancel-attendance")}>
            Cancel my attendance
          </Button>
        </ActionRow>
      )}
      {attends && !viewer.is_going && (
        <ActionRow>
          <Button
            size="l"
            grow
            disabled={isFull}
            loading={busy === "rsvp"}
            onClick={() => (role === null ? onLoginToRsvp() : void run("rsvp", onRsvp))}
          >
            {isFull ? "Event is full" : "I'm going"}
          </Button>
          {external}
        </ActionRow>
      )}
      {hasExternal && (!attends || viewer.is_going) && <ActionRow>{external}</ActionRow>}
      {attends && role !== null && !event.is_free && (
        <Checkbox
          label="I have paid"
          checked={paidNow ?? viewer.has_paid}
          disabled={busy !== null || (!viewer.has_paid && !viewer.can_mark_paid)}
          onChange={(e) => {
            const paid = e.target.checked;
            setPaidNow(paid);
            void run("paid", () => onPaidChange(paid));
          }}
        />
      )}

      {dialog === "cancel-attendance" && (
        <ConfirmDialog
          message="You will be removed from the attendee list and from My events."
          confirmLabel="Cancel attendance"
          onConfirm={() => void run("cancel-rsvp", onCancelRsvp)}
          onCancel={() => setDialog("none")}
        />
      )}
      {dialog === "cancel-event" && (
        <Dialog
          title={isAdmin ? "Cancel this event?" : "Are you sure?"}
          onClose={() => setDialog("none")}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDialog("none")}>
                Keep event
              </Button>
              <Button
                variant="danger"
                loading={busy === "cancel-event"}
                disabled={isAdmin && !reason.trim()}
                onClick={() => void run("cancel-event", () => onCancelEvent(reason.trim()))}
              >
                Cancel event
              </Button>
            </>
          }
        >
          <p>Everyone who is going gets a message. The event disappears from the map, the list and search.</p>
          <TextArea
            label={isAdmin ? "Reason (sent to the organizer)" : "Reason (optional)"}
            required={isAdmin}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Dialog>
      )}
    </ActionBar>
  );
}

/** Share button for the card header: the system share sheet, or copy the link (US-11 "share that link"). */
export function ShareButton({ onShare }: { onShare: () => void }) {
  return <IconButton label="Share" icon={<Share2 size={22} />} onClick={onShare} />;
}
