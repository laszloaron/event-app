import { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import type { EventListItemOut } from "../../api/schema";
import { SportIcon } from "./EventBits";

const MAX_LABEL = 18;
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAX_ZOOM = 18;

/**
 * Two pills overlap when their anchors are closer than this (px). A pill is at most
 * ~150 px wide (icon + 18 characters + ⓘ) and 32 px high (ui_design.md §3.3 EventMarker).
 */
const OVERLAP_X = 150;
const OVERLAP_Y = 40;

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

/** Blue circle with the count; 44 / 48 / 56 px by size (US-13, §3.3 ClusterMarker). */
function clusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? "s" : count < 100 ? "m" : "l";
  return L.divIcon({
    className: "d-marker-anchor",
    iconSize: [0, 0],
    html: `<div class="d-cluster d-cluster--${size}">${count}</div>`,
  });
}

/**
 * Groups events whose pills would overlap at `zoom` (greedy, in pixel space). Every event lands
 * in exactly one group, so groups + single markers always add up to the result count (US-13 AC 3).
 */
function groupOverlapping(map: L.Map, events: EventListItemOut[], zoom: number): EventListItemOut[][] {
  const groups: { anchor: L.Point; events: EventListItemOut[] }[] = [];
  for (const event of events) {
    const point = map.project([event.lat, event.lng], zoom);
    const near = groups.find((group) => Math.abs(group.anchor.x - point.x) < OVERLAP_X && Math.abs(group.anchor.y - point.y) < OVERLAP_Y);
    if (near) near.events.push(event);
    else groups.push({ anchor: point, events: [event] });
  }
  return groups.map((group) => group.events);
}

function sameVenue(events: EventListItemOut[]): boolean {
  return events.every((event) => event.lat === events[0].lat && event.lng === events[0].lng);
}

interface MarkersProps {
  events: EventListItemOut[];
  onOpenEvent: (id: number) => void;
  onOpenGroup: (events: EventListItemOut[]) => void;
}

/** Single pills and group circles, regrouped after every zoom (US-12/13). */
function Markers({ events, onOpenEvent, onOpenGroup }: MarkersProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const groups = useMemo(() => groupOverlapping(map, events, zoom), [map, events, zoom]);

  /** US-13: zoom in until the events separate; one venue (or fully zoomed in) → the short list. */
  const openGroup = (group: EventListItemOut[]) => {
    if (sameVenue(group) || map.getZoom() >= MAX_ZOOM) {
      onOpenGroup(group);
      return;
    }
    const bounds = L.latLngBounds(group.map((event) => [event.lat, event.lng] as [number, number]));
    const target = Math.min(MAX_ZOOM, Math.max(map.getBoundsZoom(bounds.pad(0.5)), map.getZoom() + 1));
    map.setView(bounds.getCenter(), target);
  };

  return (
    <>
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
            key={`group-${group.map((event) => event.id).join("-")}`}
            position={[group[0].lat, group[0].lng]}
            icon={clusterIcon(group.length)}
            keyboard
            title={sameVenue(group) ? `${group.length} events at ${group[0].venue_name}` : `${group.length} events`}
            eventHandlers={{ click: () => openGroup(group) }}
          />
        ),
      )}
    </>
  );
}

/** Leaflet needs a size refresh when its container was hidden (phone List tab) and becomes visible. */
function ResizeOnShow({ visible }: { visible: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (visible) map.invalidateSize();
  }, [visible, map]);
  return null;
}

/** Moves the map when the search centre changes (Locate me, a typed city – US-04). */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
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
 * Full-bleed OpenStreetMap with event pills, group circles, the search centre and the radius ring.
 * Grouping is done here rather than with leaflet.markercluster: the pills are wide labels, not
 * pins, so "would overlap" must be measured with their real size (architecture.md §1, US-13).
 */
export function EventMap({ events, center, radiusKm, visible, onOpenEvent, onOpenGroup }: EventMapProps) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={window.innerWidth < 600 ? 12 : 13} maxZoom={MAX_ZOOM} zoomControl={false} className="d-map" attributionControl>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <ZoomControl position="bottomright" />
      <ResizeOnShow visible={visible} />
      <Recenter lat={center.lat} lng={center.lng} />
      <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={{ className: "d-radius-ring", weight: 1 }} interactive={false} />
      <CircleMarker center={[center.lat, center.lng]} radius={8} pathOptions={{ className: "d-you-dot", weight: 3, fillOpacity: 1 }} interactive={false} />
      <Markers events={events} onOpenEvent={onOpenEvent} onOpenGroup={onOpenGroup} />
    </MapContainer>
  );
}

const PIN_ICON = L.divIcon({
  className: "d-marker-anchor",
  iconSize: [0, 0],
  html: '<div class="d-pin"><svg width="36" height="36" viewBox="0 0 24 24" fill="var(--color-primary)" stroke="#fff" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg></div>',
});

export interface LatLng {
  lat: number;
  lng: number;
}

function PlaceOnClick({ onChange }: { onChange: (position: LatLng) => void }) {
  useMapEvents({ click: (event) => onChange({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

interface VenuePickerProps {
  /** The pin, or null before the organizer has placed it. */
  position: LatLng | null;
  /** Where the map opens when there is no pin yet. */
  fallbackCenter: LatLng;
  onChange: (position: LatLng) => void;
}

/** 200 px map: tap to place the pin, drag to adjust; the pin sets the event's coordinates (US-09 "Venue"). */
export function VenuePicker({ position, fallbackCenter, onChange }: VenuePickerProps) {
  const start = position ?? fallbackCenter;
  const handlers = useMemo(
    () => ({
      dragend: (event: L.LeafletEvent) => {
        const point = (event.target as L.Marker).getLatLng();
        onChange({ lat: point.lat, lng: point.lng });
      },
    }),
    [onChange],
  );
  return (
    <div className="d-venue-picker">
      <MapContainer center={[start.lat, start.lng]} zoom={position ? 15 : 12} className="d-map" scrollWheelZoom={false}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <PlaceOnClick onChange={onChange} />
        {position && <Marker position={[position.lat, position.lng]} icon={PIN_ICON} draggable eventHandlers={handlers} />}
      </MapContainer>
    </div>
  );
}
