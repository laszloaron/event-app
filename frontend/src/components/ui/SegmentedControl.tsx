export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Accessible name of the whole group, e.g. "View". */
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
}

/** 2–3 equal pill segments, e.g. Map | List, Free | Paid (ui_design.md §3.1). */
export function SegmentedControl<T extends string>({ label, segments, value, onChange, fullWidth = false }: SegmentedControlProps<T>) {
  return (
    <div className={`ui-segmented${fullWidth ? " ui-segmented--full" : ""}`} role="group" aria-label={label}>
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          className="ui-segmented__option"
          aria-pressed={segment.value === value}
          onClick={() => onChange(segment.value)}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
