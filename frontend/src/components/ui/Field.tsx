import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

interface FieldFrameProps {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  /** e.g. "12/100" next to the label. */
  counter?: string;
}

/**
 * Shared frame of every form field: label above, control, helper or red error below (ui_design.md §3.1).
 * Template Method: TextField, TextArea, Select and DateTimeField only supply the control; the frame
 * keeps label, required mark and error look identical across all forms.
 */
function FieldFrame({ label, required, helper, error, counter, id, children }: FieldFrameProps & { id: string; children: ReactNode }) {
  return (
    <div className={`ui-field${error ? " ui-field--error" : ""}`}>
      <div className="ui-field__label-row">
        <label className="ui-field__label" htmlFor={id}>
          {label}
          {required && <span className="ui-field__required"> *</span>}
        </label>
        {counter && <span className="ui-field__counter">{counter}</span>}
      </div>
      <div className="ui-field__control">{children}</div>
      {error ? (
        <p className="ui-field__error" id={`${id}-msg`}>
          <AlertTriangle size={16} aria-hidden /> {error}
        </p>
      ) : (
        helper && (
          <p className="ui-field__helper" id={`${id}-msg`}>
            {helper}
          </p>
        )
      )}
    </div>
  );
}

type InputProps = FieldFrameProps & Omit<InputHTMLAttributes<HTMLInputElement>, "required"> & {
  /** Element inside the right edge, e.g. a show-password IconButton. */
  trailing?: ReactNode;
};

/** Single-line text input, 48 px high. */
export function TextField({ label, required, helper, error, counter, trailing, className = "", ...rest }: InputProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} required={required} helper={helper} error={error} counter={counter}>
      <input
        id={id}
        className={`ui-field__input${trailing ? " ui-field__input--with-trailing" : ""} ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helper ? `${id}-msg` : undefined}
        {...rest}
      />
      {trailing && <span className="ui-field__trailing ui-field__trailing--interactive">{trailing}</span>}
    </FieldFrame>
  );
}

/** Native date + time picker; the browser draws its own calendar icon on the right. */
export function DateTimeField(props: Omit<InputProps, "type" | "trailing">) {
  return <TextField type="datetime-local" {...props} />;
}

type TextAreaProps = FieldFrameProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "required">;

/** Multi-line text, at least 4 rows. */
export function TextArea({ label, required, helper, error, counter, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} required={required} helper={helper} error={error} counter={counter}>
      <textarea
        id={id}
        rows={4}
        className="ui-field__input ui-field__input--textarea"
        aria-invalid={Boolean(error)}
        aria-describedby={error || helper ? `${id}-msg` : undefined}
        {...rest}
      />
    </FieldFrame>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

type SelectProps = FieldFrameProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "required"> & {
  options: SelectOption[];
  placeholder?: string;
};

/** Native select with a chevron; opens the native picker on phones. */
export function Select({ label, required, helper, error, counter, options, placeholder, ...rest }: SelectProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} required={required} helper={helper} error={error} counter={counter}>
      <select id={id} className="ui-field__input ui-field__input--select" aria-invalid={Boolean(error)} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={20} className="ui-field__trailing ui-field__trailing--icon" aria-hidden />
    </FieldFrame>
  );
}
