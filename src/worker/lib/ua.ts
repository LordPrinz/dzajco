/**
 * Deliberately small user-agent classification. We only ever store a coarse
 * bucket (device / os / browser), never the raw string, so a full UA database
 * would be a lot of bytes for no extra signal.
 */

export type UaInfo = {
	device: "desktop" | "mobile" | "tablet" | "bot" | "other";
	os: string;
	browser: string;
	isBot: boolean;
};

const BOT_RE =
	/bot|crawler|spider|crawling|slurp|facebookexternalhit|whatsapp|telegram|discord|slack|preview|scraper|curl|wget|python-requests|axios|headless|lighthouse|pingdom|uptime|monitor/i;

const BROWSERS: [RegExp, string][] = [
	[/edg[ea]?\//i, "Edge"],
	[/opr\/|opera/i, "Opera"],
	[/samsungbrowser/i, "Samsung Internet"],
	[/firefox|fxios/i, "Firefox"],
	[/chrome|crios/i, "Chrome"],
	[/safari/i, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
	[/windows nt/i, "Windows"],
	[/iphone|ipad|ipod/i, "iOS"],
	[/mac os x/i, "macOS"],
	[/android/i, "Android"],
	[/cros/i, "ChromeOS"],
	[/linux/i, "Linux"],
];

export function parseUserAgent(raw: string | null): UaInfo {
	const ua = raw ?? "";

	if (!ua) return { device: "other", os: "", browser: "", isBot: false };

	if (BOT_RE.test(ua)) {
		return { device: "bot", os: "", browser: "", isBot: true };
	}

	const tablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua);
	const mobile = /mobi|iphone|ipod|android|blackberry|windows phone/i.test(ua);

	return {
		device: tablet ? "tablet" : mobile ? "mobile" : "desktop",
		os: match(SYSTEMS, ua),
		browser: match(BROWSERS, ua),
		isBot: false,
	};
}

function match(table: [RegExp, string][], ua: string): string {
	for (const [pattern, label] of table) if (pattern.test(ua)) return label;
	return "Other";
}

/**
 * Cloudflare tells us when a request came from a bot it has already verified
 * (search engines, preview fetchers). Combined with the UA heuristic this keeps
 * link-preview traffic out of the click counts.
 */
export function isVerifiedBot(request: Request): boolean {
	const cf = (request as { cf?: Record<string, unknown> }).cf;
	return Boolean(cf?.verifiedBotCategory);
}
