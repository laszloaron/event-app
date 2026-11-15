import type { ReactNode } from "react";

interface ListRowProps {
  leading?: ReactNode;
  title: ReactNode;
  /** Lines under the title, muted and shortened with "…". */
  meta?: ReactNode[];
  trailing?: ReactNode;
  onClick?: () => void;
  dimmed?: boolean;
  compact?: boolean;
  /** Extra content under the meta lines (e.g. tags, an expanded inbox message). */
  children?: ReactNode;
}

/**
 * Tappable 72 px row: leading tile, title + meta, trailing slot (ui_design.md §3.2).
 * Rendered as a div with role="button" so trailing buttons can sit inside it.
 */
export function ListRow({ leading, title, meta = [], trailing, onClick, dimmed = false, compact = false, children }: ListRowProps) {
  const classes = ["ui-list-row", dimmed && "ui-list-row--dimmed", compact && "ui-list-row--compact"].filter(Boolean).join(" ");
  return (
    <div
      className={classes}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {leading && <div className="ui-list-row__leading">{leading}</div>}
      <div className="ui-list-row__main">
        <div className="ui-list-row__title">{title}</div>
        {meta.map((line, index) => (
          <div key={index} className="ui-list-row__meta">
            {line}
          </div>
        ))}
        {children}
      </div>
      {trailing && (
        <div className="ui-list-row__trailing" onClick={(event) => event.stopPropagation()}>
          {trailing}
        </div>
      )}
    </div>
  );
}

/** Sticky group heading inside a list, e.g. "HAPPENING NOW", "SAT 15 NOV". */
export function ListGroupLabel({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return <div className={`ui-list-group-label${live ? " ui-list-group-label--live" : ""}`}>{children}</div>;
}
