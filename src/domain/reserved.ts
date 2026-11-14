export const APP_ROUTES = [
  "api",
  "stats",
  "history",
  "about",
  "docs",
  "privacy-policy",
  "healthz",
  "dzajapi",
] as const;

export const PUBLIC_ENTRIES = [
  "_headers",
  "assets",
  "css",
  "favicon.ico",
  "fonts",
  "img",
  "robots.txt",
  "sitemap.xml",
] as const;

export function reservedFrom(
  routes: readonly string[],
  publicEntries: readonly string[],
): ReadonlySet<string> {
  return new Set([...routes, ...publicEntries]);
}

export const RESERVED_NAMES = reservedFrom(APP_ROUTES, PUBLIC_ENTRIES);
