# Design

dzajco v3.0 is a URL shortener that runs on one Cloudflare Worker, on the Free plan. This document
describes the target design. Larger decisions have an ADR in [`adr/`](adr). Planned work is in
[`ROADMAP.md`](ROADMAP.md).

## Architecture

### Overview

- One Worker. Hono handles the API and the HTML pages. Pages are server-rendered with Hono JSX.
- Client JavaScript is minimal. Creating a link and following one both work without JavaScript. JS adds
  copying, the local history and the map. The map (Leaflet) is a lazy island that loads only on the
  stats page.
- Static files are served by Workers Static Assets from `public/`.
- D1 holds links and aggregated stats. There is no KV.
- Workers Analytics Engine (AE) records each visit. An hourly cron rolls the data up into D1.
- The Cache API holds the redirect record in front of D1.
- Visitor geo comes from `request.cf`. There is no external geo service.
- Runtime is workerd only. Bun is the package manager, the runner for pure-logic tests and repo scripts,
  and the bundler for client scripts.

### Repository layout

```
dzajco/                          (trunk: v3.0)
├── src/
│   ├── domain/        # pure code: url-policy, ids, reserved, expiry, secret, bots, schemas (+ *.test.ts, bun test)
│   ├── db/            # queries.ts (D1)
│   ├── analytics/     # sink.ts (AE writeDataPoint), ae-source.ts (SQL API), fresh.ts. Ports, mocked in tests
│   ├── cron/          # rollup.ts, daily.ts, scheduled.ts
│   ├── middleware/    # security-headers, rate-limit, origin-check, errors, request-id
│   ├── routes/        # redirect.ts, api.ts, pages.ts, form.ts
│   ├── views/         # Hono JSX: Layout, Home, Created, History, Stats, About, ApiDocs, Privacy, NotFound, Gone
│   ├── client/        # browser scripts, built with `bun build` into public/assets
│   └── index.ts       # fetch + scheduled
├── migrations/0001_init.sql
├── public/            # _headers, css, img, assets/ (build output)
├── test/worker/       # vitest-pool-workers (+ cf fixtures, applyD1Migrations)
├── test/e2e/          # Playwright
├── scripts/
│   ├── gh/            # repo, board and issue scripts (+ tests)
│   ├── git/           # commit and branch conventions (+ tests)
│   ├── ci/            # coverage.ts, size.ts
│   └── migrate/       # mongo-to-d1.ts
├── infra/docker-compose.yml   # web (wrangler dev) + profile migrate-test (mongo:7)
├── Dockerfile                 # dev/test: node:22-bookworm-slim + bun + wrangler (workerd needs glibc)
├── wrangler.jsonc  vitest.config.ts  biome.json  bunfig.toml  tsconfig.json  .editorconfig  .env.example
├── docs/{DESIGN.md,ROADMAP.md,DEPLOYMENT.md,adr/}
├── .github/  .husky/  CONTRIBUTING.md  README.md
```

One package, no workspaces ([ADR 0006](adr/0006-one-package-two-test-runners.md)).

### Configuration

`wrangler.jsonc` pins the wrangler version in devDependencies and sets `compatibility_date` to the day of
the scaffold. `nodejs_compat` is added only if something needs it. Other settings:

- `observability.enabled`.
- `assets.directory = "public"` with the default `not_found_handling` (not SPA).
- D1 binding `DB` with `migrations_dir`.
- Analytics Engine binding `VISITS`, dataset `dzajco_visits` (created on the first write).
- Rate limit bindings, period 60 s, per IP (IPv6 /64): `RL_CREATE` 10, `RL_DELETE` 10, `RL_STATS` 60,
  `RL_REDIRECT` 120 (see
  [ADR 0007](adr/0007-rate-limiting.md)).
- Cron `0 * * * *`.
- Types come from `wrangler types`.

### D1 schema

```sql
CREATE TABLE links (
  id TEXT PRIMARY KEY, target TEXT NOT NULL, target_host TEXT NOT NULL, secret_hash TEXT,
  expires_at INTEGER, created_at INTEGER NOT NULL, is_custom INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
CREATE INDEX links_expires ON links(expires_at) WHERE expires_at IS NOT NULL;
CREATE TABLE link_stats (
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  country TEXT NOT NULL, city TEXT NOT NULL DEFAULT '', lat REAL, lon REAL,
  visits INTEGER NOT NULL, PRIMARY KEY (link_id, country, city)
) WITHOUT ROWID;
CREATE TABLE global_stats (id INTEGER PRIMARY KEY CHECK (id = 1), links INTEGER, visits INTEGER, countries TEXT, updated_at INTEGER);   -- countries: JSON list of the top 20 {code, visits}
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;   -- rollup cursor {day, offset}
CREATE TABLE blocked_hosts (host TEXT PRIMARY KEY, reason TEXT, created_at INTEGER NOT NULL) WITHOUT ROWID;
```

