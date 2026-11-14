import { type Context, Hono } from "hono";
import * as v from "valibot";
import { IdTakenError, insertLink, isHostBlocked } from "../db/queries";
import { parseExpiry } from "../domain/expiry";
import { parseCustomName, randomId } from "../domain/ids";
import { createLinkSchema } from "../domain/schemas";
import { currentVersion, generateSecretKey, hashSecret, peppersFromEnv } from "../domain/secret";
import { parseTarget } from "../domain/url-policy";
import type { AppEnv } from "../lib/app-env";
import { clientIpKey } from "../lib/client-ip";
import { isoOrNull } from "../lib/time";
import { readOnlyCors } from "../middleware/cors";
import { apiError } from "../middleware/errors";
import { rateLimit } from "../middleware/rate-limit";
import { deleteLazily, isExpired, loadRecord, parseId } from "./redirect";

export const MAX_BODY_BYTES = 8 * 1024;
const RANDOM_ID_ATTEMPTS = 5;

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
};

function badRequest(c: Context, code: string): Response {
  return apiError(c, 400, code, ERROR_MESSAGES[code] ?? "Invalid request");
}

/**
 * Hosts a target must not point at: the public origin and the host this request came in on. On
 * `*.workers.dev` the whole account subdomain (last three labels) counts, so version preview hosts
 * such as `<version>-dzajco.<account>.workers.dev` are covered too.
 */
export function ownHosts(env: Cloudflare.Env, requestUrl: string): string[] {
  const host = new URL(requestUrl).hostname.toLowerCase();
  const hosts = [new URL(env.PUBLIC_ORIGIN).host, host];
  if (host.endsWith(".workers.dev")) hosts.push(host.split(".").slice(-3).join("."));
  return hosts;
}

/** Thrown when every random id drawn for a new link was already taken. */
export class IdSpaceExhaustedError extends Error {
  override name = "IdSpaceExhaustedError";
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.split(";")[0]?.trim().toLowerCase() === "application/json";
}

/** Reads the body up to `limit` bytes; null when it is larger, without buffering the rest. */
async function readCapped(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
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

    const target = parseTarget(input.url, { ownHosts: ownHosts(c.env, c.req.url) });
    if (!target.ok) return badRequest(c, target.code);
    let blocked: boolean;
    try {
      blocked = await isHostBlocked(c.env.DB, target.host);
    } catch {
      // Fail closed without claiming the target is blocked.
      return apiError(c, 503, "service_unavailable", "Try again later");
    }
    if (blocked) return badRequest(c, "blocked_target");

    let customName: string | undefined;
    if (input.customName !== undefined) {
      const name = parseCustomName(input.customName);
      if (!name.ok) return badRequest(c, name.code);
      customName = name.name;
    }

    const now = Date.now();
    const expiry = parseExpiry(input.expiresAt ?? null, now);
    if (!expiry.ok) return badRequest(c, expiry.code);

    const secretKey = generateSecretKey();
    const secretHash = await hashSecret(secretKey, {
      version: currentVersion(c.env),
      peppers: peppersFromEnv(c.env),
    });
    const link = {
      target: target.url,
      secretHash,
      expiresAt: expiry.expiresAt,
      createdAt: now,
      isCustom: customName !== undefined,
    };

    let id: string | undefined;
    if (customName !== undefined) {
      try {
        await insertLink(c.env.DB, { ...link, id: customName });
        id = customName;
      } catch (error) {
        if (error instanceof IdTakenError) {
          return apiError(c, 409, "id_taken", "customName is already taken");
        }
        throw error;
      }
    } else {
      for (let attempt = 0; attempt < RANDOM_ID_ATTEMPTS && id === undefined; attempt += 1) {
        const candidate = randomId();
        try {
          await insertLink(c.env.DB, { ...link, id: candidate });
          id = candidate;
        } catch (error) {
          if (!(error instanceof IdTakenError)) throw error;
        }
      }
      if (id === undefined) throw new IdSpaceExhaustedError("No free random id");
    }

    const shortUrl = new URL(`/${encodeURIComponent(id)}`, c.env.PUBLIC_ORIGIN).href;
    return c.json({ id, shortUrl, secretKey, expiresAt: isoOrNull(expiry.expiresAt) }, 201, {
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
