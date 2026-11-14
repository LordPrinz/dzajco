# Security audit, November 2026 (v3.0)

This is the security audit of the v3 Worker before the v3.0 cutover (issue #50, T18). It covers the
application and its dependencies and supply chain. Every finding below is either fixed in the same pull
request or accepted with a reason.

## Scope

- Application: every route in `src/index.ts` and the middleware order; the domain rules in `src/domain`
  (URL policy, ids, custom names, secrets); D1 queries and the stats rollup; the Analytics Engine SQL
  builder; the cron handler; the client scripts in `src/client`; response headers; static assets in
  `public/`.
- Tooling that touches production data: `scripts/admin/block.ts` and the MongoDB to D1 importer in
  `scripts/migrate`.
- CI and build: `.github/workflows/*`, `.github/dependabot.yml`, the `Dockerfile`, the compose file and
  the container entrypoint.
- Dependencies: everything in `package.json` and `bun.lock`, the GitHub Actions and the
  Docker base images.

Out of scope: the v2 code still on `main` (replaced at cutover) and the live Cloudflare account. Nothing ran
against Cloudflare, the remote D1 database or the production MongoDB.

## Method

- Manual review against the OWASP Top 10:2025 categories: A01 Broken Access Control (including SSRF-style
  targets), A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures,
  A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity
  Failures, A09 Logging and Alerting Failures, A10 Mishandling of Exceptional Conditions.
- Probes: Worker-level tests with `@cloudflare/vitest-pool-workers` against `src/index.ts` and a local D1
  database, plus `EXPLAIN QUERY PLAN` for the D1 queries.
- Dependency and supply chain: `bun audit`, `bun pm untrusted`, npm registry metadata and the GitHub
  advisory database for each direct dependency, tag-to-SHA checks for every pinned action
  (`git ls-remote`), and digest checks for the Docker base images against the registry.
- Fixes were made test first. Each fix has a regression test that failed before the change.

## Summary

| ID    | Severity | OWASP 2025 | Finding                                                                          | Status   |
| ----- | -------- | ---------- | -------------------------------------------------------------------------------- | -------- |
| APP-1 | Medium   | A06        | Blocklist check scanned all of `blocked_hosts` on every redirect miss and create | Fixed    |
| APP-2 | Low      | A10, A01   | IPv6 literal targets failed with 503; gaps in the IPv6 private range check       | Fixed    |
| APP-3 | Low      | A02        | Static assets had none of the security headers                                   | Fixed    |
| APP-4 | Low      | A01, A06   | IPv4 documentation and benchmarking ranges passed the private target rule        | Fixed    |
| APP-5 | Info     | A06        | Lookup ids allowed format characters; `admin:block link` could not delete them   | Fixed    |
| APP-6 | Info     | A02        | CSP `script-src` allowed the whole analytics script host                         | Fixed    |
| DEP-1 | Info     | A03        | Supply chain hardening (Dependabot cooldown, install scripts, Node pin)          | Fixed    |
| DEP-2 | Low      | A03        | Advisories in transitive dependencies of the Lighthouse CI tool (`@lhci/cli`)    | Accepted |

Critical 0, High 0, Medium 1, Low 4, Info 3. No known advisory affects code that runs in production.

## Findings

### APP-1 (Medium): full scan of `blocked_hosts` on every redirect cache miss and every create

`getLinkRecord` and `isHostBlocked` matched a host against the blocklist with
`b.host = x OR substr(x, -(length(b.host) + 1)) = '.' || b.host`. SQLite cannot use the primary key for
that predicate, so `EXPLAIN QUERY PLAN` showed `SCAN b`: every row of `blocked_hosts` was read on each
redirect cache miss and each create. D1 bills scanned rows as rows read. With a blocklist of a few hundred
or a thousand hosts, one client could use up the free plan's daily read quota in hours by requesting real
links from colos that have not cached them, and after that every uncached redirect fails.

Fix: both queries now build the host and its parent domains in SQL with a recursive CTE (`a.b.c`, `b.c`,
`c`) and look each one up with `host IN (...)`. Both use one shared CTE builder and a single bound
parameter. `parseTarget` now rejects a host longer than 253 characters (the DNS limit) as `invalid_url`;
before, such a host was accepted as long as the whole URL fit in 2048 characters. So a new host has at
most 127 labels, and the CTE also stops at 127 rows for any longer host stored earlier. That is at most
127 primary key lookups. The query plans are now:

```text
getLinkRecord                               isHostBlocked
SEARCH l USING PRIMARY KEY (id=?)           SEARCH b USING PRIMARY KEY (host=?)
CORRELATED SCALAR SUBQUERY 4                LIST SUBQUERY 3
SEARCH b USING PRIMARY KEY (host=?)         MATERIALIZE s
CORRELATED LIST SUBQUERY 3                  SETUP
MATERIALIZE s                               SCAN CONSTANT ROW
SETUP                                       RECURSIVE STEP
SCAN CONSTANT ROW                           SCAN s
RECURSIVE STEP                              SCAN s
SCAN s
SCAN s
```

`SCAN s` is the CTE (one row per label), not the table. The old `isHostBlocked` query gave `SCAN b`.

Tests: `test/worker/db.test.ts` asserts that neither plan scans `blocked_hosts` and both use its primary
key. It also seeds 500 unrelated hosts and checks the exact host, a subdomain, a deep subdomain, a
lookalike (`notevil.com`, `evil.com.example`) and the bare TLD, on both paths, and that `rows_read` stays
below 50. The existing tests for underscores, IDN hosts and a 12-label entry still pass.

### APP-2 (Low): IPv6 literal targets failed with 503, and the IPv6 check had gaps

`parseTarget` accepted `http://[2606:4700:4700::1111]/`, but `isHostBlocked` passed the bracketed host to
`normalizeHost`, which refused any `:`. Create mapped that error to `503 service_unavailable`, so no IPv6
target could ever be shortened and the client was told to retry. The same bug hid gaps in
`isPrivateIPv6`: multicast `ff00::/8`, site-local `fec0::/10`, documentation `2001:db8::/32`, Teredo
`2001::/32` (which can carry any IPv4 address, including a private one), discard `100::/64`, local-use
NAT64 `64:ff9b:1::/48`, documentation `3fff::/20` (RFC 9637) and IPv4-translated `::ffff:0:0:0/96`
addresses that embed a private IPv4 address were not rejected. A naive fix to `normalizeHost` would have let those through.

Fix: `normalizeHost` accepts a bracketed IPv6 literal and returns the compressed form that `new URL`
produces, which is also what `insertLink` stores as `target_host`. The blocklist lookup then matches it as
a whole. `isPrivateIPv6` now rejects these ranges. Teredo and local-use NAT64 are rejected as whole ranges instead of
decoding the embedded address: Teredo is obsolete, and local-use NAT64 maps into a network the Worker
cannot see. The IPv4 embedded in mapped, translated, compatible and well-known NAT64 (`64:ff9b::/96`)
addresses is checked with its third octet as well, so it follows APP-4 too.

Tests: `src/domain/url-policy.test.ts` (each new range rejected, neighbours such as `2001:1::1`,
`2001:db9::1`, `101::1`, `fe00::1`, `64:ff9b:2::1`, `3fff:1000::1` and `3ffe::1` accepted, and a
253-character host accepted while 254 characters and `"a.".repeat(900) + "com"` give `invalid_url`), `test/worker/api.test.ts` (a public IPv6 target gives 201
and redirects; `[ff02::1]` and `[2001:db8::1]` give 400 `private_target`; a blocked IPv6 host gives 400
`blocked_target` on create and 410 on redirect), `scripts/admin/block.test.ts` (`admin:block host
[2001:DB8::1]` stores `[2001:db8::1]`; an unbracketed or malformed literal is refused).

### APP-3 (Low): static assets had no security headers

Workers Static Assets serves `public/` without running the Worker, so the header middleware never saw
asset responses, and `public/_headers` did not exist although DESIGN.md described it. Client bundles,
stylesheets, fonts, SVGs and the favicon went out without HSTS, `nosniff`, `Referrer-Policy` or a CSP.
There was no injection path, since all assets are first party. The gap mattered for a first visit straight
to an asset URL, MIME sniffing, and SVGs opened as documents.

Fix: `public/_headers` gives every asset `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` and
`Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`.
A CSP on a script or stylesheet response does not limit how a page uses it; it only applies when the file
is opened as a document. Cloudflare documents that `_headers` applies to asset responses only and is not
served itself. A local `wrangler dev` run confirmed both: `/css/app.css` carries the headers, Worker pages
keep their own nonce CSP, and `GET /_headers` is a 404 from the Worker. `_headers` was already a reserved
name.

Tests: `scripts/ci/public-headers.test.ts` parses the file and checks the `/*` rule. The Docker smoke test
(`scripts/ci/smoke.ts`) now also requests `/css/app.css` from `wrangler dev` and fails without HSTS and
`nosniff`.

### APP-4 (Low): IPv4 documentation and benchmarking ranges passed the private target rule

DESIGN.md says reserved IPv4 addresses are rejected, but `192.0.0.0/24`, `192.0.2.0/24`,
`198.18.0.0/15`, `198.51.100.0/24` and `203.0.113.0/24` were accepted. The Worker never fetches a target,
so this is not server-side SSRF. It is the case `private_target` exists for: a short link that sends a
visitor's browser to an address only reachable inside some networks (198.18.0.0/15 in particular).

Fix: `isPrivateIPv4` takes the third octet and rejects these ranges. The end-to-end tests use
`198.51.100.x` and `203.0.113.x` only as client addresses in `cf-connecting-ip`, never as targets, so they
are unaffected.

Tests: `src/domain/url-policy.test.ts` covers each range plus neighbours that stay allowed (`192.0.1.1`,
`192.0.3.1`, `198.17.255.255`, `198.20.0.1`, `198.51.101.1`, `203.0.112.1`, `203.0.114.1`) and the
IPv4-mapped form `[::ffff:198.18.0.1]`. `test/worker/api.test.ts` checks `198.18.0.1` through the API.

### APP-5 (Info): lookup ids allowed format characters

DESIGN.md says redirect lookup ids have no `/`, control or format characters, but `LOOKUP_ID` only
excluded `/` and control characters. Creation was always strict, so only imported v2 ids could contain
zero-width or bidi characters. The migration accepted them, while `admin:block link` used its own,
stricter pattern and refused them. An abusive imported link with such an id could not be deleted with the
CLI.

Fix: `LOOKUP_ID` now also excludes `\p{Cf}`, and `admin:block link` uses the shared `LOOKUP_ID`. Redirect,
migration and the admin CLI now accept exactly the same ids. The importer reports an id with a format
character under `invalid` (reason `invalid_id`) instead of importing a link that nobody can type. No
imported fixture or test depends on such ids.

Tests: `src/domain/ids.test.ts` (zero-width space, right-to-left override, soft hyphen and BOM rejected;
spaces, punctuation and non-Latin letters accepted) and a fast-check property in
`scripts/admin/block.test.ts` that every id `LOOKUP_ID` accepts is accepted by `admin:block link`.

### APP-6 (Info): analytics host allowed in full in `script-src`

The HTML CSP allowed any script from `https://static.cloudflareinsights.com`. Only `beacon.min.js` is
loaded, and it already carries the nonce.

Fix: `script-src` lists `https://static.cloudflareinsights.com/beacon.min.js`. A host source with a path
matches that exact file. The host entry was kept rather than dropped, so browsers that do not support
nonces still load the beacon. DESIGN.md and the CSP tests in `test/worker/api.test.ts` and
`test/worker/events.test.ts` were updated.

### DEP-1 (Info): supply chain hardening

The dependency audit found no vulnerable package. These changes reduce exposure to a future malicious
release:

- Dependabot waits seven days before proposing a new npm release (`cooldown.default-days: 7` for `bun`).
  Most malicious npm versions are found and pulled within that time.
- `package.json` lists `trustedDependencies` explicitly (`esbuild`, `fsevents`, `workerd`). An explicit
  list replaces bun's built-in allow-list, so no other package can start running install scripts without
  a reviewed change. `bun install --frozen-lockfile` and `bun pm untrusted` are clean with it.
- The Lint and Typecheck CI jobs install with `--ignore-scripts`. Biome and TypeScript ship prebuilt
  platform binaries, so both work without install scripts (checked with a clean install). The jobs that
  run `wrangler` or the Workers test pool still run the `workerd` and `esbuild` install scripts, which
  they need.
- Node is pinned in every place it runs: `actions/setup-node` uses `24.22.3` instead of the floating `24`
  in `ci.yml` and `e2e.yml` (Dependabot does not update this value, so it is bumped by hand), and the
  Docker dev image moved from `node:22-bookworm-slim` to `node:24-bookworm-slim`, pinned by its
  multi-arch index digest, which is the same image as `24.22.3-bookworm-slim`. Dependabot updates that
  digest.

### DEP-2 (Low, accepted): advisories under `@lhci/cli`

The Lighthouse CI tool (`@lhci/cli` 0.15.1, added with the end-to-end tests) pulls in packages with
published advisories. `bun audit` lists them:

| Package             | Path                                                | Advisories                                    |
| ------------------- | --------------------------------------------------- | --------------------------------------------- |
| `basic-ftp` 5.3.1   | `@lhci/cli` > `proxy-agent` > ... > `get-uri`       | 1 high, 2 moderate (FTP listing parser, CRLF) |
| `extract-zip` 2.0.1 | `@lhci/cli` > `lighthouse` > `puppeteer-core` > ... | 2 high (symlink entries in an archive)        |
| `tmp` 0.1.0, 0.0.33 | `@lhci/cli` > `tmp`                                 | 1 high, 1 low (prefix and symlink handling)   |
| `uuid` 8.3.2        | `@lhci/cli` > `uuid`                                | 1 moderate (buffer bounds in v3/v5/v6)        |
| `zod` 3.25.76       | `@lhci/cli` > `lighthouse` > ... > `chromium-bidi`  | 1 high (memory use on oversized input)        |

None of these packages reaches the Worker bundle or the client bundles. They run only in the E2E CI job and
on a developer machine, against the local `wrangler dev` server. In that use none of the vulnerable code
paths sees untrusted input: the job uses no FTP proxy; Lighthouse drives an installed Chrome through
`puppeteer-core`, which downloads and unpacks no browser archive; `tmp` is only used by `lhci open`, which
CI does not run; `uuid` is only called as `v4()`; and `zod` validates messages from the local Chrome. The job has `contents: read` and no secrets.
`zod` 4.6.6, used by `@cloudflare/vitest-plugin`, is not affected (the advisory covers versions below it).

The fixes need major version bumps that `@lhci/cli` has not adopted (or, for `extract-zip`, no fixed
release exists), so forcing them with `overrides` could break the tool. Accepted until `@lhci/cli`
publishes an update; Dependabot will propose it.

## Dependency audit

- `bun audit`: no advisory for any production dependency or any package in the Worker or client
  bundles. The only advisories are the `@lhci/cli` ones under DEP-2.
- Direct dependencies (13): each is pinned to an exact version (`bunfig.toml` sets `exact = true`) and
  `bun.lock` carries a sha512 integrity hash for every registry package. None has a GitHub advisory at
  its pinned version, none is deprecated or archived. All are at their latest release except `mongodb`
  7.8.0 (7.9.0 is out; dev only, used by the importer; Dependabot's grouped update will cover it).
  `leaflet` 1.9.4 is from 2023, but the project is active and 2.0 is in beta.
- Install scripts: only `esbuild`, `workerd` (both place and verify a platform binary) and `fsevents`
  (macOS only) have one. `sharp` ships prebuilt binaries and has none.
- Prerelease packages in the tree come from wrangler's own manifest (`miniflare` beta, `youch` beta,
  `unenv` release candidate, `@emnapi/*` beta). None has an advisory.
- GitHub Actions: `actions/checkout`, `oven-sh/setup-bun`, `actions/setup-node` and
  `actions/upload-artifact` are pinned to full SHAs, and each SHA matches its tag comment. Workflows set `permissions: {}`
  at the top and grant `contents: read` per job.
- Docker: `oven/bun`, `node` (now `24-bookworm-slim`) and `mongo` are pinned by multi-arch index digest,
  and each digest matches the current tag. The image is for local development and CI only.
- `main` still carries the v2 stack with open Dependabot alerts. Those manifests go away at cutover and
  were not audited.

## Verified controls

- Routing and middleware: request id, then security headers, then site extras. Named routes come before
  `/:id`, and reserved names return 404 from `parseId`. `HEAD /:id` records no visit.
- Response headers: every Worker response type (302, HTML, JSON, `text/plain` 429, OPTIONS 204) carries
  HSTS and `nosniff`. HTML gets a fresh 128-bit nonce CSP with no `unsafe-inline`, `Referrer-Policy` and
  `Permissions-Policy`. JSON gets `default-src 'none'`. Pages are `no-store`.
- CORS: `*` only on GET and HEAD, `Origin` is never reflected, no credentials. DELETE and POST preflights
  get no `Access-Control-Allow-Origin`.
- CSRF on the no-JS form: cross-site, same-site, `none`, missing headers and `Origin: null` give 403. The
  check runs before the rate limiter.
- Input validation: strict Valibot objects (extra keys and `__proto__` give 400), bodies capped at 8 KB
  while streaming, `application/json` required. The URL policy rejects other schemes, credentials, own
  hosts (with case, port and trailing dot variants), `localhost`, alternative IPv4 forms, mapped and
  translated IPv6 forms and other shorteners. Custom names are NFC, letters and digits only, at most 96
  bytes, with no mixed Latin script and a reserved check on the NFKC lowercase form.
- Secrets: 128-bit keys from `crypto.getRandomValues`, stored as a versioned HMAC-SHA256 with a pepper,
  verified in constant time with `crypto.subtle.verify`. The Bearer pattern is strict and keys never
  appear in URLs. `DELETE` re-checks the hash in its `WHERE` clause, so there is no race between check and
  delete. An invalid `Authorization` on stats gives 403 and never falls back to public stats.
- Access control: public stats return countries only. Cities and coordinates need a key checked against
  D1, not the cached record.
- Injection: every D1 statement uses bound parameters. Analytics Engine SQL only interpolates a validated
  date and safe integers, and the account id is checked as hex before it goes into the URL. The admin CLI
  and importer quote SQL strings, refuse control characters and start wrangler with an argument array, not
  a shell.
- Redirects: the stored target is parsed again and must be http or https before it becomes `Location`.
  Cache keys live under an internal host that no public path can reach. Cached records live at most 60
  seconds and never past expiry.
- XSS: server views are hono/jsx (escaped, no raw HTML). Client scripts write data only through
  `textContent`, text nodes, `dataset` and built paths. Event effects are loaded only from a fixed list.
- Rate limits: per route, keyed on `cf-connecting-ip` (IPv6 cut to /64, IPv4-mapped folded).
  `X-Forwarded-For` is never read.
- Errors and logging: the error handler logs the request id and error class only. 500 bodies are generic.
  The `Authorization` header, form bodies and create responses are never logged.
- Cron: the rollup is skipped without credentials, pages are guarded by compare-and-swap, daily steps are
  idempotent and expired-link deletion is capped per run.
- CI: SHA-pinned actions, least privilege per job, `persist-credentials: false`, no
  `pull_request_target`, untrusted branch names and PR titles passed through `env`. The wiki token only
  reaches the push step on the trunk branch.
- Container: digest-pinned bases, runs as the `node` user, the build context excludes `.env*` and
  `.dev.vars*`, ports bound to 127.0.0.1. The default pepper and the unauthenticated MongoDB are for local
  use only.
- Migration: v2 keys are hashed before any SQL is written, the child wrangler process gets no pepper or
  MongoDB URI, MongoDB errors are redacted, and reruns are safe.
- Secrets scan: no credentials in the source tree or in git history.

## Residual risks accepted by design

- Open redirect. Shortening any http or https URL is the product. Hosts that resolve to private
  addresses through DNS (for example `127.0.0.1.nip.io`) are accepted, because the Worker resolves no
  names and fetches nothing. Abuse is handled with the shortener list, `blocked_hosts` and the report
  link.
- Workers request quota. A 429 from a rate limit binding still counts as a request. The WAF rule in
  DEPLOYMENT.md (300 requests per 10 seconds per IP) still lets one IP spend the free daily quota in
  about an hour. Tighten the rule if that happens.
- Keys in `localStorage`. A same-origin XSS would expose every saved key. The nonce-only CSP, escaped
  rendering and the single third-party script (now limited to one file) keep that risk low.
- Workers Logs and the owner key. `observability` is enabled, and every request produces a Cloudflare
  invocation log with request details. The application never logs `Authorization`. Cloudflare documents
  that Tail Worker events replace the values of headers whose names contain `auth`, `key`, `secret`,
  `token` or `jwt` with `REDACTED`. It does not say the same for Workers Logs, and it offers no setting to
  exclude single headers. Mitigation: the rehearsal checks a real log entry. If the key shows up, set
  `observability.logs.invocation_logs` to `false`. That drops the per-request invocation logs, but the
  Worker's own `console` output (errors, warnings) is still kept. Logs are visible only to account
  members and expire after the plan's retention period.
- Analytics Engine late ingest. Visits that AE ingests after 01:00 UTC the next day can be skipped or
  counted twice by the daily rollup.
- Cache staleness. For up to 60 seconds another colo can serve a deleted link, or a link whose host was
  just blocked.
- Single-script lookalike names (for example all Cyrillic) are allowed. Only mixing Latin with another
  script is refused.
- Imported v2 links that break the v3 policy are imported and listed in the report. The operator reviews
  them and runs `admin:block`.

## Follow-ups

- During the deployment rehearsal, send a request with a dummy Bearer key and confirm that Workers Logs do
  not show the `Authorization` value (checklist item in DEPLOYMENT.md, section 10). If they do, turn off
  invocation logs as described under residual risks.
- After the first deploy, check that `/css/app.css` on the production host carries the `_headers` values.
- Bump `mongodb` to 7.9.0 through the next grouped Dependabot update.
- Update `@lhci/cli` once a release drops the vulnerable transitive versions (DEP-2), then re-run
  `bun audit`.
- Watch for a stable `leaflet` 2.0.
- Google Safe Browsing checks on create are still listed as a follow-up in DESIGN.md.
