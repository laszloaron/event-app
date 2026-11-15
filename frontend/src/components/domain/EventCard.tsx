import { useState } from "react";
import { Check, Clock, ExternalLink, Facebook, Globe, Instagram, MapPin, Pencil, Share2, Tag as TagIcon, Users, XCircle } from "lucide-react";
import type { EventDetailOut, SocialLinkSchema } from "../../api/schema";
import { ActionBar, ActionRow, Banner, Button, Checkbox, Dialog, ConfirmDialog, IconButton, InfoRow, Section, TextArea } from "../ui";
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
          {event.attendee_count} going{event.capacity !== null && ` · ${event.capacity} spots`}
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

/**
 * The card's sticky action area (§5.3 "ActionBar variants"). Role checks come later, so for now
 * it shows the attendee actions and the Edit / Cancel event row together. Buttons do nothing yet,
 * except those that open a dialog.
 */
export function EventCardActions({ event, onEdit }: { event: EventDetailOut; onEdit: () => void }) {
  const [dialog, setDialog] = useState<"none" | "cancel-attendance" | "cancel-event">("none");
  const [reason, setReason] = useState("");
  if (event.is_cancelled) return null;

  const isFull = event.capacity !== null && event.attendee_count >= event.capacity;
  const external = (
    <>
      {event.ticket_url && (
        <Button variant="secondary" size="l" icon={<ExternalLink size={16} />}>
          Get tickets
        </Button>
      )}
      {event.registration_url && (
        <Button variant="secondary" size="l" icon={<ExternalLink size={16} />}>
          Register
        </Button>
      )}
    </>
  );

  return (
    <ActionBar>
      <ActionRow>
        <Button variant="secondary" icon={<Pencil size={16} />} onClick={onEdit}>
          Edit
        </Button>
        <Button variant="danger-outline" onClick={() => setDialog("cancel-event")}>
          Cancel event
        </Button>
      </ActionRow>
      {event.viewer.is_going ? (
        <ActionRow>
          <span className="d-going">
            <Check size={18} /> You're going
          </span>
          <Button variant="danger-outline" onClick={() => setDialog("cancel-attendance")}>
            Cancel my attendance
          </Button>
        </ActionRow>
      ) : (
        <ActionRow>
          <Button size="l" grow disabled={isFull}>
            {isFull ? "Event is full" : "I'm going"}
          </Button>
          {external}
        </ActionRow>
      )}
      {event.viewer.is_going && (event.ticket_url || event.registration_url) && <ActionRow>{external}</ActionRow>}
      {!event.is_free && <Checkbox label="I have paid" defaultChecked={event.viewer.has_paid} />}

      {dialog === "cancel-attendance" && (
        <ConfirmDialog
          message="You will be removed from the attendee list and from My events."
          confirmLabel="Cancel attendance"
          onConfirm={() => setDialog("none")}
          onCancel={() => setDialog("none")}
        />
      )}
      {dialog === "cancel-event" && (
        <Dialog
          title="Cancel this event?"
          onClose={() => setDialog("none")}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDialog("none")}>
                Keep event
              </Button>
              <Button variant="danger" disabled={!reason.trim()} onClick={() => setDialog("none")}>
                Cancel event
              </Button>
            </>
          }
        >
          <p>Everyone who is going gets a message. The event disappears from the map.</p>
          <TextArea label="Reason (sent to the organizer)" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </Dialog>
      )}
    </ActionBar>
  );
}

/** Share button for the card header. */
export function ShareButton() {
  return <IconButton label="Share" icon={<Share2 size={22} />} />;
}
