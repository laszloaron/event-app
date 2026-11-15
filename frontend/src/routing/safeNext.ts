/**
 * The `next` query value as a safe in-app path (ui_design.md §8.2): it must start with "/" but not
 * "//" or "/\", so a crafted login link can't redirect users to another site. Anything else → "/".
 */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
