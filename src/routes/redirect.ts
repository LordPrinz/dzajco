import { type Context, Hono } from "hono";
import type { VisitSink } from "../analytics/ports";
import { aeSink, visitPoint } from "../analytics/sink";
import { deleteIfExpired, getLinkRecord, type LinkRecord } from "../db/queries";
import { isBot } from "../domain/bots";
import { isReserved } from "../domain/ids";
import { reportAbuseLink } from "../lib/abuse";
import type { AppEnv } from "../lib/app-env";
import { clientIpKey } from "../lib/client-ip";
import { escapeHtml } from "../lib/html";
import { rateLimit } from "../middleware/rate-limit";

/**
 * Lookup ids are looser than new custom names: names imported from v2 may contain spaces and other
 * characters the creation policy now rejects. Only `/` and control characters are ruled out.
 */
const LOOKUP_ID = /^[^/\p{Cc}]{1,64}$/u;
const MAX_CACHE_SECONDS = 60;
/**
 * Cache entries live under a fixed internal origin, never under the request URL, so a record cannot
 * be reached or poisoned through a public path and a delete can purge it knowing only the id.
 */
const CACHE_ORIGIN = "https://link-cache.internal";

const PAGE_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

/** Static page; the only dynamic part is the report link, whose href is escaped. */
function page(
  env: Cloudflare.Env,
  title: "Not found" | "Link expired" | "Link disabled",
  heading: "Link not found" | "This link has expired" | "This link has been disabled",
  linkId?: string,
): string {
  const href = reportAbuseLink(env, { linkId });
  const report = href ? `<p><a href="${escapeHtml(href)}">Report abuse</a></p>` : "";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${title}</title><h1>${heading}</h1>${report}</html>`;
}

export function linkCacheKey(id: string): Request {
  return new Request(`${CACHE_ORIGIN}/link/${encodeURIComponent(id)}`);
}

/** Drops the cached record in this colo. Other colos can serve it until their TTL (at most 60 s) ends. */
export async function purgeLinkCache(id: string): Promise<void> {
  await caches.default.delete(linkCacheKey(id));
}

export function parseId(raw: string): string | null {
  const id = raw.normalize("NFC");
  return LOOKUP_ID.test(id) && !isReserved(id) ? id : null;
}

/** The stored target, re-checked before it becomes a header: absolute http(s) only, else null. */
function safeLocation(target: string): string | null {
  if (!URL.canParse(target)) return null;
  const url = new URL(target);
  return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
}

async function readCached(id: string): Promise<LinkRecord | null> {
  const hit = await caches.default.match(linkCacheKey(id));
  if (!hit) return null;
  try {
    return (await hit.json()) as LinkRecord;
  } catch {
    return null;
  }
}

/** TTL is at most 60 s and at most the whole seconds left until expiry; 0 means do not cache. */
function cacheSeconds(record: LinkRecord, now: number): number {
  if (record.expiresAt === null) return MAX_CACHE_SECONDS;
  return Math.max(0, Math.min(MAX_CACHE_SECONDS, Math.floor((record.expiresAt - now) / 1000)));
}

/** The link record from the colo cache, else from D1 (then cached). Shared with `GET /api/v1/links/:id`. */
export async function loadRecord(
  c: Context<AppEnv>,
  id: string,
  now: number,
): Promise<LinkRecord | null> {
  const cached = await readCached(id);
  if (cached) return cached;
  const record = await getLinkRecord(c.env.DB, id);
  // Unknown ids are not cached, so a link created right after a miss works at once.
  if (record) {
    const ttl = cacheSeconds(record, now);
    if (ttl > 0) {
      const entry = Response.json(record, { headers: { "Cache-Control": `max-age=${ttl}` } });
      c.executionCtx.waitUntil(caches.default.put(linkCacheKey(id), entry));
    }
  }
  return record;
}

export function isExpired(record: LinkRecord, now: number): boolean {
  return record.expiresAt !== null && record.expiresAt <= now;
}

/** Deletes an expired link and its cache entry after the response is sent. */
export function deleteLazily(c: Context<AppEnv>, id: string, now: number): void {
  c.executionCtx.waitUntil(
    deleteIfExpired(c.env.DB, id, now)
      .then(() => purgeLinkCache(id))
      .catch(() => console.warn("lazy delete failed")),
  );
}

async function writeVisit(sink: VisitSink, point: ReturnType<typeof visitPoint>): Promise<void> {
  try {
    await sink.write(point);
  } catch {
    console.warn("analytics: visit write failed");
  }
}

function notFound(c: Context<AppEnv>): Response {
  return c.html(page(c.env, "Not found", "Link not found"), 404, PAGE_HEADERS);
}

export interface RedirectOptions {
  sink?: (env: Cloudflare.Env) => VisitSink;
}

/** `GET|HEAD /:id` plus the legacy 301s. Mount after every static route: `/:id` matches any segment. */
export function redirectRoutes(options: RedirectOptions = {}) {
  const makeSink = options.sink ?? ((env: Cloudflare.Env) => aeSink(env.VISITS));
  const app = new Hono<AppEnv>();

  app.get("/dzajapi", (c) => c.redirect("/docs/api", 301));

  app.get("/:id/info", (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return notFound(c);
    return c.redirect(`/${encodeURIComponent(id)}/stats`, 301);
  });

  app.get(
    "/:id",
    rateLimit<AppEnv>("RL_REDIRECT", (c) => clientIpKey(c.req.raw), {
      onLimited: (c) => c.text("Too many requests", 429, { "Cache-Control": "no-store" }),
    }),
    async (c) => {
      const id = parseId(c.req.param("id"));
      if (!id) return notFound(c);
      const now = Date.now();
      const record = await loadRecord(c, id, now);
      if (!record) return notFound(c);

      if (isExpired(record, now)) {
        deleteLazily(c, id, now);
        return c.html(page(c.env, "Link expired", "This link has expired", id), 410, PAGE_HEADERS);
      }
      if (record.blocked)
        return c.html(
          page(c.env, "Link disabled", "This link has been disabled", id),
          410,
          PAGE_HEADERS,
        );
      const location = safeLocation(record.target);
      if (!location) {
        console.warn("redirect: stored target is not an http(s) URL");
        return notFound(c);
      }

      if (c.req.method !== "HEAD" && !isBot(c.req.header("user-agent"))) {
        const point = visitPoint(id, c.req.raw.cf as IncomingRequestCfProperties | undefined);
        c.executionCtx.waitUntil(writeVisit(makeSink(c.env), point));
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: location,
          "Cache-Control": "private, max-age=0",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      });
    },
  );

  return app;
}
