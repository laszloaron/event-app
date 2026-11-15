/**
 * Wall-clock ↔ UTC conversion in a named time zone, without a date library.
 *
 * Why: the API stores UTC and the venue's `timezone` (architecture.md §4); "today"/"this weekend"
 * filters are derived by the client in the search area's zone (architecture.md §3 Discovery), and the
 * event form's start/end are typed in venue local time (US-05). `Intl` gives the offset of any zone.
 */

interface WallTime {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
}

/** The wall-clock parts of an instant in `timeZone`. */
function wallTime(instant: number, timeZone: string): WallTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Offset of `timeZone` from UTC at that instant, in ms (Budapest summer = +2 h). */
function offsetMs(instant: number, timeZone: string): number {
  const wall = wallTime(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return asUtc - Math.floor(instant / 60_000) * 60_000;
}

/** The UTC instant at which `timeZone` shows this wall-clock time (second pass fixes DST edges). */
function zonedToUtc(wall: WallTime, timeZone: string): Date {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let instant = guess - offsetMs(guess, timeZone);
  const corrected = guess - offsetMs(instant, timeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM-DDTHH:mm` for a `datetime-local` input, shown in the venue zone. */
export function toLocalInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const wall = wallTime(new Date(iso).getTime(), timeZone);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** UTC ISO string from a `datetime-local` value typed in venue time; null when empty or invalid. */
export function fromLocalInput(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  return zonedToUtc({ year, month, day, hour, minute }, timeZone).toISOString();
}

/** Midnight at the start of `YYYY-MM-DD` (+ `addDays`) in `timeZone`, as UTC ISO. */
function startOfDay(dateKey: string, timeZone: string, addDays = 0): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + addDays));
  return zonedToUtc(
    { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(), hour: 0, minute: 0 },
    timeZone,
  ).toISOString();
}

/** Today's `YYYY-MM-DD` in `timeZone`. */
export function todayKey(timeZone: string): string {
  const wall = wallTime(Date.now(), timeZone);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

export interface DateBounds {
  date_from: string;
  date_to: string;
}

/**
 * The `date` filter (ui_design.md §8.2) as API bounds. The server keeps events that overlap
 * [from, to), so ongoing events stay in "today" (US-01).
 *
 * @param date `today` · `tomorrow` · `weekend` · `YYYY-MM-DD..YYYY-MM-DD`
 */
export function dateBounds(date: string, timeZone: string): DateBounds {
  const today = todayKey(timeZone);
  const range = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(date);
  if (range) return { date_from: startOfDay(range[1], timeZone), date_to: startOfDay(range[2], timeZone, 1) };
  if (date === "tomorrow") return { date_from: startOfDay(today, timeZone, 1), date_to: startOfDay(today, timeZone, 2) };
  if (date === "weekend") {
    const [year, month, day] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
    const toSaturday = weekday === 0 ? -1 : 6 - weekday; // on Sunday the weekend began yesterday
    return { date_from: startOfDay(today, timeZone, toSaturday), date_to: startOfDay(today, timeZone, toSaturday + 2) };
  }
  return { date_from: startOfDay(today, timeZone), date_to: startOfDay(today, timeZone, 1) };
}

/** The viewer's own zone, used when no venue or city zone is known yet. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
