import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router";
import type { MeOut } from "./api/schema";
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
import { can, useSession } from "./session/session";
import type { OverlayState } from "./routing/useOpenEvent";
import "./pages/pages.css";

/**
 * Access rules of ui_design.md §8.5: logged out → `/login?next=<path>`; logged in without the
 * role → Not found (US-07/09/19/21, matching the API's 403). `allow` omitted = any logged-in user.
 */
function Guard({ allow, children }: { allow?: (user: MeOut) => boolean; children: ReactNode }) {
  const { user, ready } = useSession();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (allow && !allow(user)) return <NotFoundPage />;
  return children;
}

/** Logged-in users don't need the login/register forms: go to `next` or `/` (§8.5). */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  const [params] = useSearchParams();
  if (!ready) return null;
  return user ? <Navigate to={safeNext(params.get("next"))} replace /> : children;
}

const attendee = (user: MeOut) => can.attend(user);
const organizer = (user: MeOut) => can.organize(user);
const admin = (user: MeOut) => can.moderate(user);
const editor = (user: MeOut) => can.organize(user) || can.moderate(user);

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
          <Route path="my-events" element={<Guard allow={attendee}><MyEventsPage /></Guard>} />
          <Route path="inbox" element={<Guard allow={attendee}><InboxPage /></Guard>} />
          <Route path="account" element={<Guard><AccountPage /></Guard>} />
          <Route path="account/drafts" element={<Guard allow={organizer}><DraftsPage /></Guard>} />
          <Route path="admin" element={<Navigate to="/admin/requests" replace />} />
          <Route path="admin/requests" element={<Guard allow={admin}><ModerationPage tab="requests" /></Guard>} />
          <Route path="admin/audit-log" element={<Guard allow={admin}><ModerationPage tab="audit-log" /></Guard>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="events/new" element={<Guard allow={organizer}><EventFormPage key="new" mode="create" /></Guard>} />
        <Route path="events/:id/edit" element={<Guard allow={editor}><EventFormPage mode="edit" /></Guard>} />
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
