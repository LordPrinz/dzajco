import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../lib/app-env";
import { safeBack } from "../lib/back";
import { readCapped } from "../lib/body";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, themeOrNull } from "../shared/theme";
import { isSameOriginPost } from "./pages";

const MAX_PREFS_BYTES = 1024;

/**
 * `POST /prefs/theme`: the theme switch. A plain form post, so it works without JavaScript; the
 * script sends the same request with `fetch` and skips the redirect.
 */
export function prefsRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/prefs/theme", async (c) => {
    if (!isSameOriginPost(c)) return c.text("Forbidden", 403, { "Cache-Control": "no-store" });
    const form = new URLSearchParams((await readCapped(c.req.raw, MAX_PREFS_BYTES)) ?? "");
    const theme = themeOrNull(form.get("theme"));
    // An unknown value changes nothing: the current cookie, if any, stays.
    if (theme === "system") {
      deleteCookie(c, THEME_COOKIE, { path: "/" });
    } else if (theme !== null) {
      // Only the server reads it, so scripts on the page have no access.
      setCookie(c, THEME_COOKIE, theme, {
        path: "/",
        maxAge: THEME_COOKIE_MAX_AGE,
        sameSite: "Lax",
        secure: new URL(c.req.url).protocol === "https:",
        httpOnly: true,
      });
    }
    c.header("Cache-Control", "no-store");
    return c.redirect(safeBack(form.get("back")), 303);
  });

  return app;
}
