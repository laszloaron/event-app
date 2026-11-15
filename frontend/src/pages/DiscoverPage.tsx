import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { LocateFixed, SlidersHorizontal } from "lucide-react";
import type { EventListItemOut } from "../api/schema";
import { Fab, IconButton, ListGroupLabel, SegmentedControl } from "../components/ui";
import { CityPrompt, ClusterList, EventMap, EventRow, FilterChips, FilterSheet, SearchBox, type FilterSection } from "../components/domain";
import { BUDAPEST, eventList } from "../mocks/data";
import { groupByDay } from "../utils/format";
import { useOpenEvent } from "../routing/useOpenEvent";
import { useSession } from "../session/session";

type View = "map" | "list";

/**
 * Discover (ui_design.md §5.1, §5.2): search, filter chips, Map | List and the result count.
 * Phone shows map or list; desktop shows the list panel next to the map. Search and filters are
 * visual only for now – the mock results never change.
 */
export function DiscoverPage({ view }: { view: View }) {
  const navigate = useNavigate();
  const location = useLocation();
  const openEvent = useOpenEvent();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterSection | null>(null);
  const [cityPrompt, setCityPrompt] = useState(false);
  const [group, setGroup] = useState<EventListItemOut[] | null>(null);
  const events = eventList;

  const switchView = (next: View) => navigate({ pathname: next === "map" ? "/" : "/list", search: location.search });

  return (
    <div className="p-discover" data-view={view}>
      <div className="p-discover__panel">
        <header className="p-discover__header">
          <div className="p-discover__search-row">
            <SearchBox value={search} onChange={setSearch} />
            <IconButton label="Filters" icon={<SlidersHorizontal size={22} />} onClick={() => setFilters("all")} />
          </div>
          <FilterChips city={BUDAPEST.name} onOpenCity={() => setCityPrompt(true)} onOpen={setFilters} />
          <div className="p-discover__view-row">
            <span className="p-discover__toggle">
              <SegmentedControl
                label="View"
                value={view}
                onChange={switchView}
                segments={[
                  { value: "map", label: "Map" },
                  { value: "list", label: "List" },
                ]}
              />
            </span>
            <span className="p-discover__count" aria-live="polite">
              {events.length} events
            </span>
          </div>
        </header>
        <div className="p-discover__list">
          {groupByDay(events).map((section) => (
            <div key={section.label}>
              <ListGroupLabel live={section.live}>{section.label}</ListGroupLabel>
              {section.items.map((event) => (
                <EventRow key={event.id} event={event} showDistance onOpen={() => openEvent(event.id)} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="p-discover__map">
        <EventMap
          events={events}
          center={BUDAPEST}
          radiusKm={10}
          visible={view === "map"}
          onOpenEvent={openEvent}
          onOpenGroup={setGroup}
        />
        <span className="p-discover__locate">
          <IconButton label="Locate me" surface icon={<LocateFixed size={22} />} />
        </span>
      </div>

      {user && <Fab label="Create event" onClick={() => navigate("/events/new")} />}
      {filters && <FilterSheet section={filters} resultCount={events.length} onClose={() => setFilters(null)} />}
      {cityPrompt && <CityPrompt onDone={() => setCityPrompt(false)} />}
      {group && (
        <ClusterList
          events={group}
          onClose={() => setGroup(null)}
          onOpenEvent={(id) => {
            setGroup(null);
            openEvent(id);
          }}
        />
      )}
    </div>
  );
}
