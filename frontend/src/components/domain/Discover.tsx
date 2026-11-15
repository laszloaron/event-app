/** Discover header parts and overlays: SearchBox, FilterChips, Filter sheet, City prompt, Cluster list (§5.1–5.5). */
import { useState, type FormEvent } from "react";
import { ChevronDown, LocateFixed, MapPin, Search, X } from "lucide-react";
import type { CityOut, EventListItemOut, SportOut } from "../../api/schema";
import { ApiError } from "../../api/client";
import { ActionBar, ActionRow, Button, Chip, Dialog, SegmentedControl, Sheet, TextField } from "../ui";
import { SportIcon } from "./EventBits";
import { EventRow } from "./EventRow";
import { hasActiveFilters, MAX_RADIUS_KM, type Filters, type PriceFilter } from "../../hooks/filters";
import { todayKey } from "../../utils/dates";

/** 44 px pill search input with a clear ✕ (US-24). */
export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="d-search">
      <Search size={20} className="d-search__icon" aria-hidden />
      <span className="visually-hidden">Search events</span>
      <input type="search" placeholder="Search events…" value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" className="d-search__clear" aria-label="Clear search" onClick={() => onChange("")}>
          <X size={18} />
        </button>
      )}
    </label>
  );
}

export type FilterSection = "all" | "date" | "sport" | "price" | "distance";

const DATE_LABELS: Record<string, string> = { today: "Today", tomorrow: "Tomorrow", weekend: "This weekend" };

