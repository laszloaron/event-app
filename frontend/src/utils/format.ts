/**
 * Display formatting only. Times are shown in the venue's time zone (US-05, frontend/AGENTS.md "Times").
 */
import type { PriceOut } from "../api/schema";

const LOCALE = "en-GB";

function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** "14:00" in the venue zone. */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** "Sat 15 Nov" in the venue zone. */
export function formatDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

/** "Today", "Tomorrow" or "Sat 15 Nov" – used for list group labels and row meta lines. */
export function formatRelativeDay(iso: string, timeZone: string): string {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const key = dayKey(iso, timeZone);
  if (key === dayKey(today.toISOString(), timeZone)) return "Today";
  if (key === dayKey(tomorrow.toISOString(), timeZone)) return "Tomorrow";
  return formatDay(iso, timeZone);
}

/** "Sat 15 Nov · 14:00–16:00", or "15 Nov 14:00 – 16 Nov 12:00" across days (§3.3 DateTimeRange). */
export function formatRange(startIso: string, endIso: string, timeZone: string): string {
  if (dayKey(startIso, timeZone) === dayKey(endIso, timeZone)) {
    return `${formatDay(startIso, timeZone)} · ${formatTime(startIso, timeZone)}–${formatTime(endIso, timeZone)}`;
  }
  return `${formatDay(startIso, timeZone)} ${formatTime(startIso, timeZone)} – ${formatDay(endIso, timeZone)} ${formatTime(endIso, timeZone)}`;
}

/** True when the viewer's zone differs from the venue's, so the card adds "(Budapest time)". */
export function isForeignZone(timeZone: string): boolean {
  return Intl.DateTimeFormat().resolvedOptions().timeZone !== timeZone;
}

/** "Budapest" from "Europe/Budapest". */
export function zoneCity(timeZone: string): string {
  return timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
}

/** "2 500 HUF" with a thin grouping space; null price = Free. */
export function formatPrice(price: PriceOut | null): string {
  if (!price) return "Free";
  const amount = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(Number(price.amount));
  return `${amount} ${price.currency}`;
}

/** "2 h ago", "3 d ago", "just now". */
export function formatAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

interface Groupable {
  start_at: string;
  timezone: string;
  is_ongoing: boolean;
}

export interface EventGroup<T> {
  label: string;
  live: boolean;
  items: T[];
}

/** "Happening now" first, then one group per day, keeping the given order (US-07, US-23). */
export function groupByDay<T extends Groupable>(items: T[]): EventGroup<T>[] {
  const groups: EventGroup<T>[] = [];
  const ongoing = items.filter((item) => item.is_ongoing);
  if (ongoing.length) groups.push({ label: "Happening now", live: true, items: ongoing });
  for (const item of items.filter((entry) => !entry.is_ongoing)) {
    const label = formatRelativeDay(item.start_at, item.timezone);
    const last = groups[groups.length - 1];
    if (last && !last.live && last.label === label) last.items.push(item);
    else groups.push({ label, live: false, items: [item] });
  }
  return groups;
}
