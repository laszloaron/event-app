import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CountBadge } from "./CountBadge";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Accessible name; icon-only buttons always need one (ui_design.md §2.5). */
  label: string;
  icon: ReactNode;
  /** Number shown in a red CountBadge at the top-right. */
  badge?: number;
  /** White round background with shadow, for buttons floating on the map. */
  surface?: boolean;
}

/** Round 44×44 icon button (ui_design.md §3.1). */
export function IconButton({ label, icon, badge, surface = false, className = "", type = "button", ...rest }: IconButtonProps) {
  const classes = ["ui-icon-button", surface && "ui-icon-button--surface", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} aria-label={label} title={label} {...rest}>
      {icon}
      {badge !== undefined && badge > 0 && <CountBadge count={badge} />}
    </button>
  );
}
