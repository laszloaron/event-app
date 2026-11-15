import { Link, Outlet, useLocation } from "react-router";
import type { OverlayState } from "../../routing/useOpenEvent";
import { CalendarDays, Inbox, LogIn, Map as MapIcon, MapPinned, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { CountBadge } from "../ui";
import { useSession } from "../../session/session";
import "./layout.css";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

/** The menu items per role (ui_design.md §4 "Tabs per role"; US-07/19/22): only links the user can open. */
function useNavItems(): NavItem[] {
  const { user } = useSession();
  const discover: NavItem = { to: "/", label: "Discover", icon: MapIcon };
  if (!user) return [discover, { to: "/login", label: "Log in", icon: LogIn }];
  const account: NavItem = { to: "/account", label: "Account", icon: UserRound };
  if (user.role === "admin") return [discover, { to: "/admin/requests", label: "Moderation", icon: ShieldCheck }, account];
  return [
    discover,
    { to: "/my-events", label: "My events", icon: CalendarDays },
    { to: "/inbox", label: "Inbox", icon: Inbox, badge: user.unread_count },
    account,
  ];
}

/**
 * Which tab is active. A card open over a screen keeps that screen's tab (§8.1 "tab underneath"),
 * Discover owns both `/` and `/list`, and pages opened from Account (drafts, form, moderation) keep Account.
 */
function useActiveTab(): string {
  const location = useLocation();
  const path = ((location.state as OverlayState | null)?.background ?? location).pathname;
  const isCard = path.startsWith("/events/") && !path.endsWith("/edit") && path !== "/events/new";
  if (path === "/" || path === "/list" || isCard) return "/";
  if (path.startsWith("/admin")) return "/admin/requests";
  if (path === "/register") return "/login";
  if (path.startsWith("/account") || path.startsWith("/events/")) return "/account";
  return path;
}

function NavItems({ items }: { items: NavItem[] }) {
  const active = useActiveTab();
  return (
    <>
      {items.map(({ to, label, icon: Icon, badge }) => (
        <Link
          key={to}
          to={to}
          aria-current={active === to ? "page" : undefined}
          className={`l-nav__item${active === to ? " l-nav__item--active" : ""}`}
        >
          <span className="l-nav__icon">
            <Icon size={24} aria-hidden />
            {badge !== undefined && badge > 0 && <CountBadge count={badge} />}
          </span>
          <span className="l-nav__label">{label}</span>
        </Link>
      ))}
    </>
  );
}

/** Page frame: NavRail on desktop, TabBar on phones, the routed page in between (ui_design.md §4.1). */
export function AppShell() {
  const items = useNavItems();
  return (
    <div className="l-shell">
      <nav className="l-nav l-nav--rail" aria-label="Main">
        <span className="l-nav__logo" aria-label="EventMap">
          <MapPinned size={32} />
        </span>
        <NavItems items={items} />
      </nav>
      <main className="l-main">
        <Outlet />
      </main>
      <nav className="l-nav l-nav--bar" aria-label="Main">
        <NavItems items={items} />
      </nav>
    </div>
  );
}
