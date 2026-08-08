import type { Env, RateLimiter } from "../env";
import { sha256Hex } from "./crypto";

export type Bucket = "create" | "read" | "auth";

const FALLBACK_RULES: Record<Bucket, { limit: number; windowSec: number }> = {
	create: { limit: 20, windowSec: 60 },
	read: { limit: 120, windowSec: 60 },
	auth: { limit: 10, windowSec: 60 },
};

function binding(env: Env, bucket: Bucket): RateLimiter | undefined {
	if (bucket === "create") return env.RL_CREATE;
	if (bucket === "auth") return env.RL_AUTH;
	return env.RL_READ;
}

/**
 * The caller's identity for rate-limiting purposes. Signed-in users get their
 * own budget; everyone else is bucketed by IP. The IP is hashed and never
 * stored in a durable table.
 */
export async function limiterKey(
	request: Request,
	userId: string | null
): Promise<string> {
	if (userId) return `u:${userId}`;
	const ip =
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown";
	return `ip:${(await sha256Hex(ip)).slice(0, 32)}`;
}

/**
 * Returns true when the request is over budget.
 *
 * Prefers Cloudflare's native rate-limit binding (no storage, no billing). If
 * that binding is missing the D1 ledger takes over so local dev and any
 * misconfigured deploy still enforce a limit rather than silently allowing
 * everything.
 */
export async function isRateLimited(
	env: Env,
	bucket: Bucket,
	key: string
): Promise<boolean> {
	const native = binding(env, bucket);
	if (native) {
		try {
			const { success } = await native.limit({ key: `${bucket}:${key}` });
			return !success;
		} catch {
			// fall through to the D1 ledger
		}
	}
	return fallbackLimit(env, bucket, key);
}

async function fallbackLimit(
	env: Env,
	bucket: Bucket,
	key: string
): Promise<boolean> {
	const rule = FALLBACK_RULES[bucket];
	const now = Math.floor(Date.now() / 1000);
	const id = `${bucket}:${key}`;

	try {
		// One statement: start a fresh window if the old one lapsed, otherwise
		// increment. Doing it in SQL keeps two concurrent requests from both
		// reading a stale count.
		const row = await env.DB.prepare(
			`INSERT INTO rate_limits (bucket, count, reset_at)
			 VALUES (?1, 1, ?2 + ?3)
			 ON CONFLICT (bucket) DO UPDATE SET
			   count    = CASE WHEN rate_limits.reset_at <= ?2 THEN 1 ELSE rate_limits.count + 1 END,
			   reset_at = CASE WHEN rate_limits.reset_at <= ?2 THEN ?2 + ?3 ELSE rate_limits.reset_at END
			 RETURNING count`
		)
			.bind(id, now, rule.windowSec)
			.first<{ count: number }>();

		return (row?.count ?? 0) > rule.limit;
	} catch {
		// Never let a limiter failure take the site down.
		return false;
	}
}
