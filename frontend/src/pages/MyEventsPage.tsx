import { useState } from "react";
import { useNavigate } from "react-router";
import { CalendarDays } from "lucide-react";
import { cancelRsvp, listMyEvents } from "../api/events";
import { Button, EmptyState, Fab, ListGroupLabel, Skeleton, TopBar } from "../components/ui";
import { EventRow } from "../components/domain";
import { useApi, useRefresh } from "../hooks/data";
import { useToast } from "../hooks/toast";
import { groupByDay } from "../utils/format";
import { useOpenEvent } from "../routing/useOpenEvent";
import { can, useSession } from "../session/session";

/**
 * `/my-events` – everything the user RSVP'd to (ui_design.md §5.7, US-07). The backend already drops
 * ended events and sorts ongoing first; cancelled ones stay with a tag until removed.
 */
export function MyEventsPage() {
  const navigate = useNavigate();
  const openEvent = useOpenEvent();
  const toast = useToast();
  const refresh = useRefresh();
  const { user } = useSession();
  const list = useApi(listMyEvents, []);
  const [removing, setRemoving] = useState<number | null>(null);

  const remove = async (id: number) => {
    setRemoving(id);
    try {
      await cancelRsvp(id);
      toast("Removed from My events");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setRemoving(null);
      refresh();
    }
  };

  const events = list.data ?? [];
  return (
    <>
      <TopBar title="My events" />
      <div className="l-page-body">
        {list.loading && (
          <div className="l-page-padded l-stack">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} height={56} />
            ))}
          </div>
        )}
        {list.error && (
          <EmptyState icon={<CalendarDays size={48} />} title="Couldn't load your events" text={list.error.message} actions={<Button onClick={list.reload}>Try again</Button>} />
        )}
        {list.data && events.length === 0 && (
          <EmptyState
            icon={<CalendarDays size={48} />}
            title="No plans yet"
            text="Find something on the map."
            actions={<Button onClick={() => navigate("/")}>Discover events</Button>}
          />
        )}
        {groupByDay(events).map((section) => (
          <div key={section.label}>
            <ListGroupLabel live={section.live}>{section.label}</ListGroupLabel>
            {section.items.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onOpen={() => openEvent(event.id)}
                extraAction={
                  event.is_cancelled && (
                    <Button variant="ghost" size="s" loading={removing === event.id} onClick={() => void remove(event.id)}>
                      Remove from my events
                    </Button>
                  )
                }
              />
            ))}
          </div>
        ))}
      </div>
      {can.organize(user) && <Fab label="Create event" onClick={() => navigate("/events/new")} />}
    </>
  );
}
