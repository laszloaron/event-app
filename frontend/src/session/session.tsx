/**
 * Placeholder session: "Log in" just flips a flag, no password and no API call yet.
 * Kept behind a context so the real session-cookie login (architecture.md §1) can replace it
 * without touching the screens. The flag is kept in sessionStorage so a reload keeps you logged in.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { me } from "../mocks/data";
import type { MeOut } from "../api/schema";

const STORAGE_KEY = "eventmap.fake-login";

interface Session {
  user: MeOut | null;
  login: () => void;
  logout: () => void;
}

const SessionContext = createContext<Session | null>(null);

function readStored(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStored(loggedIn: boolean): void {
  try {
    if (loggedIn) window.sessionStorage.setItem(STORAGE_KEY, "1");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): the session simply lasts until reload.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(readStored);
  const login = useCallback(() => {
    writeStored(true);
    setLoggedIn(true);
  }, []);
  const logout = useCallback(() => {
    writeStored(false);
    setLoggedIn(false);
  }, []);
  const value = useMemo(() => ({ user: loggedIn ? me : null, login, logout }), [loggedIn, login, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}