`target_host` is the lowercased punycode host of the target. The cache-miss query uses it to check
`blocked_hosts` in the same batch as the link read.

D1 enforces foreign keys by default. The rollup therefore inserts with
`INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM links WHERE id = ?) ON CONFLICT DO UPDATE`. Visits for a
link deleted before the rollup are skipped and do not fail the batch.

### Redirect path

1. Look up the link record in the Cache API (JSON record, TTL at most 60 s and at most the time left until
   expiry). On a miss, read the link and its `blocked` flag in one D1 batch and store both in the cached
   record. The flag says whether the target host or one of its parent domains is in `blocked_hosts`, so a
   cache hit needs no extra read.
2. Expired link: 410 (and lazy delete). Blocked target: 410 "link disabled". Unknown id: 404. Otherwise 302
   to the target.
3. Write the AE data point inside `waitUntil`. The sink catches its own errors, so a failing sink never
   changes the response.
4. Bots (User-Agent heuristic) and `HEAD` requests are not counted.

The cache stores the record, not the 302 response. That is why 410 and visit counting still work on a cache
hit. A delete clears the cache entry in the same colo. Other colos can serve the old record for up to 60
seconds (the staleness window).

Redirect status and rules:

| Case                     | Response                           |
| ------------------------ | ---------------------------------- |
| Link exists, not expired | 302 to target                      |
| Link expired             | 410 `expired`, link removed lazily |
| Target host is blocked   | 410 `link_disabled`                |
| Link does not exist      | 404                                |
| `/dzajapi`               | 301 to `/docs/api`                 |
| `/:id/info`              | 301 to `/:id/stats`                |

A link is expired when `expires_at <= now`, everywhere (redirect, API, cleanup). Maximum expiry is one year. "Never" is stored as `NULL`.

### Visits and stats (Analytics Engine)

- Dataset `dzajco_visits`. Secrets and vars: `CF_ACCOUNT_ID` (var) and `CF_AE_TOKEN` (token with the
  _Account Analytics Read_ permission).
- Data point: `indexes: [linkId]` (at most 96 bytes, enforced in the domain layer), `blobs: [country, city]`,
  `doubles: [lat, lon]`. Latitude and longitude are parsed from the `request.cf` strings.
- Rollup (hourly cron, `src/cron/rollup.ts`): it is skipped, with the cursor untouched, when `CF_ACCOUNT_ID` or
  `CF_AE_TOKEN` is missing. Day D (UTC) closes only after `D+1 01:00 UTC`, to allow for ingest delay. The query
  is `SELECT index1, blob1, blob2, SUM(_sample_interval) … GROUP BY index1, blob1, blob2 ORDER BY index1,
  blob1, blob2 LIMIT 500 OFFSET <offset>`. Each page is one `db.batch` with the upserts and the new cursor
  `{day, offset}`. A page with fewer than 500 rows ends the day and moves the cursor to `{D+1, 0}`. One cron
  call handles at most `ROLLUP_MAX_PAGES` pages (default 10), to stay inside the Free subrequest limit. A D1
  `batch()` counts as one query toward the per-invocation limit (Free: 50), but the per-statement limits (100
  bound parameters, 100 KB) still apply, so a page is split into statements that fit. The next hours finish
  the rest. `deleteExpired` runs once a day after 01:00 UTC, whatever the cursor is. The `global_stats`
  recompute runs once the cursor has reached today.
- Fresh data (everything not yet in D1) comes from two queries with the same `GROUP BY` and `ORDER BY`: day
  D from `OFFSET <offset>`, and `timestamp >= D+1`. Both cover all links. The result is cached in the Cache
  API for 5 minutes under a key that contains the cursor, so a moved cursor never matches an old entry and
  nothing is counted twice. The stats request reads the cursor and `link_stats` in one `db.batch`, then
  filters the cached result per link in the Worker. The rollup keeps a visit-weighted mean of the coordinates
  in `link_stats`, by the same rule as the live merge.
