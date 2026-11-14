import { type Context, Hono } from "hono";
import { reportAbuseLink } from "../lib/abuse";
import type { AppEnv } from "../lib/app-env";
import { clientIpKey } from "../lib/client-ip";
import { rateLimit } from "../middleware/rate-limit";
import { loadPublicStats } from "../services/stats";
import { Stats } from "../views/Stats";
import { deleteLazily, errorPage, isExpired, loadRecord, PAGE_HEADERS, parseId } from "./redirect";

function missing(c: Context<AppEnv>): Response {
  return c.html(errorPage(c, "not_found"), 404, PAGE_HEADERS);
}

/** `GET /:id/stats`: the public stats page. Mount before the redirect routes. */
export function statsPageRoutes() {
  const app = new Hono<AppEnv>();

  app.get(
    "/:id/stats",
    rateLimit<AppEnv>("RL_STATS", (c) => clientIpKey(c.req.raw), {
      onLimited: (c) => c.text("Too many requests", 429, { "Cache-Control": "no-store" }),
    }),
    async (c) => {
      const id = parseId(c.req.param("id"));
      if (!id) return missing(c);
      const now = Date.now();
      const record = await loadRecord(c, id, now);
      if (!record) return missing(c);
      if (isExpired(record, now)) {
        deleteLazily(c, id, now);
        return c.html(errorPage(c, "expired", id), 410, PAGE_HEADERS);
      }
      if (record.blocked) {
        return c.html(errorPage(c, "disabled", id), 410, PAGE_HEADERS);
      }

      const stats = await loadPublicStats(c.env, id, now);
      const html = Stats({
        nonce: c.var.nonce,
        id,
        ...stats,
        reportHref: reportAbuseLink(c.env, { linkId: id }),
      });
      return c.html(`<!doctype html>${html}`, 200, { "Cache-Control": "no-store" });
    },
  );

  return app;
}
