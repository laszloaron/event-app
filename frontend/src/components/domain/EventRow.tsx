import type { ReactNode } from "react";
import type { PriceOut, SportOut } from "../../api/schema";
import { ListRow } from "../ui";
import { PriceLabel, SportBadge, StatusTags } from "./EventBits";
import { formatRelativeDay, formatTime } from "../../utils/format";

/** The fields every event row needs; Discover, My events and the cluster list all provide them. */
export interface EventRowData {
  id: number;
  title: string;
  sport: SportOut | null;
  start_at: string;
  timezone: string;
  venue_name: string;
  price: PriceOut | null;
  is_ongoing: boolean;
  distance_km?: number;
  is_cancelled?: boolean;
  has_paid?: boolean;
}

interface EventRowProps {
  event: EventRowData;
  onOpen: () => void;
  /** Show the distance line (Discover only, §3.3). */
  showDistance?: boolean;
  /** Action under the meta lines, e.g. "Remove from my events" (kept out of the trailing slot so the title keeps its width). */
  extraAction?: ReactNode;
}

/** One event in any list: sport tile · title + "Sat 14:00 · Venue" · price and tags (ui_design.md §3.3). */
export function EventRow({ event, onOpen, showDistance = false, extraAction }: EventRowProps) {
  const when = `${event.is_ongoing ? "Now" : `${formatRelativeDay(event.start_at, event.timezone)} ${formatTime(event.start_at, event.timezone)}`} · ${event.venue_name}`;
  const meta: ReactNode[] = [when];
  if (showDistance && event.distance_km !== undefined) meta.push(`${event.distance_km.toFixed(1)} km away`);
  return (
    <ListRow
      leading={<SportBadge sport={event.sport} />}
      title={event.title}
      meta={meta}
      onClick={onOpen}
      dimmed={event.is_cancelled}
      trailing={
        <>
          <PriceLabel price={event.price} />
          <StatusTags cancelled={event.is_cancelled} live={event.is_ongoing} paid={event.has_paid} />
        </>
      }
    >
      {extraAction && (
        <div className="d-row-action" onClick={(e) => e.stopPropagation()}>
          {extraAction}
        </div>
      )}
    </ListRow>
  );
}