- If the SQL API fails or is rate limited, stats come from D1 only and the response has `partial: true`. The
  outage is cached as partial for 30 seconds, so a failing API is not queried on every request.
- Locally there is no SQL API. Without `CF_AE_TOKEN` the code uses `LocalVisitSource`, which returns an
  empty list, so locally the fresh part of the stats is empty.
- Global stats: one row in `global_stats`, recomputed by the cron once a day. `countries` is a JSON list of the top 20 `{code, visits}`. `GET /api/v1/stats` reads that
  row only, so the numbers can lag by up to about 24 hours.
- Each link gets its own secretKey. v2 reused a key for "never" links with the same target. v3 does not.

### API v1

| Method | Path                      | Input                                                                                         | Responses                                                                                                         |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/links`           | JSON `{url, customName?, expiresAt?: ISO \| null}`, `Content-Type: application/json` required | 201 `{id, shortUrl, url, secretKey, expiresAt}`, 400, 409, 413, 415, 429, 503                                     |
| GET    | `/api/v1/links/:id`       | none                                                                                          | 200 `{id, url, expiresAt}`, 404, 410 (`expired` or `link_disabled`), 429                                          |
| GET    | `/api/v1/links/:id/stats` | optional `Authorization: Bearer <key>`                                                        | 200 `{visits, countries: [{code, visits}], partial}` (plus `cities` with a key), 403, 404, 410, 429               |
| DELETE | `/api/v1/links/:id`       | `Authorization: Bearer <key>`                                                                 | 204, 400, 403, 404, 429                                                                                           |
| GET    | `/api/v1/stats`           | none                                                                                          | 200 `{links, visits, countries: [{code, visits}], updatedAt}`, 429, lags up to about 24 h (stated in `/docs/api`) |

Errors have the shape `{error: {code, message}}`. Codes by endpoint:

| Endpoint                      | Status | Code                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/links`          | 400    | `invalid_json`, `invalid_body`, `invalid_url`, `url_too_long`, `unsupported_scheme`, `credentials_not_allowed`, `own_host`, `private_target`, `blocked_target`, `invalid_name`, `name_too_long`, `reserved_name`, `mixed_script`, `invalid_expiry`, `expiry_in_past`, `expiry_too_far` |
|                               | 409    | `id_taken`                                                                                                                                                                                                                                                                             |
|                               | 413    | `payload_too_large` (body over 8 KB)                                                                                                                                                                                                                                                   |
|                               | 415    | `unsupported_media_type`                                                                                                                                                                                                                                                               |
|                               | 429    | `rate_limited`                                                                                                                                                                                                                                                                         |
|                               | 503    | `service_unavailable` (the blocklist lookup failed)                                                                                                                                                                                                                                    |
|                               | 500    | `internal_error`                                                                                                                                                                                                                                                                       |
| `GET /api/v1/links/:id`       | 404    | `not_found`                                                                                                                                                                                                                                                                            |
|                               | 410    | `expired` or `link_disabled`                                                                                                                                                                                                                                                           |
|                               | 429    | `rate_limited`                                                                                                                                                                                                                                                                         |
| `DELETE /api/v1/links/:id`    | 400    | `invalid_key`                                                                                                                                                                                                                                                                          |
|                               | 403    | `forbidden`                                                                                                                                                                                                                                                                            |
|                               | 404    | `not_found`                                                                                                                                                                                                                                                                            |
|                               | 429    | `rate_limited`                                                                                                                                                                                                                                                                         |
| `GET /api/v1/links/:id/stats` | 403    | `forbidden`                                                                                                                                                                                                                                                                            |
|                               | 404    | `not_found`                                                                                                                                                                                                                                                                            |
|                               | 410    | `expired` or `link_disabled`                                                                                                                                                                                                                                                           |
|                               | 429    | `rate_limited`                                                                                                                                                                                                                                                                         |

`GET /api/v1/links/:id` never returns 503.

A `POST` with another content type gets 415, which blocks
cross-site `text/plain` posts. `DELETE` without a key or with a malformed one gets 400 `invalid_key`. Stats without an `Authorization`
header show the public view, and any `Authorization` that is not a valid key gets 403. It never falls back to
the public view. `url` in the 201 body is the normalised target (punycode host). CORS: `GET` sends `Access-Control-Allow-Origin: *`, never reflects `Origin` and never allows
credentials. `POST` and `DELETE` have no CORS, so they are for server-side or same-origin use.
JSON responses carry `Content-Security-Policy: default-src 'none'`. There is no alias for the old `/api/urls`
([ADR 0004](adr/0004-new-api-without-alias.md)).

