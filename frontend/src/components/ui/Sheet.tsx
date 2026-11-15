import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

interface SheetProps {
  onClose: () => void;
  /** Title in the header; omit for the event card, which has its own big title. */
  title?: string;
  /** Extra header buttons left of ✕ (e.g. Share). */
  headerActions?: ReactNode;
  /** Sticky footer, usually an ActionBar. */
  footer?: ReactNode;
  /** `tall` = 92 % height (event card); `fit` = as high as the content (filters, cluster list). */
  size?: "tall" | "fit";
  children: ReactNode;
}

/**
 * The single overlay container (ui_design.md §3.2): bottom sheet on phones, right side panel on desktop.
 * The screen underneath stays mounted, so the map keeps its position (US-11).
 */
export function Sheet({ onClose, title, headerActions, footer, size = "fit", children }: SheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="ui-backdrop" onClick={onClose} aria-hidden />
      <section className={`ui-sheet${size === "tall" ? " ui-sheet--tall" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="ui-sheet__handle" aria-hidden />
        <header className="ui-sheet__header">
          <h2 className="ui-sheet__title">{title}</h2>
          {headerActions}
          <IconButton label="Close" icon={<X size={24} />} onClick={onClose} />
        </header>
        <div className="ui-sheet__body">{children}</div>
        {footer}
      </section>
    </>
  );
}
