/** Small display helpers shared by the Worker (OG text) and the client. */

/** Two-letter country code to its flag emoji. */
export function countryFlag(code: string): string {
	if (!/^[A-Za-z]{2}$/.test(code)) return "\u{1F3F3}\u{FE0F}";
	return String.fromCodePoint(
		...[...code.toUpperCase()].map((char) => 0x1f1e6 - 65 + char.charCodeAt(0))
	);
}

const REGION_NAMES =
	typeof Intl !== "undefined" && "DisplayNames" in Intl
		? new Intl.DisplayNames(["en"], { type: "region" })
		: null;

export function countryName(code: string): string {
	if (!/^[A-Za-z]{2}$/.test(code)) return "Unknown";
	try {
		return REGION_NAMES?.of(code.toUpperCase()) ?? code;
	} catch {
		return code;
	}
}

export function formatNumber(value: number): string {
	if (value < 1000) return String(value);
	if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
	return `${(value / 1_000_000).toFixed(1)}M`;
}

/** "3 days ago" / "in 2 hours", falling back to a date when far away. */
export function relativeTime(iso: string | null, locale = "en"): string {
	if (!iso) return "—";
	const then = new Date(iso).getTime();
	if (!Number.isFinite(then)) return "—";

	const diffSec = Math.round((then - Date.now()) / 1000);
	const abs = Math.abs(diffSec);
	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

	if (abs < 60) return rtf.format(diffSec, "second");
	if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
	if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
	if (abs < 2_592_000) return rtf.format(Math.round(diffSec / 86_400), "day");

	return new Date(iso).toLocaleDateString(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/** Shortens a URL for display without hiding which host it points at. */
export function truncateUrl(url: string, max = 60): string {
	if (url.length <= max) return url;
	try {
		const parsed = new URL(url);
		const tail = parsed.pathname + parsed.search;
		const room = max - parsed.host.length - 3;
		if (room > 4) return `${parsed.host}${tail.slice(0, room)}…`;
		return `${parsed.host.slice(0, max - 1)}…`;
	} catch {
		return `${url.slice(0, max - 1)}…`;
	}
}