`partial` is `true` when the fresh part of the stats could not be read from the SQL API.

Which limiter applies where, per IP and per 60 s:

| Route                                              | Limiter                            |
| -------------------------------------------------- | ---------------------------------- |
| `POST /`, `POST /api/v1/links`                     | `RL_CREATE` (10)                   |
| `DELETE /api/v1/links/:id`                         | `RL_DELETE` (10)                   |
| `GET /:id`, `GET /api/v1/links/:id`                | `RL_REDIRECT` (120)                |
| `GET /api/v1/links/:id/stats`, `GET /api/v1/stats` | `RL_STATS` (60), not `RL_REDIRECT` |

Over the limit the response is 429 with `Retry-After`.

A custom expiry date in the form is local time with JavaScript (converted to UTC) and UTC without it, and the
form labels it as UTC.

The no-JS form is `POST /` (`application/x-www-form-urlencoded`) with the same schema and the `RL_CREATE`
limit. The result page shows the secretKey with a warning that it will not be shown again. With JavaScript
it also saves the key to `links-history` in localStorage (same key and shape as v2). History entries
without a `secretKey` are read-only. The owner stats page reads the key from localStorage and sends it with
fetch as a Bearer header. The key never appears in a URL or query string. The 201 create response, the `POST /`
result page and owner stats carry `Cache-Control: no-store`.

### Identifiers and targets

- Random ids: 7 characters. They are drawn with rejection sampling over a URL-safe alphabet using
  `crypto.getRandomValues` (no nanoid). An id that is reserved is drawn again.
- Custom names: NFC-normalized, `^[\p{L}\p{N}_-]{3,32}$` with the `u` flag, at most 96 bytes in UTF-8. They
  stay case-sensitive. Two more rules apply:
  - `reserved_name`: the name is rejected when its NFKC and lowercase form equals a reserved name.
  - `mixed_script`: a name that mixes Latin with any other script is rejected.
- Reserved names: app routes and the top-level entries of `public/`. The list is kept by hand, and a test
  compares it with `public/`, so a new file there fails the test until the list is updated.
- Lookup ids on redirect: 1 to 64 characters (NFC) with no `/`, control or format characters, so imported v2
  names keep working. The strict rules above apply only at creation.
- Target URL: only `http:` and `https:`, at most 2048 characters, host in punycode. Also rejected:
  - credentials in the URL (`credentials_not_allowed`);
  - private, loopback, link-local, multicast and reserved IPv4 and IPv6 addresses, including alternative
    IPv4 forms and `localhost` (`private_target`);
  - the own hosts: the host of `PUBLIC_ORIGIN`, the request host, and the account's `*.workers.dev` suffix
    (preview URLs), including trailing dots and ports;
  - targets on other URL shorteners (see Abuse).

  The checks run in this order: own host, private target, shortener.
- Expiry: a date that does not exist (02-30, `T24:00`) is rejected. Past dates, dates over one year ahead and
  invalid values are rejected too.
- The Bearer scheme in `Authorization` is case-insensitive.

## Budget

The Free plan is the design constraint. Limits used here:

| Resource                 | Free limit               |
| ------------------------ | ------------------------ |
| Worker requests          | 100k per day             |
| CPU time                 | 10 ms per invocation     |
| D1 writes                | 100k rows per day        |
| D1 reads                 | 5M rows per day          |
| Analytics Engine writes  | 100k data points per day |
| Analytics Engine queries | 10k per day              |

Cost per operation:

