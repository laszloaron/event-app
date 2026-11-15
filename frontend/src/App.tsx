import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router";
import { safeNext } from "./routing/safeNext";
import { AppShell } from "./components/layout/AppShell";
import { DiscoverPage } from "./pages/DiscoverPage";
import { EventCardRoute } from "./pages/EventCardRoute";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { MyEventsPage } from "./pages/MyEventsPage";
import { InboxPage } from "./pages/InboxPage";
import { AccountPage } from "./pages/AccountPage";
import { EventFormPage } from "./pages/EventFormPage";
import { DraftsPage } from "./pages/DraftsPage";
import { ModerationPage } from "./pages/ModerationPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { useSession } from "./session/session";
import type { OverlayState } from "./routing/useOpenEvent";
import "./pages/pages.css";

/** Logged-out users go to `/login?next=<path>` (§8.5). Roles are not checked yet. */
function RequireLogin({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const location = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

/** Logged-in users don't need the login/register forms: go to `next` or `/` (§8.5). */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [params] = useSearchParams();
  return user ? <Navigate to={safeNext(params.get("next"))} replace /> : children;
}

/**
 * Routes from ui_design.md §8.1. The event card is drawn by a second <Routes> over the screen it
 * was opened from (`state.background`, §8.4); a direct link draws it over the map.
 */
export default function App() {
  const location = useLocation();
  const background = (location.state as OverlayState | null)?.background;

  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<AppShell />}>
          <Route index element={<DiscoverPage view="map" />} />
          <Route path="list" element={<DiscoverPage view="list" />} />
          <Route path="events/:id" element={<DiscoverPage view="map" />} />
          <Route path="my-events" element={<RequireLogin><MyEventsPage /></RequireLogin>} />
          <Route path="inbox" element={<RequireLogin><InboxPage /></RequireLogin>} />
          <Route path="account" element={<RequireLogin><AccountPage /></RequireLogin>} />
          <Route path="account/drafts" element={<RequireLogin><DraftsPage /></RequireLogin>} />
          <Route path="admin" element={<Navigate to="/admin/requests" replace />} />
          <Route path="admin/requests" element={<RequireLogin><ModerationPage tab="requests" /></RequireLogin>} />
          <Route path="admin/audit-log" element={<RequireLogin><ModerationPage tab="audit-log" /></RequireLogin>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="events/new" element={<RequireLogin><EventFormPage key="new" mode="create" /></RequireLogin>} />
        <Route path="events/:id/edit" element={<RequireLogin><EventFormPage mode="edit" /></RequireLogin>} />
        <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      </Routes>

      <Routes>
        <Route path="/events/new" element={null} />
        <Route path="/events/:id" element={<EventCardRoute />} />
        <Route path="*" element={null} />
      </Routes>
    </>
  );
}
