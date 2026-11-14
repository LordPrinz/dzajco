import { Hono } from "hono";
import type { Child } from "hono/jsx";
import { globalStats } from "../db/queries";
import { reportAbuseLink } from "../lib/abuse";
import type { AppEnv } from "../lib/app-env";
import { isoOrNull } from "../lib/time";
import { About } from "../views/About";
import { ApiDocs } from "../views/ApiDocs";
import { History } from "../views/History";
import { Privacy } from "../views/Privacy";

/** Every page carries a per-request nonce in its CSP, so none of them may be cached. */
const PAGE_HEADERS = { "Cache-Control": "no-store" };

function render(page: Child): string {
  return `<!doctype html>${page}`;
}

/** `/history`, `/about`, `/docs/api` and `/privacy-policy`. Mount before the `/:id` redirect route. */
export function infoPageRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/history", (c) => c.html(render(History({ nonce: c.var.nonce })), 200, PAGE_HEADERS));

  app.get("/about", async (c) => {
    const stats = await globalStats(c.env.DB);
    const page = About({
      nonce: c.var.nonce,
      stats: {
        links: stats?.links ?? 0,
        visits: stats?.visits ?? 0,
        countries: stats?.countries ?? [],
        updatedAt: isoOrNull(stats?.updatedAt ?? null),
      },
    });
    return c.html(render(page), 200, PAGE_HEADERS);
  });

  app.get("/docs/api", (c) =>
    c.html(
      render(ApiDocs({ nonce: c.var.nonce, origin: new URL(c.env.PUBLIC_ORIGIN).origin })),
      200,
      PAGE_HEADERS,
    ),
  );

  app.get("/privacy-policy", (c) =>
    c.html(
      render(Privacy({ nonce: c.var.nonce, contactHref: reportAbuseLink(c.env) })),
      200,
      PAGE_HEADERS,
    ),
  );

  return app;
}
