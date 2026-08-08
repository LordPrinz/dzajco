import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppContext, Env } from "../env";
import { sign, verify } from "./crypto";

const COOKIE = "dz_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

type SessionPayload = {
	uid: string;
	/** Expiry, seconds since epoch. */
	exp: number;
};

/**
 * Sessions are signed cookies rather than database rows. On the free plan every
 * D1 read counts, and a session lookup on every request would be the single
 * hottest query in the app for no benefit — the trade-off is that sign-out is
 * client-side and the cookie stays valid until it expires.
 */
export async function createSession(
	c: Context<AppContext>,
	userId: string
): Promise<void> {
	const secret = requireSecret(c.env);
	const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
	const token = await sign({ uid: userId, exp } satisfies SessionPayload, secret);

	setCookie(c, COOKIE, token, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: MAX_AGE_SEC,
	});
}

export async function readSession(c: Context<AppContext>): Promise<string | null> {
	const token = getCookie(c, COOKIE);
	if (!token || !c.env.SESSION_SECRET) return null;

	const payload = await verify<SessionPayload>(token, c.env.SESSION_SECRET);
	if (!payload?.uid) return null;
	if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

	return payload.uid;
}

export function clearSession(c: Context<AppContext>): void {
	deleteCookie(c, COOKIE, { path: "/" });
}

/* ---- OAuth state ------------------------------------------------- */

const STATE_COOKIE = "dz_oauth";
const STATE_TTL_SEC = 600;

type StatePayload = { n: string; p: string; exp: number };

/**
 * CSRF protection for the OAuth handshake: the nonce is signed into a
 * short-lived cookie and compared against the `state` echoed back by the
 * provider.
 */
export async function issueOAuthState(
	c: Context<AppContext>,
	provider: string
): Promise<string> {
	const secret = requireSecret(c.env);
	const nonce = crypto.randomUUID();
	const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SEC;
	const token = await sign({ n: nonce, p: provider, exp } satisfies StatePayload, secret);

	setCookie(c, STATE_COOKIE, token, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: STATE_TTL_SEC,
	});
	return nonce;
}

export async function consumeOAuthState(
	c: Context<AppContext>,
	provider: string,
	nonce: string | undefined
): Promise<boolean> {
	const token = getCookie(c, STATE_COOKIE);
	deleteCookie(c, STATE_COOKIE, { path: "/" });

	if (!token || !nonce || !c.env.SESSION_SECRET) return false;

	const payload = await verify<StatePayload>(token, c.env.SESSION_SECRET);
	if (!payload) return false;

	return (
		payload.p === provider &&
		payload.n === nonce &&
		payload.exp > Math.floor(Date.now() / 1000)
	);
}

function requireSecret(env: Env): string {
	if (!env.SESSION_SECRET) {
		throw new Error("SESSION_SECRET is not configured");
	}
	return env.SESSION_SECRET;
}
