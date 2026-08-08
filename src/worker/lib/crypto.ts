/** Web Crypto helpers. Everything here runs on the Workers runtime as-is. */

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = "";
	for (const byte of view) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
	// Backed by a plain ArrayBuffer (not ArrayBufferLike) so the result is
	// accepted directly as a BufferSource by the Web Crypto calls below.
	const out = new Uint8Array(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

export { toBase64Url, fromBase64Url };

/** Random URL-safe token, `bytes` of entropy. */
export function randomToken(bytes = 24): string {
	const buf = new Uint8Array(bytes);
	crypto.getRandomValues(buf);
	return toBase64Url(buf);
}

export async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/** Length-independent comparison, so a mismatch leaks no position. */
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

const PBKDF2_ITERATIONS = 100_000;

/** Serialised as `iterations:salt:hash`, all base64url. */
export async function hashPassword(password: string): Promise<string> {
	const salt = new Uint8Array(new ArrayBuffer(16));
	crypto.getRandomValues(salt);
	const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
	return `${PBKDF2_ITERATIONS}:${toBase64Url(salt)}:${toBase64Url(hash)}`;
}

export async function verifyPassword(
	password: string,
	stored: string
): Promise<boolean> {
	const [iterationsRaw, saltRaw, hashRaw] = stored.split(":");
	if (!iterationsRaw || !saltRaw || !hashRaw) return false;

	const iterations = Number(iterationsRaw);
	if (!Number.isFinite(iterations) || iterations < 1000) return false;

	const hash = await pbkdf2(password, fromBase64Url(saltRaw), iterations);
	return timingSafeEqual(toBase64Url(hash), hashRaw);
}

async function pbkdf2(
	password: string,
	salt: BufferSource,
	iterations: number
): Promise<ArrayBuffer> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"]
	);
	return crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations, hash: "SHA-256" },
		key,
		256
	);
}

/* ------------------------------------------------------------------ *
 * Signed, stateless cookie payloads (sessions, OAuth state).
 * ------------------------------------------------------------------ */

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"]
	);
}

/** `payload.signature`; the payload is readable but not forgeable. */
export async function sign(
	payload: Record<string, unknown>,
	secret: string
): Promise<string> {
	const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
	const signature = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(secret),
		encoder.encode(body)
	);
	return `${body}.${toBase64Url(signature)}`;
}

export async function verify<T>(
	token: string,
	secret: string
): Promise<T | null> {
	const [body, signature] = token.split(".");
	if (!body || !signature) return null;

	const ok = await crypto.subtle.verify(
		"HMAC",
		await hmacKey(secret),
		fromBase64Url(signature),
		encoder.encode(body)
	);
	if (!ok) return null;

	try {
		return JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T;
	} catch {
		return null;
	}
}
