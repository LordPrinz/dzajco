# 6. One package and two test runners

- **Status:** Accepted
- **Date:** 2026-11-13

## Decision

- One package with `src/{domain,db,analytics,routes,views,middleware,client}`. No workspaces.
- `bun test` runs pure code: `src/domain` and `scripts` (`bun test ./src ./scripts`). Worker tests under
  `test/worker` are not in that run.
- `vitest` with `@cloudflare/vitest-pool-workers` runs everything that needs workerd: D1 (with
  `applyD1Migrations`), the Cache API, `request.cf`, `ExecutionContext`, cron. Scripts: `test` and
  `test:worker`.
- Playwright (`test/e2e`) covers the browser flows.

## Drivers

- About 1.5k lines of code. A multi-package layout would cost more than it gives.
- Fidelity to workerd where it matters (D1 constraints, cache, `waitUntil`).
- Fast tests for pure logic.

## Alternatives considered

- **Three packages (`apps/web`, `packages/core`, `packages/db`), as in dzajcarz-pro.** Rejected: three
  tsconfigs for about 1.5k lines. The dzajcarz pattern stays in `scripts/`, `.github` and the docs.
- **`bun test` only, with mocks.** Rejected: no real D1, Cache API or `cf` object.
- **`vitest` only.** Rejected: slower for pure logic, and repo scripts use Bun APIs.

## Consequences

- Two runners and two commands, and CI has separate jobs (Test, Worker tests).
- `src/domain` must stay free of workerd APIs, so `bun test` can run it.
- The boundary is a folder, so a tooling rule or review keeps it.
- Node is needed for wrangler and the Workers pool (the Docker image has Node and Bun, CI uses setup-node).

## Follow-ups

- None planned. Revisit the single package only if the code grows well beyond the 1.5k estimate.
