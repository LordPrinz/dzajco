import { Hono } from "hono";
import type { AppContext, Env } from "../env";
import type { MeResponse, SessionUser } from "@shared/types";
import {
	clearSession,
	consumeOAuthState,
	createSession,
	issueOAuthState,
} from "../lib/session";
import { isRateLimited, limiterKey } from "../lib/ratelimit";
import { fail, tooManyRequests } from "../lib/responses";

const auth = new Hono<AppContext>();

type Provider = "github" | "google";

type ProviderProfile = {
	id: string;
	email: string | null;
	name: string | null;
	avatarUrl: string | null;
};

function isProvider(value: string): value is Provider {
	return value === "github" || value === "google";
}

function credentials(env: Env, provider: Provider) {
	return provider === "github"
		? { id: env.GITHUB_CLIENT_ID, secret: env.GITHUB_CLIENT_SECRET }
		: { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET };
}

function configuredProviders(env: Env): Provider[] {
	const out: Provider[] = [];
	if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) out.push("github");
	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.push("google");
	return out;
}

const redirectUri = (env: Env, provider: Provider) =>
	`${env.APP_URL.replace(/\/$/, "")}/api/auth/${provider}/callback`;

/* ------------------------------------------------------------------ *
 * Session introspection
 * ------------------------------------------------------------------ */

auth.get("/me", async (c) => {
	const userId = c.get("userId");

	const base = {
		turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
		providers: configuredProviders(c.env),
	};

	if (!userId) return c.json<MeResponse>({ user: null, ...base });

	const row = await c.env.DB.prepare(
		"SELECT id, name, email, avatar_url, provider FROM users WHERE id = ?1"
	)
		.bind(userId)
		.first<{
			id: string;
			name: string | null;
			email: string | null;
			avatar_url: string | null;
			provider: string;
		}>();

	if (!row) {
		// The account was deleted but the cookie outlived it.
		clearSession(c);
		return c.json<MeResponse>({ user: null, ...base });
	}

	const user: SessionUser = {
		id: row.id,
		name: row.name,
		email: row.email,
		avatarUrl: row.avatar_url,
		provider: row.provider,
	};
	return c.json<MeResponse>({ user, ...base });
});

auth.post("/logout", (c) => {
	clearSession(c);
	return c.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * OAuth
 * ------------------------------------------------------------------ */

auth.get("/:provider", async (c) => {
	const provider = c.req.param("provider");
	if (!isProvider(provider)) return fail(c, 404, "unknown_provider", "Unknown provider.");

	const { id } = credentials(c.env, provider);
	if (!id || !c.env.SESSION_SECRET) {
		return fail(c, 500, "oauth_unconfigured", `${provider} sign-in is not configured.`);
	}

	if (await isRateLimited(c.env, "auth", await limiterKey(c.req.raw, null))) {
		return tooManyRequests(c);
	}

	const state = await issueOAuthState(c, provider);
	const url =
		provider === "github"
			? new URL("https://github.com/login/oauth/authorize")
			: new URL("https://accounts.google.com/o/oauth2/v2/auth");

	url.searchParams.set("client_id", id);
	url.searchParams.set("redirect_uri", redirectUri(c.env, provider));
	url.searchParams.set("state", state);

	if (provider === "github") {
		url.searchParams.set("scope", "read:user user:email");
	} else {
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", "openid email profile");
		// We only need the profile once, at sign-in.
		url.searchParams.set("prompt", "select_account");
	}

	return c.redirect(url.toString(), 302);
});

auth.get("/:provider/callback", async (c) => {
	const provider = c.req.param("provider");
	if (!isProvider(provider)) return fail(c, 404, "unknown_provider", "Unknown provider.");

	if (await isRateLimited(c.env, "auth", await limiterKey(c.req.raw, null))) {
		return tooManyRequests(c);
	}

	const code = c.req.query("code");
	const state = c.req.query("state");

	if (!code) return c.redirect("/login?error=cancelled", 302);
	if (!(await consumeOAuthState(c, provider, state))) {
		return c.redirect("/login?error=state", 302);
	}

	try {
		const accessToken = await exchangeCode(c.env, provider, code);
		const profile = await fetchProfile(provider, accessToken);
		const userId = await upsertUser(c.env, provider, profile);
		await createSession(c, userId);
		return c.redirect("/dashboard", 302);
	} catch {
		return c.redirect("/login?error=failed", 302);
	}
});

async function exchangeCode(
	env: Env,
	provider: Provider,
	code: string
): Promise<string> {
	const { id, secret } = credentials(env, provider);
	if (!id || !secret) throw new Error("provider not configured");

	const endpoint =
		provider === "github"
			? "https://github.com/login/oauth/access_token"
			: "https://oauth2.googleapis.com/token";

	const body = new URLSearchParams({
		client_id: id,
		client_secret: secret,
		code,
		redirect_uri: redirectUri(env, provider),
		grant_type: "authorization_code",
	});

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/x-www-form-urlencoded",
		},
		body,
	});

	const payload = (await response.json()) as { access_token?: string };
	if (!payload.access_token) throw new Error("no access token");
	return payload.access_token;
}

async function fetchProfile(
	provider: Provider,
	accessToken: string
): Promise<ProviderProfile> {
	const headers = {
		authorization: `Bearer ${accessToken}`,
		accept: "application/json",
		// GitHub rejects requests without a User-Agent.
		"user-agent": "dzajco",
	};

	if (provider === "github") {
		const response = await fetch("https://api.github.com/user", { headers });
		const user = (await response.json()) as {
			id?: number;
			login?: string;
			name?: string;
			email?: string;
			avatar_url?: string;
		};
		if (!user.id) throw new Error("no profile");

		let email = user.email ?? null;
		if (!email) {
			// Primary address is private unless asked for separately.
			const emails = (await fetch("https://api.github.com/user/emails", {
				headers,
			}).then((r) => r.json())) as { email: string; primary: boolean; verified: boolean }[];
			email = emails?.find((e) => e.primary && e.verified)?.email ?? null;
		}

		return {
			id: String(user.id),
			email,
			name: user.name ?? user.login ?? null,
			avatarUrl: user.avatar_url ?? null,
		};
	}

	const response = await fetch(
		"https://openidconnect.googleapis.com/v1/userinfo",
		{ headers }
	);
	const user = (await response.json()) as {
		sub?: string;
		email?: string;
		email_verified?: boolean;
		name?: string;
		picture?: string;
	};
	if (!user.sub) throw new Error("no profile");

	return {
		id: user.sub,
		email: user.email_verified ? (user.email ?? null) : null,
		name: user.name ?? null,
		avatarUrl: user.picture ?? null,
	};
}

async function upsertUser(
	env: Env,
	provider: Provider,
	profile: ProviderProfile
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	const existing = await env.DB.prepare(
		"SELECT id FROM users WHERE provider = ?1 AND provider_id = ?2"
	)
		.bind(provider, profile.id)
		.first<{ id: string }>();

	if (existing) {
		await env.DB.prepare(
			`UPDATE users SET name = ?2, email = ?3, avatar_url = ?4, last_login_at = ?5
			 WHERE id = ?1`
		)
			.bind(existing.id, profile.name, profile.email, profile.avatarUrl, now)
			.run();
		return existing.id;
	}

	const id = crypto.randomUUID();
	await env.DB.prepare(
		`INSERT INTO users
		   (id, provider, provider_id, email, name, avatar_url, created_at, last_login_at)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`
	)
		.bind(id, provider, profile.id, profile.email, profile.name, profile.avatarUrl, now)
		.run();

	return id;
}

export default auth;
