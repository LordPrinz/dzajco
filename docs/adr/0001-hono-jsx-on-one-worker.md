# 1. Hono JSX on one Worker

- **Status:** Accepted
- **Date:** 2026-11-13

## Decision

v3.0 is one Cloudflare Worker. Hono serves the API and the pages, and the pages are rendered on the server
with Hono JSX. Client JavaScript is minimal: copying, local history, and a lazy Leaflet island on the stats
page. Static files come from Workers Static Assets. CSS is plain CSS (variables, a few files). The target
runtime is workerd only.

## Drivers

- Free plan: 10 ms CPU per invocation and 100k requests per day.
- Redirect speed. A cold start or a heavy bundle on the redirect path is a cost.
- Creating and following a link must work without JavaScript.
- A small UI of about 10 views.

## Alternatives considered

- **Next.js through OpenNext.** Rejected: heavier bundle and cold start. The v2 bundle weight was already a
  problem (P3).
- **Hono with Preact or React.** Rejected: ships more JavaScript than this UI needs.
- **Tailwind CLI instead of plain CSS.** Rejected: adds a build step and globs over `.tsx` for about 10
  views.

## Consequences

- No hydration. Interactivity is small scripts built with `bun build` into `public/assets`.
- A JS size budget is checked in CI (`scripts/ci/size.ts`, 15 KB gzip per page without the map).
- Bun is used for tooling only. Code that runs in production must work on workerd.
- The v2 look is ported by hand to plain CSS.

## Follow-ups

- Measure real redirect CPU time with `wrangler tail` during the T16 rehearsal.
