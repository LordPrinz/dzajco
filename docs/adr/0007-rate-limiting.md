# 7. Rate limiting: Rate Limiting bindings plus a WAF rule

- **Status:** Accepted
- **Date:** 2026-11-13

## Decision

- Bindings: the Workers Rate Limiting binding with `RL_CREATE`, `RL_DELETE`, `RL_STATS` and `RL_REDIRECT`
  (period 60 s, per IP). Limits per period: `RL_CREATE` 10, `RL_DELETE` 10, `RL_STATS` 60, `RL_REDIRECT` 120.
  `RL_REDIRECT` covers `GET /:id` and `GET /api/v1/links/:id`. `RL_STATS` covers
  `GET /api/v1/links/:id/stats` and `GET /api/v1/stats`, and `RL_REDIRECT` does not apply to them.
  The key is `cf-connecting-ip`, with IPv6 cut to /64. `x-forwarded-for` is ignored.
  A hit returns 429 with `Retry-After`.
- WAF rule, always: one zone rate limiting rule (the Free plan allows one, with a short fixed window) on all
  Worker paths, not static assets, with a loose per-IP threshold. It drops floods before the Worker runs.
  It is documented in `DEPLOYMENT.md`.
- The middleware is a no-op when a binding is missing from the environment (local runs and tests).

### Spike T9.0 result (2026-11-14)

A probe Worker with a `simple {limit: 10, period: 60}` binding deployed fine on Workers Free. Eleven
back-to-back requests all returned 200. Forty requests 0.3 s apart returned 24 times 200 and then a mix of
429 and 200.

Conclusion: the binding is available on Free. Counting is per location and eventually consistent, so the
limit is enforced after roughly 2.4 times the limit, and not monotonically. That is fine for an abuse
cut-off but not for exact limits. Tests mock the binding. The zone WAF rule remains the guard for the
request quota.

## Drivers

- Reads need a limit too: unlimited `GET /:id` is a cheap way to burn the daily request budget.
- v2 had one in-memory limiter for all clients (S4), so one client could block everyone.
- No D1 writes for limiting (budget).
- A 429 from the Worker still counts toward the 100k per day request quota, so a binding cannot protect it.
- Cloudflare docs did not say whether the binding works on Free. The spike showed that it does.

## Alternatives considered

- **Limiter in D1.** Rejected: every request costs a write, which hits the 100k writes per day budget.
- **In-memory limiter in the Worker.** Rejected: isolates are not shared, so it limits nothing reliably.
- **WAF rule only.** Not enough alone: one rule is coarse and cannot give per-route limits. Kept as an
  addition and as the fallback.

## Consequences

- The limits are per location and approximate, not exact global counters. A client can pass the limit by
  about 2.4 times before it is cut off.
- A 429 from a binding still counts toward the 100k per day request quota. The bindings only save D1 reads
  and AE writes. Only the WAF rule protects the quota.
- The no-JS form `POST /` shares `RL_CREATE`.
- If a binding is removed later, per-route limits (`RL_CREATE`, `RL_DELETE`, `RL_STATS`,
  `RL_REDIRECT`) are gone, and the WAF rule must be set up by hand on the zone.
- The unit tests use a mocked binding, so the real limit was checked in the T9.0 spike and is checked again in T16.

## Follow-ups

- Write the WAF rule steps and the threshold in `DEPLOYMENT.md` (T16).
