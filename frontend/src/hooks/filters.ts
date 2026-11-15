/**
 * Discover search and filters live in the URL query (ui_design.md §8.2), so Map ⇄ List share them
 * (US-02/23), a shared link shows the same results, and default values are left out (US-02
 * "clear filters → default view").
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 50;

export type PriceFilter = "any" | "free" | "paid";

export interface Filters {
  q: string;
  /** `today` · `tomorrow` · `weekend` · `YYYY-MM-DD..YYYY-MM-DD` */
  date: string;
  sports: string[];
  price: PriceFilter;
  maxPrice: string;
  radiusKm: number;
  /** Typed city when location is denied (US-04). */
  city: string;
}

const DEFAULTS: Filters = { q: "", date: "today", sports: [], price: "any", maxPrice: "", radiusKm: DEFAULT_RADIUS_KM, city: "" };

function parse(params: URLSearchParams): Filters {
  const radius = Number(params.get("radius"));
  const price = params.get("price");
  return {
    q: params.get("q") ?? "",
    date: params.get("date") || DEFAULTS.date,
    sports: (params.get("sport") ?? "").split(",").filter(Boolean),
    price: price === "free" || price === "paid" ? price : "any",
    maxPrice: price === "paid" ? params.get("max_price") ?? "" : "",
    radiusKm: radius >= 1 && radius <= MAX_RADIUS_KM ? radius : DEFAULT_RADIUS_KM,
    city: params.get("city") ?? "",
  };
}

function serialize(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.date !== DEFAULTS.date) params.set("date", filters.date);
  if (filters.sports.length) params.set("sport", filters.sports.join(","));
  if (filters.price !== "any") params.set("price", filters.price);
  if (filters.price === "paid" && filters.maxPrice) params.set("max_price", filters.maxPrice);
  if (filters.radiusKm !== DEFAULT_RADIUS_KM) params.set("radius", String(filters.radiusKm));
  if (filters.city) params.set("city", filters.city);
  return params;
}

/** True when any filter (not the search text or city) differs from the default view. */
export function hasActiveFilters(filters: Filters): boolean {
  return filters.date !== DEFAULTS.date || filters.sports.length > 0 || filters.price !== "any" || filters.radiusKm !== DEFAULTS.radiusKm;
}

export function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parse(params), [params]);

  /** Merge a change into the URL; `replace` so typing doesn't fill the history (§8.2). */
  const update = useCallback(
    (change: Partial<Filters>) => setParams((current) => serialize({ ...parse(current), ...change }), { replace: true }),
    [setParams],
  );

  /** Back to "today, 10 km", keeping the search text and city (US-02, US-24 are separate). */
  const clear = useCallback(
    () => setParams((current) => serialize({ ...DEFAULTS, q: parse(current).q, city: parse(current).city }), { replace: true }),
    [setParams],
  );

  return { filters, update, clear };
}
