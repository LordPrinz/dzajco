/**
 * Short-code alphabet and validation, shared by the Worker and the browser so
 * the client can reject a bad custom name before spending a request on it.
 */

/**
 * Unambiguous alphabet: no `0`/`O`/`o`, no `1`/`l`/`I`, no `5`/`S`, no `2`/`Z`,
 * no `8`/`B`. What survives cannot be misread off a QR scan, a screenshot or a
 * sticky note.
 */
export const CODE_ALPHABET = "34679acdefghjkmnpqrtuvwxyACDEFGHJKLMNPQRTUVWXY";

export const AUTO_CODE_MIN = 4;
export const AUTO_CODE_MAX = 12;

/** Custom names are laxer than generated ones, but still URL-safe. */
export const CUSTOM_NAME_MIN = 2;
export const CUSTOM_NAME_MAX = 32;
const CUSTOM_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;

/**
 * Paths the app itself owns. A custom name may not collide with one, and the
 * router must not treat one as a short code.
 */
export const RESERVED_CODES = new Set([
	"about",
	"admin",
	"api",
	"api-docs",
	"assets",
	"dashboard",
	"dzajapi",
	"favicon.ico",
	"favicon.svg",
	"history",
	"index",
	"login",
	"logout",
	"new",
	"privacy-policy",
	"qr",
	"robots.txt",
	"settings",
	"sitemap.xml",
	"static",
	"terms",
	"www",
]);

/** Words we refuse to hand out or accept, in any casing. */
const BLOCKED_SUBSTRINGS = ["dzajco", "phish", "paypal", "login-"];

export type NameError =
	| "too_short"
	| "too_long"
	| "charset"
	| "reserved"
	| "blocked";

export function validateCustomName(name: string): NameError | null {
	if (name.length < CUSTOM_NAME_MIN) return "too_short";
	if (name.length > CUSTOM_NAME_MAX) return "too_long";
	if (!CUSTOM_NAME_RE.test(name)) return "charset";

	const lower = name.toLowerCase();
	if (RESERVED_CODES.has(lower)) return "reserved";
	if (BLOCKED_SUBSTRINGS.some((word) => lower.includes(word))) return "blocked";
	return null;
}

/** True when `segment` should be resolved as a short link rather than a page. */
export function looksLikeCode(segment: string): boolean {
	if (!segment || segment.length > CUSTOM_NAME_MAX) return false;
	if (RESERVED_CODES.has(segment.toLowerCase())) return false;
	if (segment.includes(".")) return false; // a static file, not a code
	return CUSTOM_NAME_RE.test(segment);
}

/**
 * Generates a random code of `length` characters using rejection sampling, so
 * every character of the alphabet stays equally likely (modulo bias would
 * quietly favour the first few letters).
 */
export function generateCode(length: number): string {
	const alphabet = CODE_ALPHABET;
	const max = 256 - (256 % alphabet.length);
	let out = "";

	while (out.length < length) {
		const bytes = new Uint8Array(length * 2);
		crypto.getRandomValues(bytes);
		for (const byte of bytes) {
			if (byte >= max) continue; // reject, keeps the distribution flat
			out += alphabet[byte % alphabet.length];
			if (out.length === length) break;
		}
	}
	return out;
}
