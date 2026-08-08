import type { Env } from "./env";
import { getLink, getLinkCached, recordClick } from "./lib/links";
import { readGeo } from "./lib/geo";
import { isVerifiedBot, parseUserAgent } from "./lib/ua";
import { mergeQuery, readUtm, referrerHost } from "./lib/urls";

/** Why a short link did not resolve to a redirect. */
export type BlockedReason =
	| "not_found"
	| "disabled"
	| "scheduled"
	| "expired"
	| "exhausted"
	| "password";

export type Resolution =
	| { kind: "redirect"; target: string }
	| { kind: "blocked"; reason: BlockedReason; startsAt: string | null };

const STATUS_FOR: Record<BlockedReason, number> = {
	not_found: 404,
	disabled: 410,
	expired: 410,
	exhausted: 410,
	// 425 Too Early says exactly this: correct request, wrong moment.
	scheduled: 425,
	password: 401,
};

export function statusForReason(reason: BlockedReason): number {
	return STATUS_FOR[reason];
}

/**
 * Decides what a hit on `/:code` should do, without any side effects.
 *
 * The happy path is served from the KV cache. `max_clicks` is the one field the
 * cache cannot be trusted for — a cached copy lags behind the counter — so
 * capped links are always re-read from D1.
 */
export async function resolveLink(
	env: Env,
	code: string,
	url: URL
): Promise<Resolution> {
	let link = await getLinkCached(env, code);
	if (!link) return { kind: "blocked", reason: "not_found", startsAt: null };

	if (link.max_clicks !== null) {
		const fresh = await getLink(env, code);
		if (!fresh) return { kind: "blocked", reason: "not_found", startsAt: null };
		link = fresh;
	}

	const now = Math.floor(Date.now() / 1000);
	const startsAt = link.starts_at
		? new Date(link.starts_at * 1000).toISOString()
		: null;

	if (link.disabled) return { kind: "blocked", reason: "disabled", startsAt };
	if (link.starts_at !== null && link.starts_at > now) {
		return { kind: "blocked", reason: "scheduled", startsAt };
	}
	if (link.expires_at !== null && link.expires_at <= now) {
		return { kind: "blocked", reason: "expired", startsAt };
	}
	if (link.max_clicks !== null && link.clicks >= link.max_clicks) {
		return { kind: "blocked", reason: "exhausted", startsAt };
	}
	if (link.password_hash) {
		return { kind: "blocked", reason: "password", startsAt };
	}

	return { kind: "redirect", target: mergeQuery(link.target, url) };
}

/**
 * Counts a click. Safe to call from `waitUntil` — the visitor is already on
 * their way to the target by then.
 *
 * Automated traffic is redirected like anyone else but never counted: chat
 * clients and crawlers unfurling a link would otherwise show up as visits from
 * whichever data centre fetched the preview.
 */
export async function countClick(
	env: Env,
	request: Request,
	code: string,
	url: URL,
	trackUtm: boolean
): Promise<void> {
	const ua = parseUserAgent(request.headers.get("user-agent"));
	if (ua.isBot || isVerifiedBot(request)) return;

	await recordClick(env, code, {
		geo: readGeo(request),
		ua,
		referrer: referrerHost(request.headers.get("referer")),
		utm: readUtm(url),
		trackUtm,
	});
}

/** Redirects should never be cached by an intermediary — the target can change. */
export function redirectResponse(target: string): Response {
	return new Response(null, {
		status: 302,
		headers: {
			location: target,
			"cache-control": "no-store, no-cache, must-revalidate",
			// Do not leak the short code to the destination.
			"referrer-policy": "no-referrer",
		},
	});
}
