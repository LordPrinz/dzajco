import { IdTakenError, insertLink, isHostBlocked } from "../db/queries";
import { parseExpiry } from "../domain/expiry";
import { parseCustomName, randomId } from "../domain/ids";
import { currentVersion, generateSecretKey, hashSecret, peppersFromEnv } from "../domain/secret";
import { parseTarget } from "../domain/url-policy";

const RANDOM_ID_ATTEMPTS = 5;

export interface CreateLinkInput {
  url: string;
  customName?: string | undefined;
  expiresAt?: string | null | undefined;
}

export type CreateLinkFailure =
  | { ok: false; status: 400; code: string }
  | { ok: false; status: 409; code: "id_taken" }
  | { ok: false; status: 503; code: "service_unavailable" };

export type CreateLinkResult =
  | {
      ok: true;
      id: string;
      shortUrl: string;
      secretKey: string;
      /** Normalized target. */
      target: string;
      /** Lowercase punycode host of the target. */
      host: string;
      isIdn: boolean;
      expiresAt: string | null;
    }
  | CreateLinkFailure;

/** Thrown when every random id drawn for a new link was already taken. */
export class IdSpaceExhaustedError extends Error {
  override name = "IdSpaceExhaustedError";
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

function fail(status: 400, code: string): CreateLinkFailure {
  return { ok: false, status, code };
}

/**
 * Validates and stores a new link; the API route and the HTML form both go through here. Policy
 * violations come back as a result, a failing database or an exhausted id space throws or maps to 503.
 */
export async function createLink(
  env: Cloudflare.Env,
  input: CreateLinkInput,
  requestUrl: string,
): Promise<CreateLinkResult> {
  const target = parseTarget(input.url, { ownHosts: ownHosts(env, requestUrl) });
  if (!target.ok) return fail(400, target.code);
  let blocked: boolean;
  try {
    blocked = await isHostBlocked(env.DB, target.host);
  } catch {
    // Fail closed without claiming the target is blocked.
    return { ok: false, status: 503, code: "service_unavailable" };
  }
  if (blocked) return fail(400, "blocked_target");

  let customName: string | undefined;
  if (input.customName !== undefined) {
    const name = parseCustomName(input.customName);
    if (!name.ok) return fail(400, name.code);
    customName = name.name;
  }

  const now = Date.now();
  const expiry = parseExpiry(input.expiresAt ?? null, now);
  if (!expiry.ok) return fail(400, expiry.code);

  const secretKey = generateSecretKey();
  const secretHash = await hashSecret(secretKey, {
    version: currentVersion(env),
    peppers: peppersFromEnv(env),
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
      await insertLink(env.DB, { ...link, id: customName });
      id = customName;
    } catch (error) {
      if (error instanceof IdTakenError) return { ok: false, status: 409, code: "id_taken" };
      throw error;
    }
  } else {
    for (let attempt = 0; attempt < RANDOM_ID_ATTEMPTS && id === undefined; attempt += 1) {
      const candidate = randomId();
      try {
        await insertLink(env.DB, { ...link, id: candidate });
        id = candidate;
      } catch (error) {
        if (!(error instanceof IdTakenError)) throw error;
      }
    }
    if (id === undefined) throw new IdSpaceExhaustedError("No free random id");
  }

  return {
    ok: true,
    id,
    shortUrl: new URL(`/${encodeURIComponent(id)}`, env.PUBLIC_ORIGIN).href,
    secretKey,
    target: target.url,
    host: target.host,
    isIdn: target.isIdn,
    expiresAt: expiry.expiresAt === null ? null : new Date(expiry.expiresAt).toISOString(),
  };
}
