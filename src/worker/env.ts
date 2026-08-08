export type RateLimiter = {
	limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type Env = {
	DB: D1Database;
	LINK_CACHE: KVNamespace;
	ASSETS: Fetcher;

	/** Native rate-limit bindings; absent in some local dev setups. */
	RL_CREATE?: RateLimiter;
	RL_READ?: RateLimiter;
	RL_AUTH?: RateLimiter;

	APP_URL: string;
	TURNSTILE_SITE_KEY?: string;

	// Secrets (`wrangler secret put`).
	TURNSTILE_SECRET_KEY?: string;
	SESSION_SECRET?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
};

export type Vars = {
	userId: string | null;
};

export type AppContext = { Bindings: Env; Variables: Vars };
