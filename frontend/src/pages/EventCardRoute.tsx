import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { SearchX } from "lucide-react";
import { Button, EmptyState, Sheet } from "../components/ui";
import { EventCardActions, EventCardBody, ShareButton } from "../components/domain";
import { eventDetails } from "../mocks/data";
import type { OverlayState } from "../routing/useOpenEvent";

/**
 * `/events/:id` – the event card as a Sheet over the screen it was opened from (ui_design.md §5.3, §8.4).
 * ✕ / Back returns to that screen; a direct link closes to the map.
 */
export function EventCardRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasBackground = Boolean((location.state as OverlayState | null)?.background);
  const close = useCallback(() => (hasBackground ? navigate(-1) : navigate("/")), [hasBackground, navigate]);
  const event = eventDetails.find((item) => String(item.id) === id);

  if (!event) {
    return (
      <Sheet onClose={close}>
        <EmptyState
          icon={<SearchX size={48} />}
          title="This event doesn't exist"
          text="It may have been removed, or the link is wrong."
          actions={<Button onClick={() => navigate("/")}>Back to the map</Button>}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      size="tall"
      onClose={close}
      headerActions={<ShareButton />}
      footer={<EventCardActions event={event} onEdit={() => navigate(`/events/${event.id}/edit`)} />}
    >
      <EventCardBody event={event} />
    </Sheet>
  );
}
