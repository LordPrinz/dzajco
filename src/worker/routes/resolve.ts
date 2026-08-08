import { Hono } from "hono";
import type { AppContext } from "../env";
import { getLink } from "../lib/links";
import { verifyPassword } from "../lib/crypto";
import { mergeQuery } from "../lib/urls";
import { isRateLimited, limiterKey } from "../lib/ratelimit";
import { fail, readJson, tooManyRequests } from "../lib/responses";
import { countClick, resolveLink } from "../redirect";

const resolve = new Hono<AppContext>();

/**
 * Tells the SPA why `/:code` did not redirect, so it can render the right
 * screen (not found, expired, scheduled, password prompt). Only ever returns
 * the target for links that would have redirected anyway.
 */
resolve.get("/:code", async (c) => {
	if (await isRateLimited(c.env, "read", await limiterKey(c.req.raw, c.get("userId")))) {
		return tooManyRequests(c);
	}

	const code = c.req.param("code");
	const url = new URL(c.req.url);
	const resolution = await resolveLink(c.env, code, url);

	if (resolution.kind === "redirect") {
		return c.json({ state: "ready" as const, target: resolution.target });
	}

	return c.json({
		state: resolution.reason,
		startsAt: resolution.startsAt,
	});
});

/**
 * Exchanges a password for the target URL.
 *
 * The click is counted here rather than on the redirect, because the browser
 * navigates from JavaScript once it has the URL.
 */
resolve.post("/:code/unlock", async (c) => {
	// Password attempts share the strict auth budget, so a wordlist run against
	// a protected link is throttled the same way a login would be.
	if (await isRateLimited(c.env, "auth", await limiterKey(c.req.raw, null))) {
		return tooManyRequests(c);
	}

	const code = c.req.param("code");
	const body = await readJson<{ password?: string }>(c);
	const password = body?.password ?? "";

	const row = await getLink(c.env, code);
	if (!row) return fail(c, 404, "not_found", "Link not found.");

	const url = new URL(c.req.url);
	const resolution = await resolveLink(c.env, code, url);

	// A link can be both password-protected and expired; the schedule wins.
	if (resolution.kind === "blocked" && resolution.reason !== "password") {
		return fail(c, 410, resolution.reason, "This link is not available.");
	}

	if (!row.password_hash) {
		return c.json({ target: mergeQuery(row.target, url) });
	}

	if (!password || !(await verifyPassword(password, row.password_hash))) {
		return fail(c, 401, "bad_password", "Wrong password.");
	}

	c.executionCtx.waitUntil(
		countClick(c.env, c.req.raw, code, url, Boolean(row.track_utm))
	);

	return c.json({ target: mergeQuery(row.target, url) });
});

export default resolve;
