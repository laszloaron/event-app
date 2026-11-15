import { useEffect, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { EventListItemOut } from "../../api/schema";
import { SportIcon } from "./EventBits";

const MAX_LABEL = 18;

/** Marker labels go into Leaflet's raw HTML, so user-written titles must be escaped. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function shorten(title: string): string {
  return title.length > MAX_LABEL ? `${title.slice(0, MAX_LABEL - 1)}…` : title;
}

const INFO_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';

/** White pill: sport icon + shortened name + ⓘ, 44 px hit area (US-12, ui_design.md §3.3 EventMarker). */
function eventMarkerIcon(event: EventListItemOut): L.DivIcon {
  const icon = renderToStaticMarkup(<SportIcon sport={event.sport} size={18} />);
  return L.divIcon({
    className: "d-marker-anchor",
    iconSize: [0, 0],
    html: `<div class="d-marker" title="${escapeHtml(event.title)}">${icon}<span class="d-marker__label">${escapeHtml(shorten(event.title))}</span><span class="d-marker__info">${INFO_SVG}</span></div>`,
  });
}

/** Blue circle with the count; 40 / 48 / 56 px by size (US-13, §3.3 ClusterMarker). */
function clusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? "s" : count < 100 ? "m" : "l";
  return L.divIcon({
    className: "d-marker-anchor",
    iconSize: [0, 0],
    html: `<div class="d-cluster d-cluster--${size}">${count}</div>`,
  });
}

/** Leaflet needs a size refresh when its container was hidden (phone List tab) and becomes visible. */
function ResizeOnShow({ visible }: { visible: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (visible) map.invalidateSize();
  }, [visible, map]);
  return null;
}

interface EventMapProps {
  events: EventListItemOut[];
  center: { lat: number; lng: number };
  radiusKm: number;
  visible: boolean;
  onOpenEvent: (id: number) => void;
  /** Several events at one venue: open the cluster list (US-13). */
  onOpenGroup: (events: EventListItemOut[]) => void;
}

/**
 * Full-bleed OpenStreetMap with event pills, group circles, the user's dot and the radius ring.
 * Placeholder grouping: events sharing exact coordinates become one group marker; zoom-based
 * clustering (architecture.md: Leaflet + markercluster) comes with the real data.
 */
export function EventMap({ events, center, radiusKm, visible, onOpenEvent, onOpenGroup }: EventMapProps) {
  const groups = useMemo(() => {
    const byPlace = new Map<string, EventListItemOut[]>();
    for (const event of events) {
      const key = `${event.lat},${event.lng}`;
      byPlace.set(key, [...(byPlace.get(key) ?? []), event]);
    }
    return [...byPlace.values()];
  }, [events]);

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={window.innerWidth < 600 ? 12 : 13} zoomControl={false} className="d-map" attributionControl>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <ZoomControl position="bottomright" />
      <ResizeOnShow visible={visible} />
      <Circle
        center={[center.lat, center.lng]}
        radius={radiusKm * 1000}
        pathOptions={{ className: "d-radius-ring", weight: 1 }}
        interactive={false}
      />
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={8}
        pathOptions={{ className: "d-you-dot", weight: 3, fillOpacity: 1 }}
        interactive={false}
      />
      {groups.map((group) =>
        group.length === 1 ? (
          <Marker
            key={group[0].id}
            position={[group[0].lat, group[0].lng]}
            icon={eventMarkerIcon(group[0])}
            keyboard
            title={group[0].title}
            eventHandlers={{ click: () => onOpenEvent(group[0].id) }}
          />
        ) : (
          <Marker
            key={`group-${group[0].id}`}
            position={[group[0].lat, group[0].lng]}
            icon={clusterIcon(group.length)}
            keyboard
            title={`${group.length} events at ${group[0].venue_name}`}
            eventHandlers={{ click: () => onOpenGroup(group) }}
          />
        ),
      )}
    </MapContainer>
  );
}

interface VenuePickerProps {
  position: { lat: number; lng: number };
}

/** 200 px map with a draggable pin for the event form (ui_design.md §5.10). Not wired to the form yet. */
export function VenuePicker({ position }: VenuePickerProps) {
  const pin = useMemo(
    () =>
      L.divIcon({
        className: "d-marker-anchor",
        iconSize: [0, 0],
        html: '<div class="d-pin"><svg width="36" height="36" viewBox="0 0 24 24" fill="var(--color-primary)" stroke="#fff" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg></div>',
      }),
    [],
  );
  return (
    <div className="d-venue-picker">
      <MapContainer center={[position.lat, position.lng]} zoom={14} className="d-map" scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[position.lat, position.lng]} icon={pin} draggable />
      </MapContainer>
    </div>
  );
}
