/**
 * Where the search is centred: the device location (US-01) or a typed city (US-04).
 *
 * Kept in a context above the routes, so the location is asked once per visit and survives leaving
 * the Discover tab (ui_design.md §8.2: the map position is kept in memory, not in the URL).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CityOut } from "../api/schema";
import { browserTimeZone } from "../utils/dates";

export interface SearchArea {
  lat: number;
  lng: number;
  /** "Near me" or the city name, shown on the city chip. */
  label: string;
  /** Zone for "today"/"this weekend" (architecture.md §3: the client derives the date bounds). */
  timeZone: string;
  source: "device" | "city";
}

export type AreaStatus = "locating" | "ready" | "denied";

interface SearchAreaState {
  area: SearchArea | null;
  status: AreaStatus;
  /** Ask the browser for the position again ("Locate me"); resolves false when it is not available. */
  locate: () => Promise<boolean>;
  chooseCity: (city: CityOut) => void;
}

const SearchAreaContext = createContext<SearchAreaState | null>(null);

/** Give up waiting for a position after this long and ask for a city instead (US-04). */
const LOCATE_TIMEOUT_MS = 10_000;

export function SearchAreaProvider({ children }: { children: ReactNode }) {
  const [area, setArea] = useState<SearchArea | null>(null);
  const [status, setStatus] = useState<AreaStatus>("locating");

  const locate = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        const fail = () => {
          setStatus((current) => (current === "ready" ? current : "denied"));
          resolve(false);
        };
        if (!("geolocation" in navigator)) return fail();
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setArea({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              label: "Near me",
              timeZone: browserTimeZone(),
              source: "device",
            });
            setStatus("ready");
            resolve(true);
          },
          fail,
          { timeout: LOCATE_TIMEOUT_MS, maximumAge: 300_000 },
        );
      }),
    [],
  );

  useEffect(() => {
    void locate();
  }, [locate]);

  const chooseCity = useCallback((city: CityOut) => {
    setArea({ lat: city.lat, lng: city.lng, label: city.name, timeZone: city.timezone, source: "city" });
    setStatus("ready");
  }, []);

  const value = useMemo(() => ({ area, status, locate, chooseCity }), [area, status, locate, chooseCity]);
  return <SearchAreaContext.Provider value={value}>{children}</SearchAreaContext.Provider>;
}

export function useSearchArea(): SearchAreaState {
  const state = useContext(SearchAreaContext);
  if (!state) throw new Error("useSearchArea must be used inside <SearchAreaProvider>");
  return state;
}
