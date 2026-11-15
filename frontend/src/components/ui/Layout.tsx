import type { ReactNode } from "react";

/** Sticky bottom bar holding 1–3 buttons, respecting the phone's safe area (ui_design.md §3.2). */
export function ActionBar({ children, sticky = true }: { children: ReactNode; sticky?: boolean }) {
  return <div className={`ui-action-bar${sticky ? " ui-action-bar--sticky" : ""}`}>{children}</div>;
}

/** One horizontal line of buttons inside an ActionBar. */
export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="ui-action-bar__row">{children}</div>;
}

interface SectionProps {
  title?: string;
  /** White rounded card look, used by the event form (§5.10) and account page (§5.9). */
  card?: boolean;
  children?: ReactNode;
}

/** Titled block; renders nothing when it has no content (US-14). */
export function Section({ title, card = false, children }: SectionProps) {
  if (children === undefined || children === null || children === false || children === "") return null;
  return (
    <section className={`ui-section${card ? " ui-section--card" : ""}`}>
      {title && <h3 className="ui-section__title">{title}</h3>}
      <div className="ui-section__content">{children}</div>
    </section>
  );
}

interface InfoRowProps {
  icon: ReactNode;
  children: ReactNode;
  secondary?: ReactNode;
}

/** Icon + text line used for date, venue, price and attendees (ui_design.md §3.2). */
export function InfoRow({ icon, children, secondary }: InfoRowProps) {
  return (
    <div className="ui-info-row">
      <span className="ui-info-row__icon">{icon}</span>
      <div className="ui-info-row__text">
        <div>{children}</div>
        {secondary && <div className="ui-info-row__secondary">{secondary}</div>}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  text?: string;
  actions?: ReactNode;
}

/** Friendly "nothing here" block with a next step (US-03). */
export function EmptyState({ icon, title, text, actions }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <span className="ui-empty__icon">{icon}</span>
      <h2 className="t-title-m">{title}</h2>
      {text && <p className="ui-empty__text">{text}</p>}
      {actions && <div className="ui-empty__actions">{actions}</div>}
    </div>
  );
}

interface BannerProps {
  variant: "info" | "danger" | "success" | "warning";
  icon?: ReactNode;
  children: ReactNode;
}

/** Full-width coloured strip with one message (ui_design.md §3.2). */
export function Banner({ variant, icon, children }: BannerProps) {
  return (
    <div className={`ui-banner ui-banner--${variant}`} role={variant === "danger" ? "alert" : "status"}>
      {icon && <span className="ui-banner__icon">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Dark pill above the tab bar for short confirmations (ui_design.md §6). */
export function Toast({ message, actionLabel, onAction }: ToastProps) {
  return (
    <div className="ui-toast" role="status">
      {message}
      {actionLabel && (
        <button type="button" className="ui-toast__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
