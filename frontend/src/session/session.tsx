/**
 * The logged-in user, from `GET /me` (architecture.md §3: role, unread count and organizer-request
 * status drive what the UI shows, US-07/09/19/20/22). Auth is Django's session cookie, so the SPA
 * keeps no token; it only asks the backend who is logged in.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as accounts from "../api/accounts";
import { ApiError } from "../api/client";
import type { LoginIn, MeOut, RegisterIn } from "../api/schema";

/** How often the unread counter is refreshed while the app is open (US-22 badge). */
const POLL_MS = 60_000;

export type Role = MeOut["role"];

interface Session {
  user: MeOut | null;
  /** False until the first `/me` answer, so guarded routes don't bounce to /login on reload. */
  ready: boolean;
  login: (body: LoginIn) => Promise<void>;
  register: (body: RegisterIn) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads `/me`, e.g. after reading a message or sending an organizer request. */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

async function fetchMe(): Promise<MeOut | null> {
  try {
    return await accounts.getMe();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeOut | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUser(await fetchMe());
    } catch {
      // Network error: keep the current user rather than logging them out.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const login = useCallback(
    async (body: LoginIn) => {
      await accounts.login(body);
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (body: RegisterIn) => {
      await accounts.register(body);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await accounts.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout, refresh }), [user, ready, login, register, logout, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}

/** Role helpers in one place, mirroring the backend's permission rules (US-07/09/19). */
export const can = {
  attend: (user: MeOut | null) => user !== null && user.role !== "admin",
  organize: (user: MeOut | null) => user?.role === "organizer",
  moderate: (user: MeOut | null) => user?.role === "admin",
};
