const BASE = "https://back.invalid";

/** True for a path on this site; `//host` and `/\host` are protocol-relative URLs to another one. */
function isSitePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

/**
 * The page to return to after a settings form: a path on this site, else `/`. The check runs on the
 * normalised path, because dot segments can turn `/.//evil.com` into `//evil.com`, which a browser
 * reads as another host.
 */
export function safeBack(raw: string | null | undefined): string {
  if (!raw?.startsWith("/")) return "/";
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return "/";
    const path = `${url.pathname}${url.search}`;
    return isSitePath(path) ? path : "/";
  } catch {
    return "/";
  }
}
