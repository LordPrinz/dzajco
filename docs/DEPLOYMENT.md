# Deployment

How to set up, deploy, migrate to and operate dzajco on Cloudflare. Deploys are manual: nothing in CI runs `wrangler deploy`.

Commands use the project's own wrangler (`bunx wrangler` or `./node_modules/.bin/wrangler`). Replace `<...>` placeholders with your values.

## 1. Prerequisites

- A Cloudflare account on the Workers Free plan.
- A domain on Cloudflare (active zone). The Cache API does not work on `*.workers.dev`, so the redirect cache and the rehearsal need a real domain.
- Bun 1.4.4 and Node.js, as in the [README](../README.md#requirements). Run `bun install` first.
- Log in once:

```sh
bunx wrangler login
bunx wrangler whoami   # shows your account id; you need it below
```

## 2. One-time setup

### D1 database

```sh
bunx wrangler d1 create dzajco
```

Copy the printed `database_id` into `d1_databases[0].database_id` in `wrangler.jsonc`, replacing the all-zero placeholder. Add `--location eeur` (or another hint) to place the database near your visitors; the hint cannot be changed later.

### Analytics Engine

The `dzajco_visits` dataset is created by the first write. There is nothing to run. It appears after the first redirect on the deployed Worker.

### Rate limit bindings

`RL_CREATE`, `RL_DELETE`, `RL_STATS` and `RL_REDIRECT` are declared in `wrangler.jsonc` (`ratelimits`) and need no setup. The `namespace_id` values (`1001` to `1004`) only have to be unique within your account. Limits and rationale: [ADR 0007](adr/0007-rate-limiting.md).

### Secrets

```sh
openssl rand -base64 32          # generate once, store in a password manager
read -rs SECRET_PEPPER_V1 && export SECRET_PEPPER_V1   # paste the pepper, no echo
printf '%s' "$SECRET_PEPPER_V1" | bunx wrangler secret put SECRET_PEPPER_V1 --env=""
bunx wrangler secret put CF_AE_TOKEN --env=""         # prompts for the value
```

Never put a secret value on a command line (`VAR=value cmd`): it lands in shell history and the process list. Keep `SECRET_PEPPER_V1` exported in this shell only for the import in section 5, which needs the same value.

- `SECRET_PEPPER_V1` is the HMAC pepper for link secret keys ([ADR 0003](adr/0003-secret-key-hashing.md)). Store a copy in a password manager. Losing it makes every stored secret key unverifiable.
- `CF_AE_TOKEN` is a Cloudflare API token with the single permission _Account Analytics: Read_ (My Profile, API Tokens, Create Token). Grant nothing else.
- Set `CF_AE_TOKEN` and `CF_ACCOUNT_ID` before the Worker takes traffic. The first rollup starts at the previous UTC day, so visits recorded earlier are never rolled up and stay missing from the stats.

If the Worker does not exist yet, wrangler offers to create it when you set the first secret. Accept.

### Vars

Edit `vars` in `wrangler.jsonc`:

| Var                     | Value                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_ORIGIN`         | The public origin, for example `https://dzaj.de`. No trailing slash. Used for short URLs and the own-host check. Not edited in the file: see below.                                         |
| `SECRET_PEPPER_VERSION` | `"1"` at first deploy.                                                                                                                                                                      |
| `CF_ACCOUNT_ID`         | 32 hex characters from `wrangler whoami` or the dashboard. Needed for the Analytics Engine SQL API. Without it (or without `CF_AE_TOKEN`) the rollup is skipped and fresh stats stay empty. |
| `ABUSE_EMAIL`           | Address behind the "Report abuse" link on 404/410 pages. Empty hides the link.                                                                                                              |
| `CF_ANALYTICS_TOKEN`    | Token of a Cloudflare Web Analytics site (dashboard, Analytics and Logs, Web Analytics, add site). Empty omits the beacon.                                                                  |
| `AE_FRESH_TTL`          | Seconds to cache fresh-data queries. Default `"300"`. See [section 7](#7-limits-and-when-to-move-to-paid).                                                                                  |
| `ROLLUP_MAX_PAGES`      | Pages (500 groups each) per hourly rollup call. Default `"10"`.                                                                                                                             |

Commit the production values (`database_id`, `CF_ACCOUNT_ID`, `ABUSE_EMAIL`, `CF_ANALYTICS_TOKEN`) in `wrangler.jsonc` through a normal PR. None of them is a secret, and a later pull would otherwise restore the placeholders. Secrets stay in `wrangler secret`.

`PUBLIC_ORIGIN` stays `http://localhost:8787` in the file, because local development, the worker tests and the end-to-end tests read the same `vars`. `bun run deploy` takes the real origin from the environment and passes it to `wrangler deploy --var`. It stops with an error when `PUBLIC_ORIGIN` is not set. Every deploy needs it, since a `--var` value is not stored in the config.

### Domain and routes

1. Dashboard, Workers & Pages, `dzajco`, Settings, Domains & Routes, Add, Custom domain. Enter the host of `PUBLIC_ORIGIN`. Cloudflare creates the DNS record and certificate.
2. `wrangler.jsonc` sets `workers_dev` and `preview_urls` to `false`, so every deploy keeps the `workers.dev` route and Preview URLs off. Do not turn them on in the dashboard: the next `bun run deploy` switches them off again. Both hosts bypass the WAF rule from section 3 and the Cache API.

For the first rehearsal use a spare domain or subdomain you control, not the production host (see [section 10](#10-rehearsal-checklist)).

## 3. WAF rate-limiting rule

The Free plan allows one rate-limiting rule per zone. It is the only protection for the 100k requests/day Worker quota: a `429` from a rate limit binding is still a Worker request and still counts. The rule drops floods before the Worker runs. Per-route limits stay in the bindings.

Dashboard: your domain, Security, WAF, Rate limiting rules, Create rule.

| Field                      | Value                            |
| -------------------------- | -------------------------------- |
| Rule name                  | `dzajco flood guard`             |
| If incoming requests match | Custom filter expression (below) |
| Characteristics            | IP                               |
| Requests / period          | 300 requests per 10 seconds      |
| Action                     | Block                            |
| Duration                   | 10 seconds                       |

Expression:

```
not starts_with(http.request.uri.path, "/assets/")
and not starts_with(http.request.uri.path, "/css/")
and not starts_with(http.request.uri.path, "/img/")
and not starts_with(http.request.uri.path, "/fonts/")
```

Static assets are excluded because they do not count against the Worker request quota; counting them would block a normal page load.

The Free plan limits which fields and operators a rule may use. If the dashboard rejects `starts_with`, use the wildcard operator if it is offered:

```
not (http.request.uri.path wildcard "/assets/*" or http.request.uri.path wildcard "/css/*" or http.request.uri.path wildcard "/img/*" or http.request.uri.path wildcard "/fonts/*")
```

If neither works, apply the rule to all paths. Assets then count toward the WAF counter, so raise the threshold (for example 1000 requests per 10 seconds) to keep normal page loads from tripping it.

Rationale for the numbers: a browser loading one page makes tens of requests, a heavy user clicks a few links per second, and a single IP behind a NAT may be several people. 300 per 10 s (30 req/s per IP) is far above that and still stops a script from burning the daily quota in minutes. Tighten it if you see abuse in the Security analytics.

The options available on the Free plan (periods, durations, characteristics) change over time. If the dashboard offers different values, keep the same shape: per-IP, a short window, a short block. Record what you set in the rehearsal checklist.

## 4. Deploy

```sh
bun run db:migrate:remote
PUBLIC_ORIGIN=https://dzaj.de bun run deploy
```

- `db:migrate:remote` runs `wrangler d1 migrations apply DB --remote`. It asks for confirmation and takes a backup after applying. If a migration fails, earlier migrations of the same run stay applied. Note a Time Travel bookmark before migrating (`bunx wrangler d1 time-travel info DB`) and restore from it if needed (section 6).
- `deploy` runs, in order: `bun run check`, `bun run typecheck`, `bun run test`, `bun run test:worker`, `bun run build:client`, `bun run check:size`, then `wrangler deploy`. Any failing step stops the deploy.

Watch live logs:

```sh
bunx wrangler tail
```

### Dev environment (test.dzaj.de)

Branch flow: feature branches merge into `dev`, `dev` is deployed to `https://test.dzaj.de`, and `dev` goes to `main` (production, `dzaj.de`) through a PR.

The dev environment is `env.dev` in `wrangler.jsonc`: Worker `dzajco-dev`, custom domain `test.dzaj.de`, its own D1 database `dzajco-dev`, Analytics Engine dataset `dzajco_visits_dev` and rate limit namespaces `2001` to `2004`. `workers_dev` and `preview_urls` are off, and the hourly cron runs.

Wrangler does not inherit bindings or vars into an environment, so `env.dev` repeats them.

`AE_DATASET` names the dataset the SQL queries read. It is set to `dzajco_visits_dev` in `env.dev` and left out of the top-level `vars`, where the Worker falls back to `dzajco_visits`. An empty value also falls back to the default.

The name must match `^[a-z0-9_]{1,64}$`; anything else makes the query builder throw before any SQL is built. Keep it equal to the `dataset` of the `VISITS` binding of the same environment.

One-time setup, with a Cloudflare account that has `dzaj.de` as an active zone:

```sh
printf '%s' "$SECRET_PEPPER_V1" | bunx wrangler secret put SECRET_PEPPER_V1 --env dev
bunx wrangler secret put CF_AE_TOKEN --env dev     # prompts for the value
```

Use a pepper of its own for dev, not the production one. Create a separate `CF_AE_TOKEN` for dev too (_Account Analytics: Read_), so it can be revoked on its own. Analytics Engine tokens are account-wide, so a dev token can read the production dataset; keep it out of anything shared.

The `dzajco-dev` database already exists and is empty. The custom domain and its DNS record are created by the first deploy, because the route in `wrangler.jsonc` has `custom_domain: true`. The `dzajco_visits_dev` dataset appears after the first redirect.

Deploy, always migrating first:

```sh
bun run db:migrate:dev
bun run deploy:dev
```

- `db:migrate:dev` runs `wrangler d1 migrations apply DB --remote --env dev`.
- `deploy:dev` runs the same checks as `deploy`, then `wrangler deploy --env dev`. `PUBLIC_ORIGIN` comes from `env.dev`, so nothing needs to be exported.
- `bun run deploy` (production) passes `--env=""` so wrangler targets the top-level config now that `env.dev` exists.
- Check the result with `bunx wrangler deploy --env dev --dry-run`; it lists the dev bindings.

As in production, nothing in CI runs `wrangler deploy`.

### Post-deploy checks

Replace `$ORIGIN` with your `PUBLIC_ORIGIN`.

1. Health:

   ```sh
   curl -s $ORIGIN/healthz        # {"ok":true}
   ```

2. Create a link, follow it, read its stats, using the web form or the API described on `/api-docs`. The redirect must answer `302` with the target in `Location`. Open the stats page of the link and check the visit appears.

3. Redirect CPU time. Run `bunx wrangler tail --format json`, request a cached short link a few dozen times and read `cpuTime` from the `outcome` events. The p50 must be under 5 ms. Cache misses cost more; look at the repeated requests.

4. Analytics Engine SQL API on the real `dzajco_visits` dataset. This is the query the rollup uses (`src/analytics/ae-source.ts`), reduced to one day. Use your account id and the `CF_AE_TOKEN` value:

   ```sh
   read -rs CF_AE_TOKEN && export CF_AE_TOKEN
   HDR=$(mktemp) && chmod 600 "$HDR"
   printf 'Authorization: Bearer %s\n' "$CF_AE_TOKEN" > "$HDR"
   curl -s "https://api.cloudflare.com/client/v4/accounts/<CF_ACCOUNT_ID>/analytics_engine/sql" \
     -H @"$HDR" \
     --data "SELECT index1 AS linkId, blob1 AS country, blob2 AS city, SUM(_sample_interval) AS visits
   FROM dzajco_visits
   WHERE timestamp >= toDateTime('<YYYY-MM-DD> 00:00:00') AND timestamp < toDateTime('<YYYY-MM-DD+1> 00:00:00')
   GROUP BY linkId, country, city
   ORDER BY linkId, country, city
   LIMIT 10
   FORMAT JSON"
   ```

   Expected: a JSON object with a `data` array holding the visits you just made, and no `errors`. A `401` or `403` means the token lacks _Account Analytics: Read_ or the account id is wrong. If the table does not exist yet, make a redirect first and retry after a minute.

5. Cron. The rollup and daily job run hourly (`0 * * * *`). Dashboard, Workers & Pages, `dzajco`, Settings, Triggers shows the schedule. After the next full hour, confirm a run in Observability, or leave `wrangler tail` open across the hour mark. Check that `cpuTime` of the scheduled run stays inside the limit; lower `ROLLUP_MAX_PAGES` if it does not.

## 5. Migration from v2 (cutover)

The v2 data lives in MongoDB. The importer (`bun run migrate:mongo`) reads it and writes only hashed secret keys to D1.

### Inputs

| Input          | How                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB        | `MONGODB_URI` in the environment (preferred). `--mongo-uri` also works but lands in shell history, and the importer warns about it. Optional `--mongo-db <name>`. |
| JSON export    | `--from-json <file>`, a `mongoexport --jsonArray` file. It contains the plaintext v2 secret keys: delete it after the import.                                     |
| Locations      | Only for `--visits`. The `locations` collection: read from MongoDB, or `locations.json` next to the `--from-json` file, or `--locations <file>`.                  |
| Pepper         | `SECRET_PEPPER_V1` in the environment, the same value as the Worker secret. Never written to files or logs.                                                       |
| Pepper version | Taken from `SECRET_PEPPER_VERSION` in `wrangler.jsonc` vars, unless `SECRET_PEPPER_VERSION` is exported.                                                          |

Keep the Mongo exports (`links.json`, `locations.json`) outside the repository tree, so they cannot end up in a commit.

Export the secrets into the shell without echo (the pepper as in section 2):

```sh
read -rs MONGODB_URI && export MONGODB_URI
```

### Flags

| Flag                   | Meaning                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--dry-run`            | Writes the SQL files and `report.json` under `--out` (default `.wrangler/migrate`) and executes nothing.                         |
| `--local` / `--remote` | Target D1 database. Exactly one is required unless `--dry-run`.                                                                  |
| `--yes`                | Required with `--remote`. It is a guard, not a prompt.                                                                           |
| `--delta`              | The same idempotent run (`INSERT OR IGNORE`), for links created since the last run. v2 edits and deletions are not carried over. |
| `--own-host <host>`    | Repeatable. Hosts treated as your own for the policy flags. Default: the host of `PUBLIC_ORIGIN`.                                |
| `--visits`             | Import only the v2 visit counters (`visits-NNNN.sql`), no links. Run it after the link import. See "Visit counters".             |
| `--locations <file>`   | The `locations` export for `--visits`, when it is not `locations.json` next to the `--from-json` file.                           |
| `--env <name>`         | Wrangler environment of the target database, for example `dev` for the dev D1.                                                   |

### Report

`report.json` has these fields:

| Field                | Meaning                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `read`               | Documents read from v2.                                                                                                       |
| `inserted`           | Links written.                                                                                                                |
| `skippedExpired`     | Expired links, not imported.                                                                                                  |
| `skippedInvalid`     | Invalid documents, including `url_too_long`.                                                                                  |
| `reservedCollisions` | Ids that collide with reserved names such as `api`, listed by id.                                                             |
| `duplicates`         | Ids that appear more than once after normalization.                                                                           |
| `legacyKeys`         | Links imported with a legacy secret key.                                                                                      |
| `policyFlags`        | Targets that are private, own-host or shortener URLs. They are imported but flagged. Block them with `admin:block` if needed. |
| `schemeAdded`        | v2 targets that started with `www.` and got `https://`.                                                                       |
| `visits`             | Only with `--visits` (then the only field): planned visits, unknown-country visits, unmapped names, over-located links.       |

### Steps

1. Dry run against the real data. Review `report.json`, especially `reservedCollisions` and `policyFlags`, and decide what to do with each before the real run.

   ```sh
   bun run migrate:mongo --local --dry-run
   ```

2. Rehearse the import into a local database:

   ```sh
   bun run db:migrate:local
   bun run migrate:mongo --local
   ```

3. Note a Time Travel bookmark of the remote database (`bunx wrangler d1 time-travel info DB`), then import:

   ```sh
   bun run migrate:mongo --remote --yes
   ```

4. Verify on the new host before touching DNS: a few migrated ids answer `302`, an old secret key deletes its link, the counts match the report.
5. Delta right before the DNS switch. v2 stays live during the import, so run the same import again to pick up new links:

   ```sh
   bun run migrate:mongo --remote --yes --delta
   ```

   No freeze is needed. Rerunning inserts nothing that is already there.

6. Switch the route. Remove the domain from the Vercel project (or point the DNS record away from Vercel) and attach it to the Worker as a custom domain (section 2). If the zone is already on Cloudflare, this is a DNS and route change only.
7. Keep the Vercel deployment up for rollback until you trust the new site (at least a few days). Disconnect the Vercel Git integration afterwards so it stops building.
8. Run the delta once more after the switch if v2 could still have received writes during DNS propagation.
9. Import the visit counters with a separate `--visits` run once v2 gets no more visits (see below). Then delete any JSON export.

### Visit counters

The link import leaves every link at zero visits. A separate run with `--visits` carries the v2 counters over: `visits` and `visitsLocation` of each imported link, with country, city and coordinates from the `locations` collection. It writes and runs only `visits-NNNN.sql`. It never replays the link import, which after the cutover would bring back links that owners deleted or that were taken down.

The v2 country name becomes its ISO code. Visits whose country name is not in the table, and visits that `visitsLocation` does not cover, go to the unknown-country row (`??`, the same row the rollup uses); the report lists the unmapped names. When the located visits add up to more than `visits` (32 links in the 2026-11-10 export), the located sum is imported.

Each row is written through the `v2_visit_import` ledger (migration 0003, apply it first; DESIGN.md explains the design). A row is added only if D1 holds the link with the same id, target and key hash, and only once. What that guarantees:

- A second run adds nothing, and the `visits-NNNN.sql` files are safe to re-run after a failure.
- After the cutover, visits counted by v3 stay in `link_stats` and the v2 visits are added on top, once.
- A link that is not in D1 yet is skipped without a ledger row, so a later run still imports it.
- A link whose id now belongs to someone else (other target or other key) is skipped. A link that was deleted after its visits were imported does not get them again if it comes back.
- Each link and place is imported once, so v2 visits counted after the run are never added. Run it after the DNS switch.

The key hash must match, so run with the same `SECRET_PEPPER_VERSION` and pepper as the link import. The planned totals in the report and the summary count every imported v2 link; links that the guard skips (id taken, target or key differs, link deleted) are in the plan but get no rows. Compare `SUM(visits)` in `link_stats` before and after the run to see what was added.

```sh
bun run migrate:mongo --from-json ../backup/links.json --visits --dry-run              # review report.json
bun run migrate:mongo --from-json ../backup/links.json --visits --local                # rehearse locally
bun run migrate:mongo --from-json ../backup/links.json --visits --remote --yes --env dev   # rehearse on dzajco-dev
bun run migrate:mongo --from-json ../backup/links.json --visits --remote --yes
```

With `--from-json` the importer reads `locations.json` from the same directory; export it with `mongoexport --collection locations --jsonArray`. Public and owner stats show the v2 visits right away; the global numbers on the About page after the next daily recompute.

## 6. Rollback

| Problem                  | Action                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The new site is wrong    | Point DNS or the route back to Vercel. v2 still runs.                                                                                                      |
| A bad Worker version     | `bunx wrangler rollback -m "<reason>"` returns to the previous version; pass a version id to pick another. `bunx wrangler versions list` shows candidates. |
| A failed or wrong import | Restore D1 with Time Travel, below.                                                                                                                        |

Time Travel keeps a point-in-time history of the database (7 days on the Free plan). Restoring replaces the whole database, including links created after the restore point.

```sh
bunx wrangler d1 time-travel info DB                              # current bookmark
bunx wrangler d1 time-travel info DB --timestamp <RFC3339 time>   # bookmark at a time
bunx wrangler d1 time-travel restore DB --bookmark <bookmark>
```

`restore` also accepts `--timestamp`. The output of `restore` includes the bookmark of the state before the restore; keep it so you can undo. Note the bookmark from `info` before every real import and before every migration.

## 7. Limits and when to move to Paid

Workers Free quotas that matter here: 100k requests/day, 100k Analytics Engine writes/day, 10k Analytics Engine queries/day, and the D1 daily write allowance. Move to the Paid plan when any of these holds:

- the 7-day average is above 70k requests per day;
- more than 80k Analytics Engine data points per day;
- more than 70k D1 writes per day;
- more than 7k Analytics Engine queries per day (the rollup has priority, so this is also the alarm threshold).

If fresh-data queries from many locations approach 7k per day, raise `AE_FRESH_TTL` to `"900"` (15 minutes) in `wrangler.jsonc` and redeploy. Check usage in the dashboard (Workers & Pages, `dzajco`, Metrics; D1, `dzajco`, Metrics). Redirects never depend on writes: a spent budget can break stats, not the `302`.

## 8. Pepper rotation

Stored secret keys carry their pepper version (`v<n>:<hex>`). To rotate:

1. Generate and set a new pepper without removing the old one:

   ```sh
   openssl rand -base64 32
   bunx wrangler secret put SECRET_PEPPER_V2 --env=""
   ```

2. Set `SECRET_PEPPER_VERSION` to `"2"` in `wrangler.jsonc` and run `bun run deploy`.
3. New links use V2. Old links keep verifying with V1, so keep `SECRET_PEPPER_V1` as long as any key hashed with it exists. If a pepper is missing, the Worker logs `secret pepper v<n> missing` once per isolate and those keys stop verifying.

## 9. Operations

- Block an abusive host or delete a link with the admin script. Exactly one of `--remote` or `--local` is required:

  ```sh
  bun run admin:block host <host> --reason "phishing" --remote
  bun run admin:block link <id> --remote --yes
  bun run admin:block unblock <host> --remote --yes
  bun run admin:block --help
  ```

  Add `--dry-run` to print the SQL without running it. Cached copies of a deleted link can still redirect for up to 60 seconds.

- Look up a link its owner deleted. Deleted links stay in the `deleted_links` table for 30 days (the daily cron purges older rows), with the target, dates and a visits summary, but not the secret hash:

  ```sh
  bun run admin:deleted --remote              # the 50 most recent deletes
  bun run admin:deleted <id> --remote         # every archived copy of one id
  bun run admin:deleted --env dev --remote --limit 200
  ```

  It only reads. Expired links and links removed with `admin:block link` are not archived.

- Abuse reports arrive at `ABUSE_EMAIL`. Block the host or delete the link, then reply. If the owner already deleted it, `admin:deleted <id>` shows where it pointed.
- Logs: `bunx wrangler tail`, or Observability in the dashboard (enabled in `wrangler.jsonc`). The Worker does not log the `Authorization` header, form bodies or create responses. Cloudflare's own invocation logs record request details; the rehearsal checklist checks that they do not keep the `Authorization` value. Client IPs appear only in Cloudflare's own logs (request logs and Workers Logs metadata); the app never writes them.
- Dependency updates: Dependabot opens weekly PRs (Bun, GitHub Actions, Docker) against `dev`. Merge them after CI passes, then redeploy manually.

## 10. Rehearsal checklist

Run the whole procedure once on a test domain before the production cutover. Tick each item in the PR.

Setup

- [ ] `wrangler login` done, `wrangler whoami` shows the right account
- [ ] `wrangler d1 create dzajco` run, `database_id` is in `wrangler.jsonc`
- [ ] `SECRET_PEPPER_V1` set (value saved in a password manager)
- [ ] `CF_AE_TOKEN` set, token has only _Account Analytics: Read_
- [ ] `PUBLIC_ORIGIN`, `SECRET_PEPPER_VERSION=1`, `CF_ACCOUNT_ID`, `ABUSE_EMAIL`, `CF_ANALYTICS_TOKEN` set in vars
- [ ] Test domain attached as custom domain; `workers_dev` and `preview_urls` are `false` in `wrangler.jsonc`, and the deploy left `workers.dev` and Preview URLs off
- [ ] WAF rate-limiting rule created with the expression and threshold from section 3 (record the values used: ______)

Deploy

- [ ] `bun run db:migrate:remote` succeeded
- [ ] `bun run deploy` succeeded
- [ ] `curl $ORIGIN/healthz` returns `{"ok":true}`
- [ ] Link created, redirect answers `302`, stats page shows the visit
- [ ] Redirect `cpuTime` p50 under 5 ms in `wrangler tail`
- [ ] Stats CPU time measured with `wrangler tail` on a link with many fresh visits; the Worker logs `fresh visits returned N rows` above 20000 rows
- [ ] SQL API query on the real `dzajco_visits` dataset returns the test visits
- [ ] Hourly cron ran (Triggers or Observability) and the rollup moved the cursor
- [ ] Cache API works on the test domain (a repeated redirect is served without a D1 read)
- [ ] Make a request with a dummy Bearer key (`curl -H "Authorization: Bearer AAAAAAAAAAAAAAAAAAAAAA" $ORIGIN/api/v1/links/<id>/stats`) and confirm Workers Logs don't show the `Authorization` value. If they do, set `"logs": { "invocation_logs": false }` under `observability` in `wrangler.jsonc` and redeploy

Migration

- [ ] Importer run once against a real MongoDB (staging copy or `docker compose --profile migrate-test`) with `--local --dry-run`, `report.json` reviewed
- [ ] `migrate:mongo --dry-run` report reviewed, reserved-name collisions and policy flags decided
- [ ] Real import done, counts match the report
- [ ] A migrated link redirects and deletes with its original v2 secret key
- [ ] `--delta` rerun inserts nothing new
- [ ] `--visits --remote --yes --env dev` rehearsed on the dev D1 (`dzajco-dev`): `link_stats` gets rows, and a second run leaves `SUM(visits)` unchanged
- [ ] `--visits` run after the DNS switch; the stats of a busy migrated link show its v2 visits, and a second run leaves them as they are
- [ ] D1 bookmark noted before the import; `time-travel restore` tried on the rehearsal database

Rollback and ops

- [ ] `wrangler rollback` tested on a deliberate no-op version
- [ ] Pepper rotation tried (V2 added, version bumped, old link still verifies)
- [ ] `bun run admin:block host <host> --remote` and `unblock` tried
- [ ] A link deleted with its key shows up in `bun run admin:deleted --remote`
- [ ] Production cutover plan agreed: DNS switch time, delta run, Vercel kept for rollback
