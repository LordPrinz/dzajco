/**
 * Target-URL validation.
 *
 * A shortener is an open redirect by design, so the job here is to keep it from
 * becoming something worse: a probe into private networks, a `javascript:`
 * payload, or a loop back into ourselves.
 */

export type UrlError =
	| "invalid"
	| "scheme"
	| "private"
	| "self"
	| "too_long"
	| "credentials";

const MAX_URL_LENGTH = 2048;
const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/** Hostnames that must never be reachable through a short link. */
const BLOCKED_HOSTS = new Set([
	"localhost",
	"localhost.localdomain",
	"metadata.google.internal",
	"[::1]",
	"[::]",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".onion"];

export function validateTarget(
	raw: string,
	appUrl: string
): { ok: true; url: string } | { ok: false; error: UrlError } {
	const trimmed = raw.trim();
	if (!trimmed) return { ok: false, error: "invalid" };
	if (trimmed.length > MAX_URL_LENGTH) return { ok: false, error: "too_long" };

	// Bare hosts like "example.com/x" are the common case in the input box.
	const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;

	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return { ok: false, error: "invalid" };
	}

	if (!ALLOWED_SCHEMES.has(url.protocol)) return { ok: false, error: "scheme" };

	// `https://user:pass@evil.tld` renders as the victim host in many clients.
	if (url.username || url.password) return { ok: false, error: "credentials" };

	const host = url.hostname.toLowerCase();
	if (!host) return { ok: false, error: "invalid" };

	// Single-label hosts ("intranet", "router") only resolve on private
	// networks; IPv6 literals arrive bracketed and legitimately have no dot.
	if (!host.startsWith("[") && !host.includes(".")) {
		return { ok: false, error: "private" };
	}
	if (BLOCKED_HOSTS.has(host)) return { ok: false, error: "private" };
	if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
		return { ok: false, error: "private" };
	}
	if (isPrivateAddress(host)) return { ok: false, error: "private" };

	// Refuse to shorten our own short links — that is just a redirect loop.
	try {
		if (host === new URL(appUrl).hostname.toLowerCase()) {
			return { ok: false, error: "self" };
		}
	} catch {
		// APP_URL misconfigured; not a reason to reject the user's link.
	}

	return { ok: true, url: url.toString() };
}

function isPrivateAddress(host: string): boolean {
	// IPv6 literals arrive bracketed.
	if (host.startsWith("[")) {
		const inner = host.slice(1, -1).toLowerCase();
		return (
			inner === "::1" ||
			inner.startsWith("fc") || // unique local
			inner.startsWith("fd") ||
			inner.startsWith("fe80") || // link local
			inner.startsWith("::ffff:") // IPv4-mapped
		);
	}

	const parts = host.split(".");
	if (parts.length !== 4) return false;

	const octets = parts.map(Number);
	if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

	const [a, b] = octets as [number, number, number, number];
	return (
		a === 0 || // "this network"
		a === 10 || // private
		a === 127 || // loopback
		(a === 169 && b === 254) || // link-local, incl. cloud metadata
		(a === 172 && b >= 16 && b <= 31) || // private
		(a === 192 && b === 168) || // private
		(a === 100 && b >= 64 && b <= 127) || // CGNAT
		a >= 224 // multicast and reserved
	);
}

/** Referrer hostname for stats, or "direct". Never the full referring URL. */
export function referrerHost(value: string | null): string {
	if (!value) return "direct";
	try {
		const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
		return host.slice(0, 100) || "direct";
	} catch {
		return "direct";
	}
}

/** UTM parameters carried on the *incoming* click. */
export function readUtm(url: URL): {
	source: string;
	medium: string;
	campaign: string;
	term: string;
	content: string;
} {
	const get = (key: string) =>
		(url.searchParams.get(key) ?? "").replace(/\p{C}/gu, "").trim().slice(0, 80);

	return {
		source: get("utm_source"),
		medium: get("utm_medium"),
		campaign: get("utm_campaign"),
		term: get("utm_term"),
		content: get("utm_content"),
	};
}

/**
 * Forwards query parameters from the short link onto the target, so
 * `dzaj.de/x?utm_source=nl` lands on `target?utm_source=nl`. Parameters already
 * present on the target win.
 */
export function mergeQuery(target: string, incoming: URL): string {
	if (![...incoming.searchParams].length) return target;

	try {
		const out = new URL(target);
		for (const [key, value] of incoming.searchParams) {
			if (!out.searchParams.has(key)) out.searchParams.append(key, value);
		}
		return out.toString();
	} catch {
		return target;
	}
}
