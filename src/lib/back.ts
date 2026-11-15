const BASE = "https://back.invalid";

/**
 * The page to return to after a settings form: a path on this site, else `/`. Anything that would
 * leave the origin (`//host`, `/\host`, a full URL) falls back to the home page.
 */
export function safeBack(raw: string | null | undefined): string {
  if (!raw?.startsWith("/")) return "/";
  try {
    const url = new URL(raw, BASE);
    return url.origin === BASE && !raw.startsWith("//") && !raw.startsWith("/\\")
      ? `${url.pathname}${url.search}`
      : "/";
  } catch {
    return "/";
  }
}
