import type { ReactNode } from "react";

export type TagVariant = "cancelled" | "paid" | "live" | "full" | "pending" | "draft" | "free" | "role";

/** Small status pill; always text + colour, never colour alone (ui_design.md §3.1). */
export function Tag({ variant, children }: { variant: TagVariant; children: ReactNode }) {
  return (
    <span className={`ui-tag ui-tag--${variant}`}>
      {variant === "live" && <span className="ui-tag__dot" aria-hidden />}
      {children}
    </span>
  );
}