/** "Today", "This weekend" or "15 Nov – 17 Nov" for a picked range. */
function dateLabel(date: string): string {
  if (DATE_LABELS[date]) return DATE_LABELS[date];
  const [from, to] = date.split("..");
  const format = (key: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
  return from === to ? format(from) : `${format(from)} – ${format(to)}`;
}

interface FilterChipsProps {
  filters: Filters;
  sports: SportOut[];
  cityLabel: string;
  onOpenCity: () => void;
  onOpen: (section: FilterSection) => void;
  onClear: () => void;
}

/** Sideways-scrolling quick filters; each chip opens its own part of the Filter sheet (§3.3, US-02). */
export function FilterChips({ filters, sports, cityLabel, onOpenCity, onOpen, onClear }: FilterChipsProps) {
  const chevron = <ChevronDown size={16} aria-hidden />;
  const sportLabel =
    filters.sports.length === 0
      ? "Sport"
      : filters.sports.length === 1
        ? sports.find((sport) => sport.slug === filters.sports[0])?.name ?? "1 sport"
        : `${filters.sports.length} sports`;
  const priceLabel = filters.price === "any" ? "Price" : filters.price === "free" ? "Free" : filters.maxPrice ? `Up to ${filters.maxPrice}` : "Paid";
  return (
    <div className="d-filter-chips">
      <Chip leading={<MapPin size={16} aria-hidden />} trailing={chevron} onClick={onOpenCity}>
        {cityLabel}
      </Chip>
      <Chip selected={filters.date !== "today"} trailing={chevron} onClick={() => onOpen("date")}>
        {dateLabel(filters.date)}
      </Chip>
      <Chip selected={filters.sports.length > 0} trailing={chevron} onClick={() => onOpen("sport")}>
        {sportLabel}
      </Chip>
      <Chip selected={filters.price !== "any"} trailing={chevron} onClick={() => onOpen("price")}>
        {priceLabel}
      </Chip>
      <Chip selected={filters.radiusKm !== 10} trailing={chevron} onClick={() => onOpen("distance")}>
        {filters.radiusKm} km
      </Chip>
      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="s" onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  );
}

interface FilterSheetProps {
  section: FilterSection;
  filters: Filters;
  sports: SportOut[];
  resultCount: number | null;
  onChange: (change: Partial<Filters>) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * All filters in one sheet, or one section when opened from a chip (§5.5, US-02). Changes apply at
 * once, so the button always shows the live result count before the sheet is closed.
 */
export function FilterSheet({ section, filters, sports, resultCount, onChange, onReset, onClose }: FilterSheetProps) {
  const today = todayKey(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const picked = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(filters.date);
  const [pickOpen, setPickOpen] = useState(Boolean(picked));
  const [from, setFrom] = useState(picked?.[1] ?? today);
  const [to, setTo] = useState(picked?.[2] ?? today);
  const show = (name: FilterSection) => section === "all" || section === name;
  const titles: Record<FilterSection, string> = { all: "Filters", date: "Date", sport: "Sport", price: "Price", distance: "Distance" };

  const applyRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) onChange({ date: `${nextFrom}..${nextTo}` });
  };
  const toggleSport = (slug: string) =>
    onChange({ sports: filters.sports.includes(slug) ? filters.sports.filter((item) => item !== slug) : [...filters.sports, slug] });

  return (
    <Sheet
      title={titles[section]}
      onClose={onClose}
      footer={
        <ActionBar sticky={false}>
          <ActionRow>
            <Button variant="ghost" size="l" onClick={onReset}>
              Reset
            </Button>
            <Button size="l" grow onClick={onClose}>
              {resultCount === null ? "Show events" : `Show ${resultCount} ${resultCount === 1 ? "event" : "events"}`}
            </Button>
          </ActionRow>
        </ActionBar>
      }
    >
      <div className="d-filters">
        {show("date") && (
          <fieldset className="d-filters__group">
            {section === "all" && <legend className="t-title-m">Date</legend>}
            <div className="d-chip-wrap">
              {Object.entries(DATE_LABELS).map(([value, label]) => (
                <Chip
                  key={value}
                  selected={!pickOpen && filters.date === value}
                  onClick={() => {
                    setPickOpen(false);
                    onChange({ date: value });
                  }}
                >
                  {label}
                </Chip>
              ))}
              <Chip
                selected={pickOpen}
                onClick={() => {
                  setPickOpen(true);
                  applyRange(from, to);
                }}
              >
                Pick dates…
              </Chip>
            </div>
            {pickOpen && (
              <div className="d-filters__pair">
                <TextField label="From" type="date" min={today} value={from} onChange={(e) => applyRange(e.target.value, to < e.target.value ? e.target.value : to)} />
                <TextField label="To" type="date" min={from} value={to} error={to < from ? "Pick a day after the start" : undefined} onChange={(e) => applyRange(from, e.target.value)} />
              </div>
            )}
          </fieldset>
        )}
        {show("sport") && (
          <fieldset className="d-filters__group">
            {section === "all" && <legend className="t-title-m">Sport</legend>}
            <div className="d-chip-wrap">
              {sports.map((item) => (
                <Chip key={item.slug} selected={filters.sports.includes(item.slug)} leading={<SportIcon sport={item} size={16} />} onClick={() => toggleSport(item.slug)}>
                  {item.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        {show("price") && (
          <fieldset className="d-filters__group">
            {section === "all" && <legend className="t-title-m">Price</legend>}
            <SegmentedControl<PriceFilter>
              label="Price"
              fullWidth
              value={filters.price}
              onChange={(price) => onChange({ price, maxPrice: price === "paid" ? filters.maxPrice : "" })}
              segments={[
                { value: "any", label: "Any" },
                { value: "free", label: "Free" },
                { value: "paid", label: "Paid" },
              ]}
            />
            {filters.price === "paid" && (
              <TextField
                label="Max price"
                inputMode="decimal"
                helper="Leave empty for any price."
                value={filters.maxPrice}
                error={filters.maxPrice && !(Number(filters.maxPrice) > 0) ? "Enter a positive number" : undefined}
                onChange={(e) => onChange({ maxPrice: e.target.value.replace(",", ".").trim() })}
              />
            )}
          </fieldset>
        )}
        {show("distance") && (
          <fieldset className="d-filters__group">
            {section === "all" && <legend className="t-title-m">Distance</legend>}
            <output className="d-slider-value">{filters.radiusKm} km</output>
            <input
              type="range"
              className="ui-slider"
              min={1}
              max={MAX_RADIUS_KM}
              value={filters.radiusKm}
              aria-label="Distance in km"
              onChange={(e) => onChange({ radiusKm: Number(e.target.value) })}
            />
          </fieldset>
        )}
      </div>
    </Sheet>
  );
}

interface CityPromptProps {
  lookup: (name: string) => Promise<CityOut>;
  onFound: (city: CityOut) => void;
  /** Omitted when location is denied and no city is set yet: the prompt can't be skipped (US-04). */
  onClose?: () => void;
  /** Offered when the prompt was opened from the city chip. */
  onUseLocation?: () => void;
}

/** Asks for a city when location is denied (US-04); unknown names show "City not found" and change nothing. */
export function CityPrompt({ lookup, onFound, onClose, onUseLocation }: CityPromptProps) {
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!city.trim()) {
      setError("Type a city name");
      return;
    }
    setBusy(true);
    try {
      onFound(await lookup(city.trim()));
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 404 ? "City not found" : reason instanceof Error ? reason.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Where are you looking for events?"
      icon={<MapPin size={32} />}
      onClose={onClose}
      actions={
        <>
          {onUseLocation && (
            <Button variant="secondary" icon={<LocateFixed size={18} />} onClick={onUseLocation}>
              Use my location
            </Button>
          )}
          <Button size="l" fullWidth loading={busy} onClick={() => void submit()}>
            Show events
          </Button>
        </>
      }
    >
      <form onSubmit={(event) => void submit(event)}>
        <TextField
          label="City"
          placeholder="e.g. Budapest"
          autoFocus
          value={city}
          error={error}
          onChange={(e) => {
            setCity(e.target.value);
            setError(undefined);
          }}
        />
      </form>
    </Dialog>
  );
}

/** Small sheet listing the events of one venue group (US-13). */
export function ClusterList({ events, onOpenEvent, onClose }: { events: EventListItemOut[]; onOpenEvent: (id: number) => void; onClose: () => void }) {
  return (
    <Sheet title={`${events.length} events at ${events[0]?.venue_name ?? ""}`} onClose={onClose}>
      <div className="d-bleed">
        {events.map((event) => (
          <EventRow key={event.id} event={event} onOpen={() => onOpenEvent(event.id)} />
        ))}
      </div>
    </Sheet>
  );
}
