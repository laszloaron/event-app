/** Red unread counter; shows "9+" above nine (ui_design.md §3.1, US-22). */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="ui-count-badge" aria-label={`${count} unread`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}
