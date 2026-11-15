import { useCallback } from "react";
import { useLocation, useNavigate, type Location } from "react-router";

export interface OverlayState {
  /** The screen the event card Sheet is drawn over (ui_design.md §8.4). */
  background?: Location;
}

/**
 * Opens the event card at `/events/:id` over the current screen.
 * From a normal screen it pushes a history entry (Back closes the card); from another card it
 * replaces the entry and keeps the same background, so one Back always returns to the screen below.
 */
export function useOpenEvent(): (id: number) => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (id: number) => {
      const current = (location.state as OverlayState | null)?.background;
      navigate(`/events/${id}`, { state: { background: current ?? location } satisfies OverlayState, replace: Boolean(current) });
    },
    [navigate, location],
  );
}
