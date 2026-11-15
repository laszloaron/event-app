/**
 * Loading API data in screens, and refreshing every loaded screen after a write.
 *
 * Observer pattern: `useApi` subscribes to a shared data version; any write calls `useRefresh()()`
 * to bump it, and every mounted screen reloads. Why: the event card opens over My events, the map
 * or the inbox (US-11), so after "Cancel my attendance" the screen underneath must change too
 * (US-06 "the event disappears from My events") without each screen knowing about the others.
 * No caching library: the app has a handful of screens and one city (KISS, no new dependency).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type DependencyList, type ReactNode } from "react";
import { ApiError } from "../api/client";

const VersionContext = createContext<{ version: number; bump: () => void }>({ version: 0, bump: () => undefined });

export function DataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((value) => value + 1), []);
  const value = useMemo(() => ({ version, bump }), [version, bump]);
  return <VersionContext.Provider value={value}>{children}</VersionContext.Provider>;
}

/** Call after a successful write so every open screen reloads its data. */
export function useRefresh(): () => void {
  return useContext(VersionContext).bump;
}

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | null;
  /** True only for the first load; later reloads keep showing the old data (no flicker, §6). */
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `load` when `deps` change and after every `useRefresh()` bump. Answers of older calls are
 * dropped, so fast typing in the search box can never show stale results. `load = null` skips.
 */
export function useApi<T>(load: (() => Promise<T>) | null, deps: DependencyList): ApiState<T> {
  const { version } = useContext(VersionContext);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(load !== null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!load) {
      setLoading(false);
      return;
    }
    const call = ++latest.current;
    load().then(
      (value) => {
        if (call !== latest.current) return;
        setData(value);
        setError(null);
        setLoading(false);
      },
      (reason: unknown) => {
        if (call !== latest.current) return;
        setError(reason instanceof ApiError ? reason : new ApiError(0, "Something went wrong. Try again."));
        setLoading(false);
      },
    );
    // `load` is a new function each render; `deps` say when it really changes.
  }, [...deps, version, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading, reload };
}
