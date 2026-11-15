import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { SearchX } from "lucide-react";
import * as eventsApi from "../api/events";
import { ApiError } from "../api/client";
import { Button, EmptyState, Sheet, Skeleton } from "../components/ui";
import { EventCardActions, EventCardBody, ShareButton } from "../components/domain";
import { useApi, useRefresh } from "../hooks/data";
import { useToast } from "../hooks/toast";
import { useSession } from "../session/session";
import type { OverlayState } from "../routing/useOpenEvent";

/**
 * `/events/:id` – the event card as a Sheet over the screen it was opened from (ui_design.md §5.3, §8.4).
 * ✕ / Back returns to that screen; a direct link closes to the map (US-11).
 * After every action the card and the screen underneath reload (US-06 "count increases", "appears in My events").
 */
export function EventCardRoute() {
  const { id } = useParams();
  const eventId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const refresh = useRefresh();
  const { user, refresh: refreshSession } = useSession();
  const hasBackground = Boolean((location.state as OverlayState | null)?.background);
  const close = useCallback(() => (hasBackground ? navigate(-1) : navigate("/")), [hasBackground, navigate]);
  const card = useApi(Number.isInteger(eventId) ? () => eventsApi.getEvent(eventId) : null, [eventId]);

  /** Runs a write, then reloads every open screen; failures become a toast (e.g. 409 "Event is full"). */
  const act = (write: () => Promise<unknown>, done?: string) => async () => {
    try {
      await write();
      if (done) toast(done);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await refreshSession();
        navigate(`/login?next=${encodeURIComponent(`/events/${eventId}`)}`);
        return;
      }
      toast(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      refresh();
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/events/${eventId}`;
    try {
      if (navigator.share) await navigator.share({ title: card.data?.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      // The user closed the share sheet.
    }
  };

  if (card.error || !Number.isInteger(eventId)) {
    const notFound = !card.error || card.error.status === 404;
    return (
      <Sheet onClose={close}>
        <EmptyState
          icon={<SearchX size={48} />}
          title={notFound ? "This event doesn't exist" : "Couldn't load the event"}
          text={notFound ? "It may have been removed, or the link is wrong." : card.error?.message}
          actions={notFound ? <Button onClick={() => navigate("/")}>Back to the map</Button> : <Button onClick={card.reload}>Try again</Button>}
        />
      </Sheet>
    );
  }

  const event = card.data;
  if (!event) {
    return (
      <Sheet size="tall" onClose={close}>
        <div className="l-stack">
          <Skeleton width="40%" height={22} />
          <Skeleton width="80%" height={32} />
          <Skeleton height={120} />
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      size="tall"
      onClose={close}
      headerActions={<ShareButton onShare={() => void share()} />}
      footer={
        <EventCardActions
          event={event}
          role={user?.role ?? null}
          onEdit={() => navigate(`/events/${event.id}/edit`)}
          onLoginToRsvp={() => navigate(`/login?next=${encodeURIComponent(`/events/${event.id}`)}`)}
          onRsvp={act(() => eventsApi.rsvp(event.id), "You're going! Added to My events")}
          onCancelRsvp={act(() => eventsApi.cancelRsvp(event.id), "Attendance cancelled")}
          onPaidChange={(paid) => act(() => (paid ? eventsApi.markPaid(event.id) : eventsApi.unmarkPaid(event.id)), paid ? "Marked as paid" : undefined)()}
          onCancelEvent={(reason) => act(() => eventsApi.cancelEvent(event.id, reason), "Event cancelled")()}
        />
      }
    >
      <EventCardBody event={event} />
    </Sheet>
  );
}
