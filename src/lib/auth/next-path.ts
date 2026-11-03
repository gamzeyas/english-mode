/**
 * Post-login redirect target. Only same-origin relative paths are accepted;
 * `//evil.com`, `/\evil.com` and absolute URLs fall back to the dashboard.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    next.startsWith("/login")
  ) {
    return "/dashboard";
  }
  return next;
}
