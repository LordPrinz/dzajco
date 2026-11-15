const BASE = "https://back.invalid";

/** The query parameter that pins a page's language, used by the `hreflang` links. */
export const LANG_PARAM = "lang";

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

/**
 * `safeBack` without `?lang=`: a settings form returns there, and a pinned language in the URL
 * would overrule the choice just made.
 */
export function safeBackWithoutLang(raw: string | null | undefined): string {
  const url = new URL(safeBack(raw), BASE);
  url.searchParams.delete(LANG_PARAM);
  const path = `${url.pathname}${url.search}`;
  return isSitePath(path) ? path : "/";
}
