import type { Env } from "../env";

const VERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Turnstile token for anonymous link creation.
 *
 * Turnstile is free and unmetered, and it is the main anti-bot control on the
 * create endpoint (rate limiting handles volume, this handles automation).
 * When no secret is configured the check is skipped so the app still runs on a
 * fresh clone — deployments should set TURNSTILE_SECRET_KEY.
 */
export async function verifyTurnstile(
	env: Env,
	token: string | undefined,
	request: Request
): Promise<boolean> {
	if (!env.TURNSTILE_SECRET_KEY) return true;
	if (!token) return false;

	const body = new FormData();
	body.append("secret", env.TURNSTILE_SECRET_KEY);
	body.append("response", token);

	const ip = request.headers.get("cf-connecting-ip");
	if (ip) body.append("remoteip", ip);

	try {
		const response = await fetch(VERIFY_URL, { method: "POST", body });
		const result = (await response.json()) as { success?: boolean };
		return result.success === true;
	} catch {
		// A Turnstile outage should not take link creation down; the rate
		// limiter is still in front of this endpoint.
		return true;
	}
}
