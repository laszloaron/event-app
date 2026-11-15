import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Back / ✕ handler: returns to the previous screen, or to `fallback` when the page was opened
 * directly (first history entry), so the button never leaves the app.
 */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.key === "default") navigate(fallback, { replace: true });
    else navigate(-1);
  }, [navigate, location.key, fallback]);
}