| Operation                        | D1 writes                                           | D1 reads                                                                                                           | AE                                                                | Notes                                                                                                                                                                                        |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirect (cache hit)             | 0                                                   | 0                                                                                                                  | 1 point                                                           | AE write runs in `waitUntil`                                                                                                                                                                 |
| Redirect (cache miss)            | 0                                                   | 1 plus the `blocked_hosts` rows that match (one `IN (...)` query over the host and its parent domains, same batch) | 1 point                                                           | the cached record carries the `blocked` flag                                                                                                                                                 |
| Create link                      | 1 to 2 (PK, `links_expires`)                        | 1                                                                                                                  | 0                                                                 |                                                                                                                                                                                              |
| Delete link                      | 1 to 2 plus `link_stats` rows                       | 1                                                                                                                  | 0                                                                 |                                                                                                                                                                                              |
| Stats (public or owner)          | 0                                                   | 1 plus the number of stats rows                                                                                    | at most 2 SQL API queries per 5 min per colo, shared by all links | data after the rollup cursor comes from AE                                                                                                                                                   |
| Rollup (hourly cron, in pages)   | 1 per (link, country, city) of the day, plus cursor | about the same                                                                                                     | 1 to N queries                                                    | at most `ROLLUP_MAX_PAGES` x 500 groups per call. D1 and fetch wait time is not CPU, but building statements is, so `cpuTime` is measured in T16 and `ROLLUP_MAX_PAGES` is lowered if needed |
| `global_stats` (daily cron step) | 1                                                   | one `SUM` over `link_stats` per day                                                                                | 0                                                                 |                                                                                                                                                                                              |

A 429 from a rate limit binding still counts as a Worker request. Only the WAF rule protects the request quota
(see Security, rate limits).

Redirects must not depend on writes. A spent AE or D1 budget can break stats, never the 302.

Move to the Paid plan when any of these holds:

- the 7-day average is above 70k requests per day;
- more than 80k AE data points per day;
- more than 70k D1 writes per day;
- more than 7k AE queries per day (the rollup has priority, so this is also the alarm threshold).

If fresh-data queries from many colos approach 7k per day, the cache TTL grows to 15 minutes (var
`AE_FRESH_TTL`).

## Security

The v2 findings and what v3 does instead. Each row has a regression test in v3 that replays the old input.

| ID  | v2 problem                                                                            | v3                                                                                                        |
| --- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| S1  | NoSQL injection: `secretKey: {"$ne":null}` deletes any link                           | Valibot schema on every input, secret compared as a hash. An object as key returns 400 and the link stays |
| S2  | SSRF: the server fetched the user URL for metadata                                    | Metadata preview and `RedirectPage` removed. No `fetch` of user URLs. The OG image is static              |
| S3  | Parameter injection in the geo API call, forgeable `x-forwarded-for`, dead middleware | `request.cf` for geo, `cf-connecting-ip` for the client. `x-forwarded-for` is ignored                     |
| S4  | One in-memory limiter of 10 per minute for everyone                                   | Limit per IP (IPv6 cut to /64), including reads                                                           |
| S5  | Public city data, ids from 3 characters                                               | Public stats: visits and countries only. Ids are 7 characters ([ADR 0005](adr/0005-stats-visibility.md))  |
| S6  | secretKey stored in plaintext                                                         | Only `v<n>:HMAC-SHA256(pepper, key)` is stored ([ADR 0003](adr/0003-secret-key-hashing.md))               |
| S7  | `file:` and `ftp:` accepted as redirect targets                                       | Allowlist: `http:` and `https:`                                                                           |
| B1  | `.catch` assigned a Response to `req`                                                 | Invalid JSON returns 400 `invalid_json`                                                                   |
| B2  | `expire: "never"` rejected                                                            | `expiresAt: null` is valid and stored as `NULL`                                                           |
| B3  | Past expiry date accepted                                                             | Past dates return 400                                                                                     |
| B4  | Custom name check and insert were separate (TOCTOU)                                   | Insert against the primary key. The loser gets 409                                                        |
| B5  | Lost update on the visit counter                                                      | Idempotent rollup upsert in one batch with the cursor                                                     |
| B6  | Visits counted on API calls                                                           | Only `GET /:id` that is not a bot and not `HEAD` writes a data point                                      |

Other measures:

- Secrets. A new key is 128 bits, base64url, 22 characters. Legacy v2 keys are 12-character nanoid strings and stay
  valid: the Bearer schema accepts both lengths, and the migration hashes them as they are. The stored value is `v<n>:<hex>`, an HMAC-SHA256
  with a versioned pepper. Peppers are Worker secrets `SECRET_PEPPER_V1`, `SECRET_PEPPER_V2` and so on. The var
  `SECRET_PEPPER_VERSION` is the current version. Verification picks the pepper from the stored prefix, so
  rotation means adding a new pepper and bumping the version, and old keys keep working. Verification uses
  `crypto.subtle.verify` (HMAC), which compares in constant time. If the pepper for a stored version is
  missing, the Worker logs `secret pepper v<n> missing` once per isolate. bcrypt and similar are out because of the 10 ms CPU limit
  (ADR 0003).
