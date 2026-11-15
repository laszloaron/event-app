import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
export type ButtonSize = "l" | "m" | "s";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon; replaced by a spinner while `loading`. */
  icon?: ReactNode;
  fullWidth?: boolean;
  /** Takes the free width inside an ActionBar row. */
  grow?: boolean;
  loading?: boolean;
}

/** The one button of the app: 5 variants × 3 sizes (ui_design.md §3.1). */
export function Button({
  variant = "primary",
  size = "m",
  icon,
  fullWidth = false,
  grow = false,
  loading = false,
  className = "",
  type = "button",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    size !== "m" && `ui-button--${size}`,
    fullWidth && "ui-button--full",
    grow && "ui-button--grow",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const leading = loading ? <Loader2 size={18} className="ui-spin" /> : icon;
  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {leading && <span className="ui-button__icon">{leading}</span>}
      {children}
    </button>
  );
}
