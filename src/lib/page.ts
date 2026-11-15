import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { type FC, jsx } from "hono/jsx";
import { parseTheme, THEME_COOKIE } from "../shared/theme";
import { PageContext, type PageSettings } from "../views/page-context";
import type { AppEnv } from "./app-env";
import { safeBack } from "./back";

export function pageSettings(c: Context<AppEnv>): PageSettings {
  const url = new URL(c.req.url);
  return {
    theme: parseTheme(getCookie(c, THEME_COOKIE)),
    // A form post shows its result on the page it came from, which is a GET of the same path.
    path: safeBack(`${url.pathname}${url.search}`),
  };
}

/**
 * Renders a full HTML page with the request's settings in `PageContext`. The view is passed as a
 * component, not called, so its body runs inside the provider and can read the settings.
 *
 * HTML pages are `no-store` (each carries its own CSP nonce) and the Cache API only ever holds link
 * records, so a page rendered for one visitor's theme or language is never served to another.
 */
export function renderPage<P extends object>(c: Context<AppEnv>, view: FC<P>, props: P): string {
  const page = jsx(PageContext.Provider, { value: pageSettings(c) }, jsx(view, props));
  return `<!doctype html>${page}`;
}
