/** Small event building blocks shared by rows, markers and the card (ui_design.md §3.3). */
import { Bike, Dumbbell, Footprints, Goal, Medal, Swords, Trophy, Waves, type LucideIcon } from "lucide-react";
import type { PriceOut, SportOut } from "../../api/schema";
import { Tag } from "../ui";
import { formatPrice, formatRange, isForeignZone, zoneCity } from "../../utils/format";

/**
 * One icon per sport (§2.5), picked by `Sport.icon`, else by the slug: the seeded sports have an
 * empty `icon` (events/fixtures/sports.json). Unknown sports fall back to a trophy.
 */
const SPORT_ICONS: Record<string, LucideIcon> = {
  football: Goal,
  fencing: Swords,
  running: Footprints,
  pentathlon: Medal,
  swimming: Waves,
  "water-polo": Waves,
  cycling: Bike,
  fitness: Dumbbell,
};

export function SportIcon({ sport, size = 20 }: { sport: SportOut | null; size?: number }) {
  const Icon = (sport && (SPORT_ICONS[sport.icon] ?? SPORT_ICONS[sport.slug])) || Trophy;
  return <Icon size={size} aria-hidden />;
}

/** 48 px tile (rows) or small chip with the sport name (card). */
export function SportBadge({ sport, variant = "tile" }: { sport: SportOut | null; variant?: "tile" | "chip" }) {
  if (variant === "chip") {
    return (
      <span className="d-sport-chip">
        <SportIcon sport={sport} size={16} />
        {sport?.name ?? "No sport yet"}
      </span>
    );
  }
  return (
    <span className={`d-sport-tile${sport ? "" : " d-sport-tile--empty"}`} title={sport?.name}>
      {sport ? <SportIcon sport={sport} size={24} /> : "?"}
    </span>
  );
}

/** "Free" tag or "2 500 HUF" – the same everywhere. */
export function PriceLabel({ price }: { price: PriceOut | null }) {
  if (!price) return <Tag variant="free">Free</Tag>;
  return <span className="d-price">{formatPrice(price)}</span>;
}

/** Date/time range in the venue zone, plus "(Budapest time)" when the viewer is elsewhere. */
export function DateTimeRange({ start, end, timeZone }: { start: string; end: string; timeZone: string }) {
  return (
    <>
      {formatRange(start, end, timeZone)}
      {isForeignZone(timeZone) && <span className="t-muted"> ({zoneCity(timeZone)} time)</span>}
    </>
  );
}

interface StatusFlags {
  cancelled?: boolean;
  live?: boolean;
  paid?: boolean;
  full?: boolean;
  draft?: boolean;
}

/** Tags in the fixed order Cancelled → Live now → Paid → Full; renders nothing when none apply. */
export function StatusTags({ cancelled, live, paid, full, draft }: StatusFlags) {
  if (!cancelled && !live && !paid && !full && !draft) return null;
  return (
    <span className="d-status-tags">
      {draft && <Tag variant="draft">Draft</Tag>}
      {cancelled && <Tag variant="cancelled">Cancelled</Tag>}
      {live && !cancelled && <Tag variant="live">Live now</Tag>}
      {paid && <Tag variant="paid">Paid</Tag>}
      {full && !cancelled && <Tag variant="full">Full</Tag>}
    </span>
  );
}
