# dzajco

A small URL shortener running as a single Cloudflare Worker: Hono + Hono JSX, D1 for links, Analytics Engine for visit statistics. Bun is the toolchain.

## Requirements

- Bun 1.4.4
- Node.js (wrangler, workerd and vitest run on it)

If you manage Node with Volta, the `workerd` postinstall fails under the Volta shim (`bun install` exits with 126). Put a real Node first on `PATH` instead:

```sh
PATH="$HOME/.volta/tools/image/node/<version>/bin:$PATH" bun install
```

Local secrets come only from `.dev.vars` (see `.env.example`). `.env` files are not loaded into the Worker.

## Getting started

```sh
bun install
bun run db:migrate:local
bun run dev
```

The Worker listens on http://localhost:8787. `GET /healthz` returns `{"ok":true}`.

## Docker

`bun run infra:up` builds a Debian image (Node 26 and Bun 1.4.4) and starts `wrangler dev` in it on http://localhost:8787. It applies the D1 migrations on start and keeps the database in a volume. It needs no Cloudflare account or `CF_AE_TOKEN`; without the token the app uses `LocalVisitSource`, so fresh stats are empty locally. The pepper comes from `SECRET_PEPPER_V1` in an untracked `infra/.env`, with a dev-only default.

```sh
bun run infra:up
bun scripts/ci/smoke.ts http://localhost:8787   # /healthz 200, create a link 201, follow it 302
bun run infra:down
```

The image is for development and tests only. Production is the Cloudflare Worker.

## Git hooks

`bun install` installs the husky hooks (the `prepare` script): commit message and branch name checks, a Biome check of staged files, and typecheck plus tests before every push. Husky sets `core.hooksPath`, which all worktrees of a clone share, so run `bun install` in each new worktree or the hooks silently do not run. If the pre-commit check fails, run `bun run check:fix` and stage the result.

## Scripts

| Script                                           | What it does                                                    |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `bun run dev`                                    | Start `wrangler dev`                                            |
| `bun run check` / `check:fix`                    | Biome lint and format check / apply fixes                       |
| `bun run typecheck`                              | Type-check Worker code and Bun code (scripts, unit tests)       |
| `bun run test`                                   | Unit tests with `bun test` (`src`, `scripts`)                   |
| `bun run test:worker`                            | Worker tests in the Workers runtime with Vitest                 |
| `bun run test:coverage`                          | Unit tests with coverage; fails below 90% lines in `src/domain` |
| `bun run test:e2e`                               | End-to-end tests with `bun test` and `Bun.WebView`              |
| `bun run test:lhci`                              | Lighthouse CI run                                               |
| `bun run build:client`                           | Bundle `src/client` into `public/assets`                        |
| `bun run check:size`                             | Fail when a built bundle exceeds the gzip budget                |
| `bun run admin:block`                            | Block or unblock a host, or delete a link (abuse CLI)           |
| `bun run infra:up` / `infra:down`                | Start and stop the Docker dev environment                       |
| `bun run types`                                  | Regenerate `worker-configuration.d.ts`                          |
| `bun run db:migrate:local` / `db:migrate:remote` | Apply D1 migrations                                             |
| `bun run db:migrate:dev`                         | Apply D1 migrations to the dev environment                      |
| `bun run deploy`                                 | Run all checks, then `wrangler deploy`                          |
| `bun run deploy:dev`                             | Run all checks, then deploy to test.dzaj.de (`--env dev`)       |
