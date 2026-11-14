# 4. A new API under /api/v1 with no alias for /api/urls

- **Status:** Accepted
- **Date:** 2026-11-13

## Decision

v3.0 has a new contract under `/api/v1/*` (links, link stats, global stats). The old `/api/urls` routes are
not kept as an alias. `/dzajapi` redirects with 301 to `/docs/api`, and `/:id/info` redirects with 301 to
`/:id/stats`. `/docs/api` documents the v1 contract and has a "Migration from v2" section.

## Drivers

- The v2 contract carries the S1, S5 and B1 to B3 defects. The `secretKey` as a body or header field was
  the S1 injection vector.
- A new response shape (`partial`, `countries`, optional `cities`) does not fit the old one.
- Less code and fewer routes to test and secure.

## Alternatives considered

- **Alias `/api/urls` to the new handlers.** Rejected: it keeps the old input shapes, which are the source
  of the injection and the validation bugs, and the old and new responses differ.
- **Keep the old routes running.** Rejected: that leaves the v2 vulnerabilities in place.
- **Versioned alias for a transition period.** Rejected: more code to maintain for an unknown number of
  integrations.

## Consequences

- Old integrations stop working at cutover. The docs page tells them how to move.
- Errors use `{error: {code, message}}`.
- CORS allows `GET` from `*` only. `POST` and `DELETE` are for server-side or same-origin use.
- `/api/v1/` is a stable prefix. A breaking change would need `/api/v2`.

## Follow-ups

- Write the "Migration from v2" section of `/docs/api` (T11b).
