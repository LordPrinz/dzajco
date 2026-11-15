import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { type FC, jsx } from "hono/jsx";
import { LANG_COOKIE, LANGS, type Lang, resolveLang } from "../shared/lang";
import { parseTheme, THEME_COOKIE } from "../shared/theme";
import { PageContext, type PageSettings } from "../views/page-context";
import { PAGE_TEXT } from "../views/text";
import type { AppEnv } from "./app-env";
import { safeBack } from "./back";

/** The query parameter that pins a page's language, used by the `hreflang` links. */
export const LANG_PARAM = "lang";

function alternates(origin: string, url: URL): PageSettings["alternates"] {
  let base: URL;
  try {
    base = new URL(`${url.pathname}${url.search}`, origin);
  } catch {
    return null;
  }
  base.searchParams.delete(LANG_PARAM);
  const each = Object.fromEntries(
    LANGS.map((lang) => {
      const href = new URL(base);
      href.searchParams.set(LANG_PARAM, lang);
      return [lang, href.href];
    }),
  ) as Record<Lang, string>;
  return { ...each, "x-default": base.href };
}

export function pageSettings(c: Context<AppEnv>): PageSettings {
  const url = new URL(c.req.url);
  const lang = resolveLang({
    query: url.searchParams.get(LANG_PARAM),
    cookie: getCookie(c, LANG_COOKIE),
    country: (c.req.raw.cf?.country as string | undefined) ?? null,
    acceptLanguage: c.req.header("Accept-Language"),
  });
  // Back links drop `?lang=`, or a switch to the other language would be overruled by the URL.
  const back = new URL(url);
  back.searchParams.delete(LANG_PARAM);
  return {
    theme: parseTheme(getCookie(c, THEME_COOKIE)),
    lang,
    t: PAGE_TEXT[lang],
    // A form post shows its result on the page it came from, which is a GET of the same path.
    path: safeBack(`${back.pathname}${back.search}`),
    alternates: alternates(c.env.PUBLIC_ORIGIN, url),
  };
}

/**
 * Renders a full HTML page with the request's settings in `PageContext`. The view is passed as a
 * component, not called, so its body runs inside the provider and can read the settings.
 *
 * HTML pages are `no-store` (each carries its own CSP nonce) and the Cache API only ever holds link
 * records, so a page rendered for one visitor's theme or language is never served to another. `Vary`
 * still names the inputs, for any cache that might keep a page anyway.
 */
export function renderPage<P extends object>(c: Context<AppEnv>, view: FC<P>, props: P): string {
  const settings = pageSettings(c);
  c.header("Content-Language", settings.lang);
  c.header("Vary", "Cookie, Accept-Language");
  const page = jsx(PageContext.Provider, { value: settings }, jsx(view, props));
  return `<!doctype html>${page}`;
}
