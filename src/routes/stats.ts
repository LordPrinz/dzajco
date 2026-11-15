import { type Context, Hono } from "hono";
import * as v from "valibot";
import { createVisitSource } from "../analytics/ae-source";
import { loadFresh, parseFreshTtl } from "../analytics/fresh";
import { mergeCities, mergeCountries } from "../analytics/merge";
import { deleteLink, globalStats, ownerStats } from "../db/queries";
import { bearerSchema } from "../domain/schemas";
import { peppersFromEnv, verifySecret } from "../domain/secret";
import type { AppEnv } from "../lib/app-env";
import { clientIpKey } from "../lib/client-ip";
import { isoOrNull } from "../lib/time";
import { apiError } from "../middleware/errors";
import { rateLimit } from "../middleware/rate-limit";
import { loadPublicStats } from "../services/stats";
import { deleteLazily, isExpired, loadRecord, parseId, purgeLinkCache } from "./redirect";

/**
 * The key from `Authorization: Bearer <key>` (scheme in any case); null when missing or malformed.
 * Callers split the status on purpose: DELETE without or with a malformed key is 400 invalid_key;
 * stats without Authorization is the public view, and any Authorization that is not a valid key
 * for the link (malformed or wrong) is 403.
 */
function bearerKey(header: string | undefined): string | null {
  if (header === undefined) return null;
  const parsed = v.safeParse(bearerSchema, header);
  return parsed.success ? parsed.output : null;
}

function forbidden(c: Context): Response {
  return apiError(c, 403, "forbidden", "The key does not match this link");
}

/** `/api/v1` routes: delete a link, its stats and the global stats. */
export function statsRoutes() {
  const app = new Hono<AppEnv>();
  const byIp = (c: Context<AppEnv>) => clientIpKey(c.req.raw);

  app.delete("/links/:id", rateLimit<AppEnv>("RL_DELETE", byIp), async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return apiError(c, 404, "not_found", "Link not found");
    // The key only ever comes from the header; a body (v2 sent `{secretKey}`) is ignored.
    const key = bearerKey(c.req.header("Authorization"));
    if (key === null) {
      return apiError(c, 400, "invalid_key", "Send the key as Authorization: Bearer <key>");
    }
    const peppers = peppersFromEnv(c.env);
    const result = await deleteLink(c.env.DB, id, (hash) => verifySecret(key, hash, peppers));
    if (result === "not_found") return apiError(c, 404, "not_found", "Link not found");
    if (result === "forbidden") return forbidden(c);
    // The row is gone: a cache error must not turn the finished delete into a 500.
    await purgeLinkCache(id).catch(() => console.warn("cache purge failed"));
    return c.body(null, 204);
  });

  app.get("/links/:id/stats", rateLimit<AppEnv>("RL_STATS", byIp), async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return apiError(c, 404, "not_found", "Link not found");
    const header = c.req.header("Authorization");
    const key = bearerKey(header);
    if (header !== undefined && key === null) return forbidden(c);

    const now = Date.now();
    const record = await loadRecord(c, id, now);
    if (!record) return apiError(c, 404, "not_found", "Link not found");
    if (isExpired(record, now)) {
      deleteLazily(c, id, now);
      return apiError(c, 410, "expired", "Link has expired");
    }
    if (record.blocked) return apiError(c, 410, "link_disabled", "Link has been disabled");

    // The owner batch also returns the secret hash, so the key is checked without another read.
    const owner = key === null ? null : await ownerStats(c.env.DB, id);
    if (owner && key !== null) {
      if (!owner.found) return apiError(c, 404, "not_found", "Link not found");
      const verified =
        owner.secretHash !== null &&
        (await verifySecret(key, owner.secretHash, peppersFromEnv(c.env)));
      if (!verified) return forbidden(c);
    }
    if (!owner) return c.json(await loadPublicStats(c.env, id, now));
    const fresh = await loadFresh({
      source: () => createVisitSource(c.env),
      cursor: owner.cursor,
      now,
      ttlSeconds: parseFreshTtl(c.env.AE_FRESH_TTL),
    });
    const { visits, countries } = mergeCountries(owner, fresh.rows, id, owner.createdAt);
    return c.json(
      {
        visits,
        countries,
        cities: mergeCities(owner, fresh.rows, id, owner.createdAt),
        partial: fresh.partial,
      },
      200,
      { "Cache-Control": "no-store" },
    );
  });

  // One row, recomputed by the daily cron: the numbers can lag by up to about 24 hours.
  app.get("/stats", rateLimit<AppEnv>("RL_STATS", byIp), async (c) => {
    const stats = await globalStats(c.env.DB);
    return c.json({
      links: stats?.links ?? 0,
      visits: stats?.visits ?? 0,
      countries: stats?.countries ?? [],
      updatedAt: isoOrNull(stats?.updatedAt ?? null),
    });
  });

  return app;
}
