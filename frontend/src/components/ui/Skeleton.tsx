/** Grey shimmering placeholder in the shape of the content being loaded (ui_design.md §3.1, §6). */
export function Skeleton({ width = "100%", height = 16 }: { width?: number | string; height?: number | string }) {
  return <span className="ui-skeleton" style={{ display: "block", width, height }} aria-hidden />;
}
