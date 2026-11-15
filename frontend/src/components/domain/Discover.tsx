/** Discover header parts and overlays: SearchBox, FilterChips, Filter sheet, City prompt, Cluster list (§5.1–5.5). */
import { useState } from "react";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import type { EventListItemOut } from "../../api/schema";
import { ActionBar, ActionRow, Button, Chip, Dialog, SegmentedControl, Sheet, TextField } from "../ui";
import { sports } from "../../mocks/data";
import { SportIcon } from "./EventBits";
import { EventRow } from "./EventRow";

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

interface FilterChipsProps {
  city: string;
  onOpenCity: () => void;
  onOpen: (section: FilterSection) => void;
}

/** Sideways-scrolling quick filters; each chip opens its own part of the Filter sheet (§3.3). */
export function FilterChips({ city, onOpenCity, onOpen }: FilterChipsProps) {
  const chevron = <ChevronDown size={16} aria-hidden />;
  return (
    <div className="d-filter-chips">
      <Chip leading={<MapPin size={16} aria-hidden />} trailing={chevron} onClick={onOpenCity}>
        {city}
      </Chip>
      <Chip selected trailing={chevron} onClick={() => onOpen("date")}>
        Today
      </Chip>
      <Chip trailing={chevron} onClick={() => onOpen("sport")}>
        Sport
      </Chip>
      <Chip trailing={chevron} onClick={() => onOpen("price")}>
        Price
      </Chip>
      <Chip trailing={chevron} onClick={() => onOpen("distance")}>
        10 km
      </Chip>
      <Button variant="ghost" size="s">
        Clear
      </Button>
    </div>
  );
}

/** All filters in one sheet, or only one section when opened from a chip (§5.5, US-02). Visual only. */
export function FilterSheet({ section, resultCount, onClose }: { section: FilterSection; resultCount: number; onClose: () => void }) {
  const [date, setDate] = useState("today");
  const [picked, setPicked] = useState<string[]>([]);
  const [price, setPrice] = useState<"any" | "free" | "paid">("any");
  const [radius, setRadius] = useState(10);
  const show = (name: FilterSection) => section === "all" || section === name;
  const titles: Record<FilterSection, string> = { all: "Filters", date: "Date", sport: "Sport", price: "Price", distance: "Distance" };

  return (
    <Sheet
      title={titles[section]}
      onClose={onClose}
      footer={
        <ActionBar sticky={false}>
          <ActionRow>
            <Button variant="ghost" size="l">
              Reset
            </Button>
            <Button size="l" grow onClick={onClose}>
              Show {resultCount} events
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
              {[
                ["today", "Today"],
                ["tomorrow", "Tomorrow"],
                ["weekend", "This weekend"],
                ["pick", "Pick dates…"],
              ].map(([value, label]) => (
                <Chip key={value} selected={date === value} onClick={() => setDate(value)}>
                  {label}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        {show("sport") && (
          <fieldset className="d-filters__group">
            {section === "all" && <legend className="t-title-m">Sport</legend>}
            <div className="d-chip-wrap">
              {sports.map((item) => (
                <Chip
                  key={item.slug}
                  selected={picked.includes(item.slug)}
                  leading={<SportIcon sport={item} size={16} />}
                  onClick={() => setPicked((list) => (list.includes(item.slug) ? list.filter((s) => s !== item.slug) : [...list, item.slug]))}
                >
                  {item.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        {show("price") && (
          <fieldset className="d-filters__group">
            {section === "all" && <legend className="t-title-m">Price</legend>}
            <SegmentedControl
              label="Price"
              fullWidth
              value={price}
              onChange={setPrice}
              segments={[
                { value: "any", label: "Any" },
                { value: "free", label: "Free" },
                { value: "paid", label: "Paid" },
              ]}
            />
            {price === "paid" && <TextField label="Max price" inputMode="numeric" trailing={<span className="d-suffix">HUF</span>} />}
          </fieldset>
        )}
        {show("distance") && (
          <fieldset className="d-filters__group">
            {section === "all" && <legend className="t-title-m">Distance</legend>}
            <output className="d-slider-value">{radius} km</output>
            <input
              type="range"
              className="ui-slider"
              min={1}
              max={50}
              value={radius}
              aria-label="Distance in km"
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </fieldset>
        )}
      </div>
    </Sheet>
  );
}

/** Asks for a city when location is denied (US-04). Visual only: "Show events" just closes it. */
export function CityPrompt({ onDone }: { onDone: () => void }) {
  const [city, setCity] = useState("Budapest");
  return (
    <Dialog
      title="Where are you looking for events?"
      icon={<MapPin size={32} />}
      actions={
        <Button size="l" fullWidth onClick={onDone}>
          Show events
        </Button>
      }
    >
      <TextField label="City" placeholder="e.g. Budapest" autoFocus value={city} onChange={(e) => setCity(e.target.value)} />
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
