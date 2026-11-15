import { useNavigate } from "react-router";
import { CalendarDays } from "lucide-react";
import { Button, EmptyState, Fab, ListGroupLabel, TopBar } from "../components/ui";
import { EventRow } from "../components/domain";
import { myEvents } from "../mocks/data";
import { groupByDay } from "../utils/format";
import { useOpenEvent } from "../routing/useOpenEvent";

/** `/my-events` – everything the user RSVP'd to (ui_design.md §5.7, US-07). */
export function MyEventsPage() {
  const navigate = useNavigate();
  const openEvent = useOpenEvent();
  return (
    <>
      <TopBar title="My events" />
      <div className="l-page-body">
        {myEvents.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={48} />}
            title="No plans yet"
            text="Find something on the map."
            actions={<Button onClick={() => navigate("/")}>Discover events</Button>}
          />
        ) : (
          groupByDay(myEvents).map((section) => (
            <div key={section.label}>
              <ListGroupLabel live={section.live}>{section.label}</ListGroupLabel>
              {section.items.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onOpen={() => openEvent(event.id)}
                  extraAction={
                    event.is_cancelled && (
                      <Button variant="ghost" size="s">
                        Remove from my events
                      </Button>
                    )
                  }
                />
              ))}
            </div>
          ))
        )}
      </div>
      <Fab label="Create event" onClick={() => navigate("/events/new")} />
    </>
  );
}
