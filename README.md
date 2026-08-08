<h1 align="center">Dzajco — link shortener</h1>

<div align="center">The best link shortener you were looking for.</div>

---

A link shortener built to run entirely on Cloudflare's free plan: a single
Worker serves the API, the redirects and the React app, with D1 for storage and
KV as a redirect cache.

## Features

- **Short links** with auto-generated names of 4–12 characters, drawn from an
  alphabet with no look-alikes (no `0`/`O`, `1`/`l`/`I`, `5`/`S`, `2`/`Z`,
  `8`/`B`), or a custom name of your own.
- **QR codes** for every link, downloadable as PNG or SVG at three sizes.
- **Scheduling** — a start date (the link 425s before it), an expiry date, and
  an optional hard click limit.
- **Password protection** with a prompt before the redirect.
- **Click statistics** — totals, a 30-day timeline, countries and cities on a
  map, referrers, devices and browsers, plus CSV export.
- **UTM campaign reporting** for signed-in users.
- **Owner keys** — links created without an account return a secret once. It
  proves ownership (full statistics, edit, delete), is stored only as a hash
  server-side, and lives in the browser's local storage. The profile can be
  exported to a JSON file and imported on another device.
- **Accounts** via GitHub or Google OAuth, with a dashboard across devices.
- **English and Polish**, light and dark.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Runtime | Cloudflare Workers | Free tier covers 100k requests/day; redirects run at the edge |
| Routing | [Hono](https://hono.dev) | Tiny, Workers-native, no Node shims |
| Database | D1 (SQLite) | Free tier, no connection pooling to worry about |
| Cache | Workers KV | Read-through cache for the redirect hot path |
| Frontend | React + Vite, served as Workers Static Assets | One deployment artifact, no separate host |
| Geo | `request.cf` | No geo-IP API key, no extra latency, IP never leaves the request |
| Anti-bot | Turnstile + Workers rate limiting | Both free and unmetered |

Next.js was dropped: the app is a handful of pages plus an API, and a plain
Worker with a static SPA is cheaper to run and simpler to reason about on the
free plan.

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars      # fill in SESSION_SECRET at minimum
```

Create the D1 database and the KV namespace, then paste the ids into
`wrangler.toml` (it ships with placeholders):

```bash
npx wrangler d1 create dzajco
npx wrangler kv namespace create LINK_CACHE
```

Apply the schema and run it:

```bash
npm run db:local      # local D1
npm run build
npm run dev:worker    # http://localhost:8787
```

`npm run dev` runs Vite alone with hot reload, proxying `/api` to the Worker on
port 8787 — run both when working on the frontend.

## Deploy

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY     # optional but recommended
npx wrangler secret put GITHUB_CLIENT_ID         # optional
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID         # optional
npx wrangler secret put GOOGLE_CLIENT_SECRET

npm run db:remote
npm run deploy
```

Set `APP_URL` and `TURNSTILE_SITE_KEY` (the public one) in `wrangler.toml`
under `[vars]`. OAuth callback URLs are
`https://<your-domain>/api/auth/<provider>/callback`.

## How the data is stored

Clicks are stored **pre-aggregated**, not one row per visit. A click increments
a per-day counter, a per-country/city counter, a referrer hostname counter, a
device/browser bucket, and — for signed-in owners who enabled it — a UTM
combination. There is no visit-level row, no IP address and no user-agent
string in the database, and no cookie is set on the person clicking.

This is a privacy decision first, but it is also what keeps the app inside the
free tier: D1 allows 100k row writes a day, and each click costs 7–8 of them,
so roughly 12–14k clicks a day fit comfortably. If you need more, batch the
counters behind a Durable Object or a queue.

Coordinates from `request.cf` are rounded to two decimals (~1km) before being
stored — enough to place a city on the map, not enough to point at a household.

## Security notes

- **Rate limiting** on create, read and auth endpoints, keyed by account when
  signed in and by a hash of the IP otherwise. Uses Cloudflare's native
  rate-limit binding, falling back to a D1 ledger if that binding is missing so
  a misconfiguration cannot silently disable it.
- **Turnstile** on anonymous link creation.
- **Password attempts** share the strict auth budget, so guessing a link
  password is throttled like a login.
- **Target validation** rejects non-http(s) schemes, embedded credentials,
  single-label hosts, and addresses in private, loopback, link-local (including
  cloud metadata at `169.254.169.254`) and CGNAT ranges.
- **CSP** on every HTML response, with `frame-ancestors 'none'` — a shortener
  in an iframe is a clickjacking primitive.
- Owner keys and link passwords are stored as hashes (SHA-256 and PBKDF2-SHA256
  respectively). Neither can be recovered, only replaced.
- Bots and verified crawlers are redirected but never counted, so a link
  unfurled in a group chat does not inflate the statistics.

## API

Documented in the app at `/api-docs`. Briefly:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/links` | Create a link |
| `GET` | `/api/links` | List the signed-in account's links |
| `POST` | `/api/links/lookup` | Resolve code/secret pairs from a local profile |
| `PATCH` | `/api/links/:code` | Update target, schedule, password, state |
| `DELETE` | `/api/links/:code` | Delete a link and its statistics |
| `GET` | `/api/stats/:code` | Statistics (public summary, or full for owners) |
| `GET` | `/api/stats/:code/export.csv` | Geography as CSV |
| `GET` | `/api/stats` | Site-wide counters |
| `GET` | `/api/resolve/:code` | Why a link did not redirect |
| `POST` | `/api/resolve/:code/unlock` | Exchange a password for the target |

Ownership is proved with the `x-dzajco-secret` header (or `?secret=`) for
anonymous links, and with the session cookie for account-owned ones.
