import { type Context, Hono } from "hono";
import * as v from "valibot";
import { createLinkSchema } from "../domain/schemas";
import type { AppEnv } from "../lib/app-env";
import { readCapped } from "../lib/body";
import { clientIpKey } from "../lib/client-ip";
import { isoOrNull } from "../lib/time";
import { readOnlyCors } from "../middleware/cors";
import { apiError } from "../middleware/errors";
import { rateLimit } from "../middleware/rate-limit";
import { createLink } from "../services/links";
import { deleteLazily, isExpired, loadRecord, parseId } from "./redirect";

export const MAX_BODY_BYTES = 8 * 1024;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_url: "The url is not a valid URL",
  url_too_long: "The url is too long",
  unsupported_scheme: "Only http and https URLs are allowed",
  credentials_not_allowed: "The url must not contain credentials",
  own_host: "Links to this service are not allowed",
  private_target: "Private and local addresses are not allowed",
  blocked_target: "This target is not allowed",
  invalid_name: "customName must be 3 to 32 letters, digits, _ or -",
  name_too_long: "customName is too long",
  reserved_name: "customName is reserved",
  mixed_script: "customName mixes Latin with another script",
  invalid_expiry: "expiresAt must be an ISO date that exists",
  expiry_in_past: "expiresAt must be in the future",
  expiry_too_far: "expiresAt must be at most one year ahead",
  id_taken: "customName is already taken",
  service_unavailable: "Try again later",
};

function failure(c: Context, status: 400 | 409 | 503, code: string): Response {
  return apiError(c, status, code, ERROR_MESSAGES[code] ?? "Invalid request");
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.split(";")[0]?.trim().toLowerCase() === "application/json";
}

/** `/api/v1` routes: create and read a link. Delete and stats live in `stats.ts`. */
export function apiRoutes() {
  const app = new Hono<AppEnv>();
  const byIp = (c: Context<AppEnv>) => clientIpKey(c.req.raw);

  app.use("*", readOnlyCors());

  app.post("/links", rateLimit<AppEnv>("RL_CREATE", byIp), async (c) => {
    if (!isJson(c.req.header("Content-Type"))) {
      return apiError(c, 415, "unsupported_media_type", "Content-Type must be application/json");
    }
    const raw = await readCapped(c.req.raw, MAX_BODY_BYTES);
    if (raw === null) return apiError(c, 413, "payload_too_large", "Request body is too large");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return apiError(c, 400, "invalid_json", "Request body is not valid JSON");
    }
    const parsed = v.safeParse(createLinkSchema, json);
    if (!parsed.success) return apiError(c, 400, "invalid_body", "Request body is invalid");
    const input = parsed.output;

    const created = await createLink(c.env, input, c.req.url);
    if (!created.ok) return failure(c, created.status, created.code);
    const { id, shortUrl, secretKey, expiresAt, target } = created;
    return c.json({ id, shortUrl, secretKey, url: target, expiresAt }, 201, {
      "Cache-Control": "no-store",
    });
  });

  app.get("/links/:id", rateLimit<AppEnv>("RL_REDIRECT", byIp), async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return apiError(c, 404, "not_found", "Link not found");
    const now = Date.now();
    const record = await loadRecord(c, id, now);
    if (!record) return apiError(c, 404, "not_found", "Link not found");
    if (isExpired(record, now)) {
      deleteLazily(c, id, now);
      return apiError(c, 410, "expired", "Link has expired");
    }
    if (record.blocked) return apiError(c, 410, "link_disabled", "Link has been disabled");
    return c.json({ id: record.id, url: record.target, expiresAt: isoOrNull(record.expiresAt) });
  });

  return app;
}
