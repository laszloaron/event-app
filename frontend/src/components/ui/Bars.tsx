import type { ReactNode } from "react";
import { Plus } from "lucide-react";

interface TopBarProps {
  /** Back arrow or ✕ IconButton. */
  leading?: ReactNode;
  title?: string;
  /** Free content instead of a title, e.g. the SearchBox. */
  center?: ReactNode;
  actions?: ReactNode;
}

/** 56 px header of every page (ui_design.md §3.2). */
export function TopBar({ leading, title, center, actions }: TopBarProps) {
  return (
    <header className={`ui-top-bar${leading ? " ui-top-bar--with-leading" : ""}`}>
      {leading}
      {center ? <div className="ui-top-bar__center">{center}</div> : <h1 className="ui-top-bar__title">{title}</h1>}
      {actions && <div className="ui-top-bar__actions">{actions}</div>}
    </header>
  );
}

export interface TabItem<T extends string> {
  value: T;
  label: string;
}

/** Underlined tabs inside a page, e.g. Moderation (ui_design.md §5.12). */
export function Tabs<T extends string>({ items, value, onChange }: { items: TabItem<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          className="ui-tabs__tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Floating 56 px "+" button; shows the label when given (extended Fab). */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ui-fab" onClick={onClick} aria-label={label}>
      <Plus size={24} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
