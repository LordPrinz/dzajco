import { Hono } from "hono";
import type { AppContext } from "../env";
import type {
	CreateLinkRequest,
	CreateLinkResponse,
	LinkSummary,
} from "@shared/types";
import {
	AUTO_CODE_MAX,
	AUTO_CODE_MIN,
	generateCode,
	validateCustomName,
} from "@shared/codes";
import {
	getLink,
	invalidateLink,
	toSummary,
	type LinkRow,
} from "../lib/links";
import { hashPassword, randomToken, sha256Hex, timingSafeEqual } from "../lib/crypto";
import { validateTarget } from "../lib/urls";
import { verifyTurnstile } from "../lib/turnstile";
import { isRateLimited, limiterKey } from "../lib/ratelimit";
import { fail, parseInstant, readJson, tooManyRequests } from "../lib/responses";

const links = new Hono<AppContext>();

const MAX_TITLE_LENGTH = 120;
const MAX_PASSWORD_LENGTH = 200;
const MIN_PASSWORD_LENGTH = 4;
/** Anything sooner is almost certainly a mistake in the picker. */
const MIN_LIFETIME_SEC = 60;

/**
 * Proves the caller owns `row`, either through their session or through the
 * secret handed out when the link was created anonymously.
 */
async function isOwner(
	row: LinkRow,
	userId: string | null,
	secret: string | undefined
): Promise<boolean> {
	if (row.user_id && userId && row.user_id === userId) return true;
	if (!row.secret_hash || !secret) return false;
	return timingSafeEqual(await sha256Hex(secret), row.secret_hash);
}

function secretFromRequest(header: string | undefined, query: string | undefined) {
	return header?.trim() || query?.trim() || undefined;
}

/* ------------------------------------------------------------------ *
 * Create
 * ------------------------------------------------------------------ */

