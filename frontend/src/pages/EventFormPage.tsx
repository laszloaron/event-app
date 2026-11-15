import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { AlertTriangle, Eye, Plus, Trash2, X } from "lucide-react";
import type { EventDetailOut } from "../api/schema";
import * as eventsApi from "../api/events";
import { ApiError } from "../api/client";
import {
  ActionBar,
  ActionRow,
  Banner,
  Button,
  ConfirmDialog,
  DateTimeField,
  IconButton,
  SegmentedControl,
  Section,
  Select,
  Skeleton,
  TextArea,
  TextField,
  TopBar,
} from "../components/ui";
import { EventCardBody, VenuePicker, type LatLng } from "../components/domain";
import { useApi, useRefresh } from "../hooks/data";
import { useSearchArea } from "../hooks/searchArea";
import { useSports } from "../hooks/sports";
import { useToast } from "../hooks/toast";
import { useBack } from "../routing/useBack";
import { useSession } from "../session/session";
import { NotFoundPage } from "./NotFoundPage";
import { browserTimeZone, toLocalInput } from "../utils/dates";
import { zoneCity } from "../utils/format";
import {
  CURRENCIES,
  LINK_LABELS,
  TITLE_MAX,
  changedFields,
  checkValues,
  createBody,
  emptyValues,
  fieldOf,
  previewEvent,
  toBody,
  valuesFromEvent,
  type FieldKey,
  type FormValues,
} from "../utils/eventForm";

type Mode = "create" | "edit";

/** Where the venue map opens before a pin is placed: the search area, else the launch city (spec: one region). */
const LAUNCH_CITY: LatLng = { lat: 47.4979, lng: 19.0402 };

/**
 * `/events/new` and `/events/:id/edit` (ui_design.md §5.10): loads the event for edit, then hands
 * it to the editor. Access rules of §8.5: a cancelled or ended event goes back to its card (US-16
 * "cannot be edited"); no permission (or someone else's draft) shows Not found.
 */
export function EventFormPage({ mode }: { mode: Mode }) {
  const { id } = useParams();
  const eventId = Number(id);
  const loaded = useApi(mode === "edit" && Number.isInteger(eventId) ? () => eventsApi.getEvent(eventId) : null, [mode, eventId]);
  // Load once: later data refreshes (after our own save) must not reset what the user is typing.
  const [event, setEvent] = useState<EventDetailOut | null>(null);
  useEffect(() => {
    if (loaded.data && !event) setEvent(loaded.data);
  }, [loaded.data, event]);

  if (mode === "create") return <EventEditor event={null} />;
  if (loaded.error || !Number.isInteger(eventId)) return <NotFoundPage />;
  if (!event) {
    return (
      <div className="p-form__body">
        <Skeleton height={200} />
        <Skeleton height={200} />
      </div>
    );
  }
  if (!event.viewer.can_edit) {
    return event.is_cancelled || event.is_ended ? <Navigate to={`/events/${event.id}`} replace /> : <NotFoundPage />;
  }
  return <EventEditor event={event} />;
}

/**
 * The form itself (US-09/15/16/17/25). Every field is controlled, so nothing typed is lost when
 * Publish is blocked, when the preview opens (`?preview=1`, §8.2) or when the server rejects a value.
 */
