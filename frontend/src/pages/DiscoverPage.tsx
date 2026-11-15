import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { LocateFixed, SearchX, SlidersHorizontal } from "lucide-react";
import type { CityOut, EventListItemOut } from "../api/schema";
import { lookupCity, searchEvents } from "../api/events";
import { Button, EmptyState, Fab, IconButton, ListGroupLabel, SegmentedControl, Skeleton } from "../components/ui";
import { CityPrompt, ClusterList, EventMap, EventRow, FilterChips, FilterSheet, SearchBox, type FilterSection } from "../components/domain";
import { useApi } from "../hooks/data";
import { useFilters, MAX_RADIUS_KM } from "../hooks/filters";
import { useSearchArea } from "../hooks/searchArea";
import { useSports } from "../hooks/sports";
import { useToast } from "../hooks/toast";
import { dateBounds } from "../utils/dates";
import { groupByDay } from "../utils/format";
import { useOpenEvent } from "../routing/useOpenEvent";
import { can, useSession } from "../session/session";

type View = "map" | "list";

/** Wait this long after the last key press before searching (US-24), so typing sends one request. */
const SEARCH_DEBOUNCE_MS = 300;
/** "Widen" suggestion on an empty result (US-03). */
const WIDER_RADIUS_KM = 25;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Discover (ui_design.md §5.1, §5.2): search, filter chips, Map | List and the result count.
 * Map and list render the same `GET /events` answer, so count == markers == rows (US-02/23).
 */
export function DiscoverPage({ view }: { view: View }) {
  const navigate = useNavigate();
  const location = useLocation();
  const openEvent = useOpenEvent();
  const toast = useToast();
  const { user } = useSession();
  const { area, status, locate, chooseCity } = useSearchArea();
  const { filters, update, clear } = useFilters();
  const sports = useSports();
  const [sheet, setSheet] = useState<FilterSection | null>(null);
  const [cityPrompt, setCityPrompt] = useState(false);
  const [group, setGroup] = useState<EventListItemOut[] | null>(null);
  const q = useDebounced(filters.q.trim(), SEARCH_DEBOUNCE_MS);

  // A `city` in the URL (reload / shared link) wins over the device position (§8.2, US-04).
  useEffect(() => {
    if (!filters.city || (area?.source === "city" && area.label.toLowerCase() === filters.city.toLowerCase())) return;
    lookupCity(filters.city).then(chooseCity, () => update({ city: "" }));
  }, [filters.city, area, chooseCity, update]);

  const maxPrice = filters.price === "paid" && Number(filters.maxPrice) > 0 ? filters.maxPrice : null;
  const results = useApi(
    area
      ? () =>
          searchEvents({
            lat: area.lat,
            lng: area.lng,
            radius_km: filters.radiusKm,
            ...dateBounds(filters.date, area.timeZone),
            sport: filters.sports,
            price: filters.price === "any" ? null : filters.price,
            max_price: maxPrice,
            q: q || null,
          })
      : null,
    [area, filters.radiusKm, filters.date, filters.sports.join(","), filters.price, maxPrice, q],
  );
  const events = results.data?.items ?? [];
  const count = results.data?.count ?? null;
  const loading = results.loading || status === "locating";

  const switchView = (next: View) => navigate({ pathname: next === "map" ? "/" : "/list", search: location.search });
  const onCityFound = (city: CityOut) => {
    chooseCity(city);
    update({ city: city.name });
    setCityPrompt(false);
  };
  const locateMe = async () => {
    setCityPrompt(false);
    if (await locate()) update({ city: "" });
    else toast("Location is not available. Allow it in your browser, or type a city.");
  };

  const needsCity = !area && status === "denied" && !filters.city;
  const empty = !loading && !results.error && count === 0;

  const emptyState = (
    <EmptyState
      icon={<SearchX size={48} />}
      title="No events found"
      text="Try a wider radius or fewer filters."
      actions={
        <>
          {filters.radiusKm < WIDER_RADIUS_KM && (
            <Button variant="secondary" onClick={() => update({ radiusKm: Math.min(WIDER_RADIUS_KM, MAX_RADIUS_KM) })}>
              Widen to {WIDER_RADIUS_KM} km
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              clear();
              update({ q: "" });
            }}
          >
            Clear filters
          </Button>
        </>
      }
    />
  );

  return (
    <div className="p-discover" data-view={view}>
      <div className="p-discover__panel">
        <header className="p-discover__header">
          {loading && <span className="p-discover__progress" aria-hidden />}
          <div className="p-discover__search-row">
            <SearchBox value={filters.q} onChange={(value) => update({ q: value })} />
            <IconButton label="Filters" icon={<SlidersHorizontal size={22} />} onClick={() => setSheet("all")} />
          </div>
          <FilterChips
            filters={filters}
            sports={sports}
            cityLabel={area?.label ?? (status === "locating" ? "Locating…" : "Choose city")}
            onOpenCity={() => setCityPrompt(true)}
            onOpen={setSheet}
            onClear={clear}
          />
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
              {count === null ? "" : `${count} ${count === 1 ? "event" : "events"}`}
            </span>
          </div>
        </header>
        <div className="p-discover__list">
          {results.error && (
            <EmptyState icon={<SearchX size={48} />} title="Couldn't load events" text={results.error.message} actions={<Button onClick={results.reload}>Try again</Button>} />
          )}
          {empty && emptyState}
          {loading && !results.data && (
            <div className="p-discover__skeletons">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} height={56} />
              ))}
            </div>
          )}
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
        {area && (
          <EventMap events={events} center={area} radiusKm={filters.radiusKm} visible={view === "map"} onOpenEvent={openEvent} onOpenGroup={setGroup} />
        )}
        {empty && <div className="p-discover__map-empty">{emptyState}</div>}
        <span className="p-discover__locate">
          <IconButton label="Locate me" surface icon={<LocateFixed size={22} />} onClick={() => void locateMe()} />
        </span>
      </div>

      {can.organize(user) && <Fab label="Create event" onClick={() => navigate("/events/new")} />}
      {sheet && (
        <FilterSheet section={sheet} filters={filters} sports={sports} resultCount={count} onChange={update} onReset={clear} onClose={() => setSheet(null)} />
      )}
      {(needsCity || cityPrompt) && (
        <CityPrompt
          lookup={lookupCity}
          onFound={onCityFound}
          onClose={needsCity ? undefined : () => setCityPrompt(false)}
          onUseLocation={needsCity ? undefined : () => void locateMe()}
        />
      )}
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
