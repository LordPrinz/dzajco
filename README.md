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

## Scripts

| Script                                           | What it does                                              |
| ------------------------------------------------ | --------------------------------------------------------- |
| `bun run dev`                                    | Start `wrangler dev`                                      |
| `bun run check` / `check:fix`                    | Biome lint and format check / apply fixes                 |
| `bun run typecheck`                              | Type-check Worker code and Bun code (scripts, unit tests) |
| `bun run test`                                   | Unit tests with `bun test` (`src`, `scripts`)             |
| `bun run test:worker`                            | Worker tests in the Workers runtime with Vitest           |
| `bun run types`                                  | Regenerate `worker-configuration.d.ts`                    |
| `bun run db:migrate:local` / `db:migrate:remote` | Apply D1 migrations                                       |
| `bun run deploy`                                 | Run all checks, then `wrangler deploy`                    |
