import type { Env } from "../env";
import type { LinkStatus, LinkSummary } from "@shared/types";
import type { Geo } from "./geo";
import type { UaInfo } from "./ua";

export type LinkRow = {
	code: string;
	target: string;
	user_id: string | null;
	secret_hash: string | null;
	password_hash: string | null;
	title: string | null;
	created_at: number;
	starts_at: number | null;
	expires_at: number | null;
	max_clicks: number | null;
	disabled: number;
	clicks: number;
	uniques: number;
	last_click_at: number | null;
	track_utm: number;
};

const CACHE_TTL_SEC = 300;

/** The subset the redirect path needs; kept small because it lives in KV. */
type CachedLink = Pick<
	LinkRow,
	| "code"
	| "target"
	| "password_hash"
	| "starts_at"
	| "expires_at"
	| "max_clicks"
	| "disabled"
	| "track_utm"
	| "clicks"
>;

export async function getLink(env: Env, code: string): Promise<LinkRow | null> {
	return env.DB.prepare("SELECT * FROM links WHERE code = ?1")
		.bind(code)
		.first<LinkRow>();
}

/**
 * Read-through cache for redirects.
 *
 * KV on the free plan allows plenty of reads but only 1,000 writes a day, so we
 * write here on a miss and invalidate on edit/delete — never on the click path
 * itself. `clicks` in the cached copy is therefore a lower bound; the max-click
 * cap is re-checked against D1 before it actually blocks a redirect.
 */
export async function getLinkCached(
	env: Env,
	code: string
): Promise<CachedLink | null> {
	const key = `link:${code}`;

	try {
		const hit = await env.LINK_CACHE.get<CachedLink>(key, "json");
		if (hit) return hit;
	} catch {
		// Cache trouble is not a reason to fail a redirect.
	}

	const row = await getLink(env, code);
	if (!row) return null;

	const slim: CachedLink = {
		code: row.code,
		target: row.target,
		password_hash: row.password_hash,
		starts_at: row.starts_at,
		expires_at: row.expires_at,
		max_clicks: row.max_clicks,
		disabled: row.disabled,
		track_utm: row.track_utm,
		clicks: row.clicks,
	};

	try {
		await env.LINK_CACHE.put(key, JSON.stringify(slim), {
			expirationTtl: CACHE_TTL_SEC,
		});
	} catch {
		// ditto
	}
	return slim;
}

export async function invalidateLink(env: Env, code: string): Promise<void> {
	try {
		await env.LINK_CACHE.delete(`link:${code}`);
	} catch {
		// The TTL will take care of it.
	}
}

export type ClickContext = {
	geo: Geo;
	ua: UaInfo;
	referrer: string;
	utm: {
		source: string;
		medium: string;
		campaign: string;
		term: string;
		content: string;
	};
	trackUtm: boolean;
};

/**
 * Records one click as a set of counter upserts.
 *
 * No per-click row is written: the aggregates below are the only thing that
 * survives a visit, which keeps the write budget bounded and means there is no
 * visitor-level history to leak. Call this from `waitUntil` — the visitor
 * should never wait on it.
 */
export async function recordClick(
	env: Env,
	code: string,
	ctx: ClickContext
): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	const day = new Date(now * 1000).toISOString().slice(0, 10);
	const { geo, ua, referrer, utm } = ctx;

	const statements = [
		env.DB.prepare(
			`UPDATE links SET clicks = clicks + 1, last_click_at = ?2 WHERE code = ?1`
		).bind(code, now),

		env.DB.prepare(
			`INSERT INTO clicks_daily (code, day, clicks) VALUES (?1, ?2, 1)
			 ON CONFLICT (code, day) DO UPDATE SET clicks = clicks + 1`
		).bind(code, day),

		env.DB.prepare(
			`INSERT INTO clicks_geo (code, country, region, city, lat, lon, clicks)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
			 ON CONFLICT (code, country, region, city) DO UPDATE SET
			   clicks = clicks + 1,
			   lat = COALESCE(excluded.lat, clicks_geo.lat),
			   lon = COALESCE(excluded.lon, clicks_geo.lon)`
		).bind(code, geo.country, geo.region, geo.city, geo.lat, geo.lon),

		env.DB.prepare(
			`INSERT INTO clicks_ref (code, referrer, clicks) VALUES (?1, ?2, 1)
			 ON CONFLICT (code, referrer) DO UPDATE SET clicks = clicks + 1`
		).bind(code, referrer),

		env.DB.prepare(
			`INSERT INTO clicks_device (code, device, os, browser, clicks)
			 VALUES (?1, ?2, ?3, ?4, 1)
			 ON CONFLICT (code, device, os, browser) DO UPDATE SET clicks = clicks + 1`
		).bind(code, ua.device, ua.os, ua.browser),

		env.DB.prepare(
			`UPDATE globals SET value = value + 1 WHERE key = 'total_clicks'`
		),

		env.DB.prepare(
			`INSERT INTO globals_geo (country, clicks) VALUES (?1, 1)
			 ON CONFLICT (country) DO UPDATE SET clicks = clicks + 1`
		).bind(geo.country),
	];

	// UTM capture is a signed-in-only feature, and an all-empty row would just
	// be noise.
	const hasUtm =
		utm.source || utm.medium || utm.campaign || utm.term || utm.content;

	if (ctx.trackUtm && hasUtm) {
		statements.push(
			env.DB.prepare(
				`INSERT INTO clicks_utm (code, source, medium, campaign, term, content, clicks)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
				 ON CONFLICT (code, source, medium, campaign, term, content)
				 DO UPDATE SET clicks = clicks + 1`
			).bind(code, utm.source, utm.medium, utm.campaign, utm.term, utm.content)
		);
	}

	try {
		await env.DB.batch(statements);
	} catch {
		// A lost click count must never surface to the visitor.
	}
}

export function statusOf(row: LinkRow, now = Date.now()): LinkStatus {
	const seconds = Math.floor(now / 1000);

	if (row.disabled) return "disabled";
	if (row.expires_at !== null && row.expires_at <= seconds) return "expired";
	if (row.starts_at !== null && row.starts_at > seconds) return "scheduled";
	if (row.max_clicks !== null && row.clicks >= row.max_clicks) return "exhausted";
	return "active";
}

const toIso = (seconds: number | null): string | null =>
	seconds === null ? null : new Date(seconds * 1000).toISOString();

export function toSummary(row: LinkRow, appUrl: string): LinkSummary {
	return {
		code: row.code,
		shortUrl: `${appUrl.replace(/\/$/, "")}/${row.code}`,
		target: row.target,
		title: row.title,
		createdAt: new Date(row.created_at * 1000).toISOString(),
		startsAt: toIso(row.starts_at),
		expiresAt: toIso(row.expires_at),
		hasPassword: Boolean(row.password_hash),
		maxClicks: row.max_clicks,
		disabled: Boolean(row.disabled),
		clicks: row.clicks,
		lastClickAt: toIso(row.last_click_at),
		trackUtm: Boolean(row.track_utm),
		status: statusOf(row),
	};
}
