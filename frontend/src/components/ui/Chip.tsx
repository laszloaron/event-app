import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

/** Pill-shaped toggle/filter, 36 px high in a 44 px hit area (ui_design.md §3.1). */
export function Chip({ selected = false, leading, trailing, children, className = "", type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      className={`ui-chip${selected ? " ui-chip--selected" : ""} ${className}`}
      aria-pressed={selected}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
}