links.post("/", async (c) => {
	const userId = c.get("userId");
	const key = await limiterKey(c.req.raw, userId);

	if (await isRateLimited(c.env, "create", key)) return tooManyRequests(c);

	const body = await readJson<CreateLinkRequest>(c);
	if (!body) return fail(c, 400, "bad_json", "Request body must be JSON.");

	// Anonymous callers pass a Turnstile token; signed-in callers already
	// cleared a human check when they logged in.
	if (!userId) {
		const passed = await verifyTurnstile(c.env, body.turnstileToken, c.req.raw);
		if (!passed) {
			return fail(c, 403, "captcha_failed", "Bot check failed. Please retry.");
		}
	}

	const target = validateTarget(body.url ?? "", c.env.APP_URL);
	if (!target.ok) {
		const messages: Record<string, string> = {
			invalid: "That does not look like a valid link.",
			scheme: "Only http and https links can be shortened.",
			private: "That address points at a private network.",
			self: "That is already a dzajco link.",
			too_long: "That link is too long.",
			credentials: "Links with embedded credentials are not accepted.",
		};
		return fail(c, 400, `url_${target.error}`, messages[target.error]);
	}

	const now = Math.floor(Date.now() / 1000);

	const startsAt = parseInstant(body.startsAt);
	if (startsAt === undefined && body.startsAt) {
		return fail(c, 400, "bad_start", "Invalid start date.");
	}

	const expiresAt = parseInstant(body.expiresAt);
	if (expiresAt === undefined && body.expiresAt) {
		return fail(c, 400, "bad_expiry", "Invalid expiration date.");
	}

	if (expiresAt !== null && expiresAt !== undefined) {
		if (expiresAt < now + MIN_LIFETIME_SEC) {
			return fail(c, 400, "expiry_too_soon", "Expiration must be in the future.");
		}
		if (startsAt && expiresAt <= startsAt) {
			return fail(c, 400, "expiry_before_start", "Expiration must come after the start date.");
		}
	}

	if (body.password != null && body.password !== "") {
		if (body.password.length < MIN_PASSWORD_LENGTH) {
			return fail(c, 400, "password_short", "Password is too short.");
		}
		if (body.password.length > MAX_PASSWORD_LENGTH) {
			return fail(c, 400, "password_long", "Password is too long.");
		}
	}

	const maxClicks =
		typeof body.maxClicks === "number" && body.maxClicks > 0
			? Math.min(Math.floor(body.maxClicks), 10_000_000)
			: null;

	let code: string;

	if (body.customName) {
		const nameError = validateCustomName(body.customName);
		if (nameError) {
			const messages: Record<string, string> = {
				too_short: "Custom name is too short.",
				too_long: "Custom name is too long.",
				charset: "Custom names may use letters, digits, hyphens and underscores.",
				reserved: "That name is reserved.",
				blocked: "That name is not available.",
			};
			return fail(c, 400, `name_${nameError}`, messages[nameError]);
		}

		const taken = await c.env.DB.prepare(
			"SELECT 1 FROM links WHERE code = ?1 COLLATE NOCASE"
		)
			.bind(body.customName)
			.first();

		if (taken) return fail(c, 409, "name_taken", "That name is already taken.");
		code = body.customName;
	} else {
		const generated = await generateFreeCode(c.env.DB);
		if (!generated) {
			return fail(c, 500, "code_exhausted", "Could not allocate a short code. Try again.");
		}
		code = generated;
	}

	// Anonymous owners get a secret; signed-in owners are identified by the
	// session, so there is nothing extra to store or leak.
	const secret = userId ? undefined : `dz_${randomToken(24)}`;
	const secretHash = secret ? await sha256Hex(secret) : null;
	const passwordHash = body.password ? await hashPassword(body.password) : null;
	const title = body.title?.trim().slice(0, MAX_TITLE_LENGTH) || null;
	// UTM breakdowns are a signed-in feature.
	const trackUtm = userId && body.trackUtm ? 1 : 0;

	try {
		await c.env.DB.batch([
			c.env.DB.prepare(
				`INSERT INTO links
				   (code, target, user_id, secret_hash, password_hash, title,
				    created_at, starts_at, expires_at, max_clicks, track_utm)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
			).bind(
				code,
				target.url,
				userId,
				secretHash,
				passwordHash,
				title,
				now,
				startsAt ?? null,
				expiresAt ?? null,
				maxClicks,
				trackUtm
			),
			c.env.DB.prepare(
				`UPDATE globals SET value = value + 1 WHERE key = 'links_created'`
			),
		]);
	} catch (error) {
		// A racing insert on the same custom name lands here.
		if (String(error).includes("UNIQUE")) {
			return fail(c, 409, "name_taken", "That name is already taken.");
		}
		throw error;
	}

	const response: CreateLinkResponse = {
		code,
		shortUrl: `${c.env.APP_URL.replace(/\/$/, "")}/${code}`,
		target: target.url,
		secret,
		startsAt: startsAt ? new Date(startsAt * 1000).toISOString() : null,
		expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
		hasPassword: Boolean(passwordHash),
		owned: userId ? "account" : "anonymous",
	};

	return c.json(response, 201);
});

/**
 * Picks an unused code, starting short and widening on collision. Each attempt
 * is one indexed lookup, and the length only grows when the space at that
 * length is actually crowded.
 */
async function generateFreeCode(db: D1Database): Promise<string | null> {
	for (let length = AUTO_CODE_MIN; length <= AUTO_CODE_MAX; length++) {
		for (let attempt = 0; attempt < 4; attempt++) {
			const candidate = generateCode(length);
			const taken = await db
				.prepare("SELECT 1 FROM links WHERE code = ?1 COLLATE NOCASE")
				.bind(candidate)
				.first();

			if (!taken) return candidate;
		}
	}
	return null;
}

/* ------------------------------------------------------------------ *
 * Read / update / delete
 * ------------------------------------------------------------------ */

links.get("/:code", async (c) => {
	const userId = c.get("userId");
	if (await isRateLimited(c.env, "read", await limiterKey(c.req.raw, userId))) {
		return tooManyRequests(c);
	}

	const row = await getLink(c.env, c.req.param("code"));
	if (!row) return fail(c, 404, "not_found", "Link not found.");

	const secret = secretFromRequest(
		c.req.header("x-dzajco-secret"),
		c.req.query("secret")
	);
	if (!(await isOwner(row, userId, secret))) {
		return fail(c, 403, "forbidden", "You do not own this link.");
	}

	return c.json<LinkSummary>(toSummary(row, c.env.APP_URL));
});

links.patch("/:code", async (c) => {
	const userId = c.get("userId");
	if (await isRateLimited(c.env, "create", await limiterKey(c.req.raw, userId))) {
		return tooManyRequests(c);
	}

	const code = c.req.param("code");
	const row = await getLink(c.env, code);
	if (!row) return fail(c, 404, "not_found", "Link not found.");

	const body = await readJson<
		Partial<CreateLinkRequest> & { disabled?: boolean; secret?: string }
	>(c);
	if (!body) return fail(c, 400, "bad_json", "Request body must be JSON.");

	const secret = secretFromRequest(c.req.header("x-dzajco-secret"), body.secret);
	if (!(await isOwner(row, userId, secret))) {
		return fail(c, 403, "forbidden", "You do not own this link.");
	}

	const updates: string[] = [];
	const values: unknown[] = [];
	const set = (column: string, value: unknown) => {
		values.push(value);
		updates.push(`${column} = ?${values.length}`);
	};

	if (body.url !== undefined) {
		const target = validateTarget(body.url, c.env.APP_URL);
		if (!target.ok) return fail(c, 400, `url_${target.error}`, "Invalid target URL.");
		set("target", target.url);
	}

	if (body.title !== undefined) {
		set("title", body.title?.trim().slice(0, MAX_TITLE_LENGTH) || null);
	}

	const startsAt = parseInstant(body.startsAt);
	if (startsAt !== undefined) set("starts_at", startsAt);

	const expiresAt = parseInstant(body.expiresAt);
	if (expiresAt !== undefined) set("expires_at", expiresAt);

	if (body.maxClicks !== undefined) {
		set(
			"max_clicks",
			typeof body.maxClicks === "number" && body.maxClicks > 0
				? Math.floor(body.maxClicks)
				: null
		);
	}

	if (body.password !== undefined) {
		if (body.password === null || body.password === "") {
			set("password_hash", null);
		} else if (body.password.length < MIN_PASSWORD_LENGTH) {
			return fail(c, 400, "password_short", "Password is too short.");
		} else {
			set("password_hash", await hashPassword(body.password));
		}
	}

	if (body.disabled !== undefined) set("disabled", body.disabled ? 1 : 0);

	// Only account-owned links can collect UTM data.
	if (body.trackUtm !== undefined && row.user_id) {
		set("track_utm", body.trackUtm ? 1 : 0);
	}

	if (!updates.length) return fail(c, 400, "no_changes", "Nothing to update.");

	values.push(code);
	await c.env.DB.prepare(
		`UPDATE links SET ${updates.join(", ")} WHERE code = ?${values.length}`
	)
		.bind(...values)
		.run();

	await invalidateLink(c.env, code);

	const updated = await getLink(c.env, code);
	return c.json<LinkSummary>(toSummary(updated!, c.env.APP_URL));
});

links.delete("/:code", async (c) => {
	const userId = c.get("userId");
	if (await isRateLimited(c.env, "create", await limiterKey(c.req.raw, userId))) {
		return tooManyRequests(c);
	}

	const code = c.req.param("code");
	const row = await getLink(c.env, code);
	if (!row) return fail(c, 404, "not_found", "Link not found.");

	const body = await readJson<{ secret?: string }>(c);
	const secret = secretFromRequest(
		c.req.header("x-dzajco-secret"),
		body?.secret ?? c.req.query("secret")
	);

	if (!(await isOwner(row, userId, secret))) {
		return fail(c, 403, "forbidden", "You do not own this link.");
	}

	// The child tables are ON DELETE CASCADE, but D1 does not enable foreign
	// keys by default, so the aggregates are cleared explicitly.
	await c.env.DB.batch([
		c.env.DB.prepare("DELETE FROM clicks_daily WHERE code = ?1").bind(code),
		c.env.DB.prepare("DELETE FROM clicks_geo WHERE code = ?1").bind(code),
		c.env.DB.prepare("DELETE FROM clicks_ref WHERE code = ?1").bind(code),
		c.env.DB.prepare("DELETE FROM clicks_device WHERE code = ?1").bind(code),
		c.env.DB.prepare("DELETE FROM clicks_utm WHERE code = ?1").bind(code),
		c.env.DB.prepare("DELETE FROM links WHERE code = ?1").bind(code),
	]);

	await invalidateLink(c.env, code);
	return c.json({ deleted: true });
});

/* ------------------------------------------------------------------ *
 * Owner views
 * ------------------------------------------------------------------ */

/** Links belonging to the signed-in account. */
links.get("/", async (c) => {
	const userId = c.get("userId");
	if (!userId) return fail(c, 401, "unauthorized", "Sign in to list your links.");

	if (await isRateLimited(c.env, "read", await limiterKey(c.req.raw, userId))) {
		return tooManyRequests(c);
	}

	const limit = Math.min(Number(c.req.query("limit") ?? 100), 200);
	const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

	const { results } = await c.env.DB.prepare(
		`SELECT * FROM links WHERE user_id = ?1
		 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3`
	)
		.bind(userId, limit, offset)
		.all<LinkRow>();

	return c.json({
		links: (results ?? []).map((row) => toSummary(row, c.env.APP_URL)),
	});
});

/**
 * Resolves an anonymous owner profile: the client posts the code/secret pairs
 * it kept in localStorage and gets back the live state of each link. Secrets
 * are verified one by one, so a wrong entry is simply dropped from the result
 * rather than failing the whole request.
 */
links.post("/lookup", async (c) => {
	if (await isRateLimited(c.env, "read", await limiterKey(c.req.raw, c.get("userId")))) {
		return tooManyRequests(c);
	}

	const body = await readJson<{ items?: { code: string; secret: string }[] }>(c);
	const items = (body?.items ?? []).slice(0, 100);
	if (!items.length) return c.json({ links: [] as LinkSummary[] });

	const codes = items.map((item) => item.code);
	const placeholders = codes.map((_, index) => `?${index + 1}`).join(", ");

	const { results } = await c.env.DB.prepare(
		`SELECT * FROM links WHERE code IN (${placeholders})`
	)
		.bind(...codes)
		.all<LinkRow>();

	const found = new Map((results ?? []).map((row) => [row.code, row]));
	const out: LinkSummary[] = [];

	for (const item of items) {
		const row = found.get(item.code);
		if (!row) continue;
		if (await isOwner(row, c.get("userId"), item.secret)) {
			out.push(toSummary(row, c.env.APP_URL));
		}
	}

	return c.json({ links: out });
});

export default links;
