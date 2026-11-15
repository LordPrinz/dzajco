import { type Context, Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../lib/app-env";
import { safeBack } from "../lib/back";
import { readCapped } from "../lib/body";
import { LANG_PARAM } from "../lib/page";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, parseLang } from "../shared/lang";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, themeOrNull } from "../shared/theme";
import { isSameOriginPost } from "./pages";

const MAX_PREFS_BYTES = 1024;

function remember(c: Context<AppEnv>, name: string, value: string, maxAge: number): void {
  setCookie(c, name, value, {
    path: "/",
    maxAge,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    // Only the server reads these, so scripts on the page get no access.
    httpOnly: true,
  });
}

/** The page to return to, without a `?lang=` that would override the choice just made. */
function backTo(raw: string | null): string {
  const back = new URL(safeBack(raw), "https://back.invalid");
  back.searchParams.delete(LANG_PARAM);
  return `${back.pathname}${back.search}`;
}

/**
 * `POST /prefs/theme` and `POST /prefs/lang`: the switches in the header. Plain form posts, so they
 * work without JavaScript; `theme.js` sends the theme one with `fetch` and skips the redirect.
 */
export function prefsRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/prefs/*", async (c, next) => {
    if (!isSameOriginPost(c)) return c.text("Forbidden", 403, { "Cache-Control": "no-store" });
    await next();
    c.header("Cache-Control", "no-store");
  });

  const readForm = async (c: Context<AppEnv>) =>
    new URLSearchParams((await readCapped(c.req.raw, MAX_PREFS_BYTES)) ?? "");

  app.post("/prefs/theme", async (c) => {
    const form = await readForm(c);
    const theme = themeOrNull(form.get("theme"));
    // An unknown value changes nothing, as for the language: the current cookie stays.
    if (theme === "system") deleteCookie(c, THEME_COOKIE, { path: "/" });
    else if (theme !== null) remember(c, THEME_COOKIE, theme, THEME_COOKIE_MAX_AGE);
    return c.redirect(backTo(form.get("back")), 303);
  });

  app.post("/prefs/lang", async (c) => {
    const form = await readForm(c);
    const lang = parseLang(form.get("lang"));
    if (lang !== null) remember(c, LANG_COOKIE, lang, LANG_COOKIE_MAX_AGE);
    return c.redirect(backTo(form.get("back")), 303);
  });

  return app;
}
