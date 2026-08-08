-- Dzajco schema.
--
-- Click data is stored pre-aggregated rather than one row per click. That keeps
-- the D1 free-tier row budget usable, makes the stats endpoints a handful of
-- cheap indexed reads, and means no per-visitor record (IP, exact timestamp)
-- is ever persisted.

CREATE TABLE users (
	id            TEXT PRIMARY KEY,
	provider      TEXT NOT NULL,          -- 'github' | 'google'
	provider_id   TEXT NOT NULL,
	email         TEXT,
	name          TEXT,
	avatar_url    TEXT,
	created_at    INTEGER NOT NULL,
	last_login_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_users_provider ON users (provider, provider_id);

CREATE TABLE links (
	code           TEXT PRIMARY KEY,      -- the short code, case-sensitive
	target         TEXT NOT NULL,
	user_id        TEXT REFERENCES users (id) ON DELETE CASCADE,
	-- SHA-256 of the owner secret shown once to anonymous creators.
	-- NULL for links owned by a signed-in user.
	secret_hash    TEXT,
	-- PBKDF2-SHA256 as `iterations:salt_b64:hash_b64`, NULL when unprotected.
	password_hash  TEXT,
	title          TEXT,
	created_at     INTEGER NOT NULL,
	starts_at      INTEGER,               -- link 425s before this instant
	expires_at     INTEGER,               -- link 410s after this instant
	max_clicks     INTEGER,               -- optional hard cap
	disabled       INTEGER NOT NULL DEFAULT 0,
	clicks         INTEGER NOT NULL DEFAULT 0,
	uniques        INTEGER NOT NULL DEFAULT 0,
	last_click_at  INTEGER,
	-- UTM capture is a signed-in-only feature; mirrored here so the redirect
	-- path can decide without a users join.
	track_utm      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_links_user ON links (user_id, created_at DESC);
CREATE INDEX idx_links_expires ON links (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE clicks_daily (
	code   TEXT NOT NULL REFERENCES links (code) ON DELETE CASCADE,
	day    TEXT NOT NULL,                 -- 'YYYY-MM-DD' in UTC
	clicks INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (code, day)
);

CREATE TABLE clicks_geo (
	code    TEXT NOT NULL REFERENCES links (code) ON DELETE CASCADE,
	country TEXT NOT NULL,                -- ISO-3166-1 alpha-2, 'XX' when unknown
	region  TEXT NOT NULL DEFAULT '',
	city    TEXT NOT NULL DEFAULT '',
	lat     REAL,
	lon     REAL,
	clicks  INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (code, country, region, city)
);
CREATE INDEX idx_geo_code_clicks ON clicks_geo (code, clicks DESC);

CREATE TABLE clicks_ref (
	code     TEXT NOT NULL REFERENCES links (code) ON DELETE CASCADE,
	referrer TEXT NOT NULL,               -- hostname only, or 'direct'
	clicks   INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (code, referrer)
);

CREATE TABLE clicks_device (
	code    TEXT NOT NULL REFERENCES links (code) ON DELETE CASCADE,
	device  TEXT NOT NULL,                -- desktop | mobile | tablet | bot | other
	os      TEXT NOT NULL DEFAULT '',
	browser TEXT NOT NULL DEFAULT '',
	clicks  INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (code, device, os, browser)
);

CREATE TABLE clicks_utm (
	code     TEXT NOT NULL REFERENCES links (code) ON DELETE CASCADE,
	source   TEXT NOT NULL DEFAULT '',
	medium   TEXT NOT NULL DEFAULT '',
	campaign TEXT NOT NULL DEFAULT '',
	term     TEXT NOT NULL DEFAULT '',
	content  TEXT NOT NULL DEFAULT '',
	clicks   INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (code, source, medium, campaign, term, content)
);
CREATE INDEX idx_utm_code_clicks ON clicks_utm (code, clicks DESC);

-- Site-wide counters for the /about page. Single-row-per-key so the redirect
-- path only ever does an UPSERT on a hot key.
CREATE TABLE globals (
	key   TEXT PRIMARY KEY,
	value INTEGER NOT NULL DEFAULT 0
);
INSERT INTO globals (key, value) VALUES ('links_created', 0), ('total_clicks', 0);

CREATE TABLE globals_geo (
	country TEXT PRIMARY KEY,
	clicks  INTEGER NOT NULL DEFAULT 0
);

-- Fallback rate-limit ledger, used only when the native rate-limit binding is
-- unavailable (e.g. `wrangler dev` without the unsafe binding).
CREATE TABLE rate_limits (
	bucket     TEXT PRIMARY KEY,
	count      INTEGER NOT NULL,
	reset_at   INTEGER NOT NULL
);
