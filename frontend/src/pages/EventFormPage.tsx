import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Eye, Plus, Trash2, X } from "lucide-react";
import type { EventDetailOut, SocialLinkSchema } from "../api/schema";
import { ActionBar, ActionRow, Banner, Button, DateTimeField, IconButton, SegmentedControl, Section, Select, TextArea, TextField, TopBar } from "../components/ui";
import { EventCardBody, VenuePicker } from "../components/domain";
import { BUDAPEST, drafts, eventDetails, sports } from "../mocks/data";
import { useBack } from "../routing/useBack";

type Mode = "create" | "edit";

/** `2025-11-15T14:00` for datetime-local inputs, in the viewer's zone (display only for now). */
function toInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

/** The event the form starts from: a published event, a draft, or an empty new one. */
function startingEvent(id: string | undefined): EventDetailOut {
  const published = eventDetails.find((item) => String(item.id) === id);
  if (published) return published;
  const draft = drafts.find((item) => String(item.id) === id);
  const empty = eventDetails[0];
  return {
    ...empty,
    id: draft?.id ?? 0,
    title: draft?.title ?? "",
    sport: draft?.sport ?? null,
    start_at: draft?.start_at ?? null,
    end_at: null,
    venue_name: "",
    venue_address: "",
    price: null,
    is_free: true,
    description: "",
    sport_explainer: "",
    ticket_url: "",
    registration_url: "",
    capacity: null,
    attendee_count: 0,
    social_links: [],
    status: "draft",
    is_ongoing: false,
  };
}

/**
 * Create / edit / continue-a-draft form (ui_design.md §5.10). Fields keep what the user types,
 * but nothing is validated or saved yet; the buttons only navigate.
 * The preview (`?preview=1`, §8.2) is drawn while the form stays mounted, so Back keeps the input.
 */
export function EventFormPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const event = startingEvent(id);
  const isDraft = event.status === "draft";
  const editingPublished = mode === "edit" && !isDraft;
  const [paid, setPaid] = useState(!event.is_free);
  const [links, setLinks] = useState<SocialLinkSchema[]>(event.social_links.length ? event.social_links : [{ label: "Facebook", url: "" }]);
  const preview = params.get("preview") === "1";

  const back = useBack("/account");
  const close = () => (preview ? navigate(-1) : back());
  const openPreview = () => setParams({ preview: "1" });

  return (
    <div className="p-form">
      {preview && (
        <div className="p-form__preview">
          <TopBar leading={<IconButton label="Back to editing" icon={<X size={24} />} onClick={close} />} title="Preview" />
          <div className="p-form__preview-body">
            <Banner variant="warning" icon={<Eye size={18} />}>
              Preview – not published yet
            </Banner>
            <EventCardBody event={event} />
          </div>
          <ActionBar>
            <ActionRow>
              <Button variant="secondary" size="l" onClick={close}>
                Back to editing
              </Button>
              <Button size="l" grow>
                Publish
              </Button>
            </ActionRow>
          </ActionBar>
        </div>
      )}

      <div hidden={preview} className="p-form__editor">
        <TopBar leading={<IconButton label="Close" icon={<X size={24} />} onClick={close} />} title={editingPublished ? "Edit event" : "New event"} />
        <form className="p-form__body" onSubmit={(e) => e.preventDefault()}>
          <Section title="Basics" card>
            <TextField label="Title" required maxLength={100} counter={`${event.title.length}/100`} defaultValue={event.title} />
            <Select
              label="Sport"
              required
              placeholder="Choose a sport"
              defaultValue={event.sport?.slug ?? ""}
              options={sports.map((item) => ({ value: item.slug, label: item.name }))}
            />
          </Section>

          <Section title="When" card>
            <div className="p-form__pair">
              <DateTimeField label="Start" required defaultValue={toInputValue(event.start_at)} />
              <DateTimeField label="End" required defaultValue={toInputValue(event.end_at)} />
            </div>
          </Section>

          <Section title="Where" card>
            <TextField label="Venue name" required defaultValue={event.venue_name} />
            <TextField label="Address" required defaultValue={event.venue_address} />
            <VenuePicker position={{ lat: event.lat ?? BUDAPEST.lat, lng: event.lng ?? BUDAPEST.lng }} />
            <p className="t-body-s t-muted">Drag the pin to the exact spot.</p>
          </Section>

          <Section title="Price" card>
            <SegmentedControl
              label="Price"
              fullWidth
              value={paid ? "paid" : "free"}
              onChange={(value) => setPaid(value === "paid")}
              segments={[
                { value: "free", label: "Free" },
                { value: "paid", label: "Paid" },
              ]}
            />
            {paid && (
              <>
                <div className="p-form__amount">
                  <TextField label="Amount" required inputMode="decimal" defaultValue={event.price?.amount ?? ""} />
                  <Select
                    label="Currency"
                    required
                    defaultValue={event.price?.currency ?? "HUF"}
                    options={["HUF", "EUR", "USD"].map((code) => ({ value: code, label: code }))}
                  />
                </div>
                <TextField label="Ticket link" type="url" placeholder="https://" defaultValue={event.ticket_url} />
              </>
            )}
          </Section>

          <Section title="About" card>
            <TextArea label="Description" defaultValue={event.description} />
            <TextArea label="Sport explainer" helper="Explain the sport for newcomers." defaultValue={event.sport_explainer} />
          </Section>

          <Section title="Links & capacity" card>
            <TextField label="Registration link" type="url" placeholder="https://" defaultValue={event.registration_url} />
            <TextField label="Capacity" inputMode="numeric" helper="Leave empty for unlimited." defaultValue={event.capacity ?? ""} />
            <div className="p-form__links">
              <span className="ui-field__label">Social links</span>
              {links.map((link, index) => (
                <div key={index} className="p-form__link-row">
                  <Select
                    label="Label"
                    defaultValue={link.label}
                    options={["Facebook", "Instagram", "Website"].map((label) => ({ value: label, label }))}
                  />
                  <TextField label="URL" type="url" placeholder="https://" defaultValue={link.url} />
                  <IconButton label="Remove link" icon={<Trash2 size={20} />} onClick={() => setLinks((list) => list.filter((_, i) => i !== index))} />
                </div>
              ))}
              <div>
                <Button variant="ghost" size="s" icon={<Plus size={16} />} onClick={() => setLinks((list) => [...list, { label: "Website", url: "" }])}>
                  Add link
                </Button>
              </div>
            </div>
          </Section>
        </form>

        <ActionBar>
          {editingPublished ? (
            <>
              <p className="t-body-s t-muted">{event.attendee_count} attendees will be notified of changes.</p>
              <ActionRow>
                <Button variant="ghost" size="l" onClick={close}>
                  Discard
                </Button>
                <Button size="l" grow>
                  Save changes
                </Button>
              </ActionRow>
            </>
          ) : (
            <>
              <p className="t-body-s t-muted">To publish, fill in: Venue, Price</p>
              <ActionRow>
                <Button variant="secondary" size="l">
                  Save as draft
                </Button>
                <Button variant="ghost" size="l" onClick={openPreview}>
                  Preview
                </Button>
                <Button size="l" grow>
                  Publish
                </Button>
              </ActionRow>
            </>
          )}
        </ActionBar>
      </div>
    </div>
  );
}