- URL policy. Only `http:` and `https:`, at most 2048 characters, punycode host. No credentials in the URL, no
  private, loopback, link-local, multicast or reserved addresses (so no SSRF-style targets), own host
  rejected.
- Rate limits. Bindings `RL_CREATE`, `RL_DELETE`, `RL_STATS` and `RL_REDIRECT`, keyed by
  `cf-connecting-ip` (table in the API section). Plus one zone WAF rate limiting rule (the Free plan allows
  one, with a short fixed window) on all Worker paths but not on static assets, with a loose per-IP
  threshold. The WAF rule drops floods before the Worker runs. A 429 from a binding is still a Worker
  request and counts toward the 100k per day quota. The bindings only save D1 reads and AE writes. Only the
  WAF rule protects the request quota. Spike T9.0 showed that the bindings work on Free. They count per location
  and are eventually consistent (a limit is enforced after roughly 2.4 times its value), so they are an
  abuse cut-off, not an exact limit ([ADR 0007](adr/0007-rate-limiting.md)). The threshold is set in `DEPLOYMENT.md`.
- No-JS form. `POST /` requires `Sec-Fetch-Site: same-origin`. When that header is absent, `Origin` must equal an own
  origin. `Origin: null` is rejected. Anything else gets 403.
- Security headers (middleware). On every Worker response (HTML, JSON and redirects) it sends
  `Strict-Transport-Security: max-age=31536000; includeSubDomains` and `X-Content-Type-Options: nosniff`.
  The CSP with a nonce is HTML only, and JSON responses get `Content-Security-Policy: default-src 'none'`.
  The HTML CSP is
  `default-src 'self'; script-src 'self' 'nonce-<n>' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data: https://tile.openstreetmap.org; style-src 'self'; frame-src https://github.com/sponsors/; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`.
  The nonce changes on every request. The Cloudflare Web Analytics beacon is a manual snippet with the nonce,
  because auto-injection has no nonce. HTML also gets:
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), camera=(), microphone=()`

  Static assets get the same headers (without a nonce) from `public/_headers`.
- Logging. The Worker never logs the `Authorization` header, form bodies or create responses. Client IPs live
  only in Cloudflare's own logs. The privacy page says so. Analytics Engine stores one event per visit (time,
  link id, country, city, approximate coordinates, no IP and no User-Agent) for up to 3 months.
- CI and tokens. Actions pinned to SHAs, `permissions: {}` at workflow level, least privilege per job.
  Deploys are manual only (`bun run deploy`).

### Abuse

A shortener is open to abuse, so v3.0 has a minimum set of controls (task T10c):

- Targets on other URL shorteners are rejected with 400 `blocked_target`. The list is static, in
  `src/domain` (for example bit.ly, tinyurl.com, t.co, goo.gl, ow.ly, is.gd, buff.ly, rebrand.ly, cutt.ly,
  shorturl.at, tiny.cc). The own host is on it too.
- The D1 table `blocked_hosts` lists blocked hosts. It is checked on create (exact host and parent domains)
  and on redirect. A blocked target gives a 410 page "link disabled".
- A "Report abuse" mailto link on the stats, 404 and 410 pages. The address is the var `ABUSE_EMAIL`.
- Admin CLI `scripts/admin/block.ts`: `bun run admin:block host <host> [--reason <text>]`,
  `bun run admin:block unblock <host>` and `bun run admin:block link <id>` (deletes a link). Each needs exactly
  one of `--remote` or `--local`. Remote `unblock` and `link` also need `--yes`. `--dry-run` only prints the SQL. It runs `wrangler d1 execute`.
- Follow-up: Google Safe Browsing checks.

Accepted risks:

- Cache staleness. Another colo can serve a deleted or changed record for up to 60 seconds.
- Late AE ingest. If AE ingests a data point after `D+1 01:00 UTC`, it can shift `OFFSET` paging. A few
  visits can then be skipped or counted twice.
- Stats for the current day depend on the AE SQL API (token, 10k queries per day). When it fails, the API
  answers with `partial: true`.

## Out of scope

- Accounts.
- Editing links.
- QR codes.
- An alias for the old `/api/urls`.
- Dashboards beyond visits, countries and cities.
- Queues.
- KV.
- D1 read replication (a follow-up once latency is measured).
- Automatic deploys from CI.
