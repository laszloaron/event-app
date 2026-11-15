import type { InputHTMLAttributes } from "react";

/** 20 px box in a 44 px row; the whole row is clickable (ui_design.md §3.1). */
export function Checkbox({ label, ...rest }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="ui-checkbox">
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}