function EventEditor({ event }: { event: EventDetailOut | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const refresh = useRefresh();
  const sports = useSports();
  const { user } = useSession();
  const { area } = useSearchArea();
  const [params, setParams] = useSearchParams();
  const back = useBack(event ? `/events/${event.id}` : "/account");

  const isDraft = !event || event.status === "draft";
  const timeZone = event?.timezone ?? area?.timeZone ?? browserTimeZone();
  const initial = useMemo(() => (event ? valuesFromEvent(event) : emptyValues()), [event]);
  const [values, setValues] = useState<FormValues>(initial);
  const [saved, setSaved] = useState<FormValues>(initial);
  const [serverErrors, setServerErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<"draft" | "publish" | "save" | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const preview = params.get("preview") === "1";

  const set = useCallback(<K extends FieldKey>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setServerErrors((current) => ({ ...current, [key]: undefined }));
  }, []);
  const setPin = useCallback((pin: LatLng) => set("pin", pin), [set]);

  const startMoved = event?.start_at ? values.start !== toLocalInput(event.start_at, timeZone) : true;
  const check = checkValues(values, {
    attendeeCount: event?.attendee_count ?? 0,
    requireFutureStart: isDraft || startMoved,
    timeZone,
  });
  const hasFormatErrors = Object.values(check.errors).some(Boolean);
  const canPublish = !hasFormatErrors && check.missing.length === 0 && !Object.values(check.publishErrors).some(Boolean);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const errorOf = (key: FieldKey) => serverErrors[key] ?? check.errors[key] ?? check.publishErrors[key];

  // Leaving the page with unsaved input asks first (§5.10); the browser asks on reload/close.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const close = () => {
    if (preview) navigate(-1);
    else if (dirty) setConfirmLeave(true);
    else back();
  };

  /** Shows a 422 under its field (US-09/16 "red message under that field"), anything else in the banner. */
  const showError = (error: unknown) => {
    const field = error instanceof ApiError ? fieldOf(error.field) : null;
    const message = error instanceof Error ? error.message : "Something went wrong. Try again.";
    if (field) {
      setServerErrors((current) => ({ ...current, [field]: message }));
      if (preview) navigate(-1);
    } else setFormError(message);
  };

  const run = async (kind: "draft" | "publish" | "save") => {
    setBusy(kind);
    setFormError("");
    try {
      if (!event) {
        const created = await eventsApi.createEvent(createBody(values, timeZone, kind === "publish" ? "publish" : "draft"));
        setSaved(values);
        refresh();
        if (kind === "publish") {
          toast("Event published");
          navigate(`/events/${created.id}`, { replace: true });
        } else {
          toast("Draft saved");
          navigate(`/events/${created.id}/edit`, { replace: true });
        }
        return;
      }
      const changes = changedFields(toBody(saved, timeZone), toBody(values, timeZone));
      if (Object.keys(changes).length) await eventsApi.updateEvent(event.id, changes);
      setSaved(values);
      if (kind === "publish") await eventsApi.publishEvent(event.id);
      refresh();
      if (kind === "draft") {
        toast("Draft saved");
        if (preview) navigate(-1);
        return;
      }
      toast(kind === "publish" ? "Event published" : event.attendee_count ? `Changes saved. ${event.attendee_count} attendees were notified.` : "Changes saved");
      navigate(`/events/${event.id}`, { replace: true });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };

  const sportOptions = sports.map((sport) => ({ value: sport.slug, label: sport.name }));
  const notice = formError && (
    <Banner variant="danger" icon={<AlertTriangle size={18} />}>
      {formError}
    </Banner>
  );

  return (
    <div className="p-form">
      {preview && (
        <div className="p-form__preview">
          <TopBar leading={<IconButton label="Back to editing" icon={<X size={24} />} onClick={() => navigate(-1)} />} title="Preview" />
          <div className="p-form__preview-body">
            <Banner variant="warning" icon={<Eye size={18} />}>
              Preview – not published yet
            </Banner>
            <EventCardBody event={previewEvent(values, event, sports, timeZone, user?.username ?? "")} />
          </div>
          <ActionBar>
            {notice}
            <ActionRow>
              <Button variant="secondary" size="l" onClick={() => navigate(-1)}>
                Back to editing
              </Button>
              {isDraft && (
                <Button size="l" grow loading={busy === "publish"} disabled={!canPublish || busy !== null} onClick={() => void run("publish")}>
                  Publish
                </Button>
              )}
            </ActionRow>
          </ActionBar>
        </div>
      )}

      <div hidden={preview} className="p-form__editor">
        <TopBar leading={<IconButton label="Close" icon={<X size={24} />} onClick={close} />} title={isDraft ? (event ? "Edit draft" : "New event") : "Edit event"} />
        <form className="p-form__body" onSubmit={(e) => e.preventDefault()} noValidate>
          <Section title="Basics" card>
            <TextField
              label="Title"
              required
              maxLength={TITLE_MAX}
              counter={`${values.title.length}/${TITLE_MAX}`}
              value={values.title}
              error={errorOf("title")}
              onChange={(e) => set("title", e.target.value)}
            />
            <Select label="Sport" required placeholder="Choose a sport" value={values.sport} error={errorOf("sport")} options={sportOptions} onChange={(e) => set("sport", e.target.value)} />
          </Section>

          <Section title="When" card>
            <div className="p-form__pair">
              <DateTimeField label="Start" required value={values.start} error={errorOf("start")} onChange={(e) => set("start", e.target.value)} />
              <DateTimeField label="End" required min={values.start || undefined} value={values.end} error={errorOf("end")} onChange={(e) => set("end", e.target.value)} />
            </div>
            <p className="t-body-s t-muted">Times are in {zoneCity(timeZone)} time.</p>
          </Section>

          <Section title="Where" card>
            <TextField label="Venue name" required value={values.venueName} error={errorOf("venueName")} onChange={(e) => set("venueName", e.target.value)} />
            <TextField label="Address" required value={values.venueAddress} error={errorOf("venueAddress")} onChange={(e) => set("venueAddress", e.target.value)} />
            <VenuePicker position={values.pin} fallbackCenter={area ?? LAUNCH_CITY} onChange={setPin} />
            {errorOf("pin") ? (
              <p className="ui-field__error">
                <AlertTriangle size={16} aria-hidden /> {errorOf("pin")}
              </p>
            ) : (
              <p className="t-body-s t-muted">{values.pin ? "Drag the pin to the exact spot." : "Tap the map to place the pin. *"}</p>
            )}
          </Section>

          <Section title="Price" card>
            <SegmentedControl
              label="Price"
              fullWidth
              value={values.paid ? "paid" : "free"}
              onChange={(value) => set("paid", value === "paid")}
              segments={[
                { value: "free", label: "Free" },
                { value: "paid", label: "Paid" },
              ]}
            />
            {values.paid && (
              <>
                <div className="p-form__amount">
                  <TextField
                    label="Amount"
                    required
                    inputMode="decimal"
                    value={values.amount}
                    error={errorOf("amount")}
                    onChange={(e) => set("amount", e.target.value.replace(",", ".").trim())}
                  />
                  <Select
                    label="Currency"
                    required
                    value={values.currency}
                    error={errorOf("currency")}
                    options={CURRENCIES.map((code) => ({ value: code, label: code }))}
                    onChange={(e) => set("currency", e.target.value)}
                  />
                </div>
                <TextField
                  label="Ticket link"
                  type="url"
                  placeholder="https://"
                  value={values.ticketUrl}
                  error={errorOf("ticketUrl")}
                  onChange={(e) => set("ticketUrl", e.target.value.trim())}
                />
              </>
            )}
          </Section>

          <Section title="About" card>
            <TextArea label="Description" value={values.description} error={errorOf("description")} onChange={(e) => set("description", e.target.value)} />
            <TextArea
              label="Sport explainer"
              helper="Explain the sport for newcomers."
              value={values.explainer}
              error={errorOf("explainer")}
              onChange={(e) => set("explainer", e.target.value)}
            />
          </Section>

          <Section title="Links & capacity" card>
            <TextField
              label="Registration link"
              type="url"
              placeholder="https://"
              value={values.registrationUrl}
              error={errorOf("registrationUrl")}
              onChange={(e) => set("registrationUrl", e.target.value.trim())}
            />
            <TextField
              label="Capacity"
              inputMode="numeric"
              helper={event?.attendee_count ? `Leave empty for unlimited. ${event.attendee_count} going now.` : "Leave empty for unlimited."}
              value={values.capacity}
              error={errorOf("capacity")}
              onChange={(e) => set("capacity", e.target.value.trim())}
            />
            <div className="p-form__links">
              <span className="ui-field__label">Social links</span>
              {values.links.map((link, index) => (
                <div key={index} className="p-form__link-row">
                  <Select
                    label="Label"
                    value={link.label}
                    options={LINK_LABELS.map((label) => ({ value: label, label }))}
                    onChange={(e) => set("links", values.links.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))}
                  />
                  <TextField
                    label="URL"
                    type="url"
                    placeholder="https://"
                    value={link.url}
                    onChange={(e) => set("links", values.links.map((item, i) => (i === index ? { ...item, url: e.target.value.trim() } : item)))}
                  />
                  <IconButton label="Remove link" icon={<Trash2 size={20} />} onClick={() => set("links", values.links.filter((_, i) => i !== index))} />
                </div>
              ))}
              {errorOf("links") && (
                <p className="ui-field__error">
                  <AlertTriangle size={16} aria-hidden /> {errorOf("links")}
                </p>
              )}
              <div>
                <Button variant="ghost" size="s" icon={<Plus size={16} />} onClick={() => set("links", [...values.links, { label: LINK_LABELS[0], url: "" }])}>
                  Add link
                </Button>
              </div>
            </div>
          </Section>
        </form>

        <ActionBar>
          {notice}
          {isDraft ? (
            <>
              {check.missing.length > 0 && <p className="t-body-s t-muted">To publish, fill in: {check.missing.join(", ")}</p>}
              {hasFormatErrors && <p className="t-body-s t-muted">Fix the fields marked in red to save.</p>}
              <ActionRow>
                <Button variant="secondary" size="l" loading={busy === "draft"} disabled={hasFormatErrors || busy !== null} onClick={() => void run("draft")}>
                  Save as draft
                </Button>
                <Button variant="ghost" size="l" disabled={!canPublish || busy !== null} onClick={() => setParams({ preview: "1" })}>
                  Preview
                </Button>
                <Button size="l" grow loading={busy === "publish"} disabled={!canPublish || busy !== null} onClick={() => void run("publish")}>
                  Publish
                </Button>
              </ActionRow>
            </>
          ) : (
            <>
              {event && event.attendee_count > 0 && <p className="t-body-s t-muted">{event.attendee_count} attendees will be notified of changes.</p>}
              <ActionRow>
                <Button variant="ghost" size="l" onClick={close}>
                  Discard
                </Button>
                <Button size="l" grow loading={busy === "save"} disabled={!canPublish || !dirty || busy !== null} onClick={() => void run("save")}>
                  Save changes
                </Button>
              </ActionRow>
            </>
          )}
        </ActionBar>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title="Discard changes?"
          message="What you typed since the last save will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={() => {
            setConfirmLeave(false);
            setSaved(values);
            back();
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  );
}
