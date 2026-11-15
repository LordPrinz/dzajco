# Contributing

## First-time setup (repository owner)

```bash
gh auth refresh -s project   # Projects API needs the extra scope
bun run gh:setup             # repository settings, labels, rules, then the project board
```

The script prints the few steps GitHub only allows in the browser (board views, built-in workflows). Add
the `PROJECTS_TOKEN` repository secret by hand. It must be a classic PAT with only the `project` scope:
fine-grained tokens do not support user-owned Projects. Create it with
[this link](https://github.com/settings/tokens/new?scopes=project&description=dzajco%20project%20sync), then run
`gh secret set PROJECTS_TOKEN --repo LordPrinz/dzajco`. `GITHUB_TOKEN` cannot write to a user-owned project,
and `project-sync.yml` needs the token to move cards and close issues.

## Board

`Backlog → Todo → In Progress → QA → Done`

| Status      | Meaning                        | How it gets there                                 |
| ----------- | ------------------------------ | ------------------------------------------------- |
| Backlog     | Not planned yet                | new issue (automatic)                             |
| Todo        | Planned for the current sprint | sprint planning (manual)                          |
| In Progress | Someone is working on it       | branch `DZAJ-<n>-…` created or pushed (automatic) |
| QA          | PR open: code review + test    | PR opened or ready for review (automatic)         |
| Done        | Merged to `dev`                | PR merged (automatic)                             |

Fields: **Area**, **Priority** (P0 blocks others, P1 this sprint, P2 nice to have), **Size** (S up to half
a day, M 1 to 2 days, L split it), **Sprint** (2 weeks).

Every task is a GitHub issue. Create it from the board with _+ Add item → Create new issue_, never as a
draft (drafts have no number). Tasks from [`docs/ROADMAP.md`](docs/ROADMAP.md) are created by
`scripts/gh/create-issues.ts`.

## Flow

```bash
gh issue develop 12 --base dev --name DZAJ-12-short-description --checkout   # or "Create a branch" on the issue
# …work…
git commit -m "feat(api): Add stats endpoint"   # hook turns it into "[DZAJ-12] feat(api): Add stats endpoint"
git push -u origin HEAD                           # pre-push: branch name, typecheck, tests
gh pr create --base dev --draft --title "[DZAJ-12] feat(api): Add stats endpoint" --body "Refs #12"   # title: same format
```

PRs into `dev` use `Refs #<n>` in the body, not `Closes #<n>`. GitHub closes issues automatically only
when the PR targets the default branch, and the default stays `main` until the cutover.
`project-sync.yml` closes the issue and sets Done when the PR is merged into `dev`.

Open PRs as drafts. Never enable auto-merge. The owner merges.

## Conventions

- **Trunk** is `dev`: feature branches merge into it and it is deployed to `test.dzaj.de`. `dev` goes to `main` (production, `dzaj.de`) through a PR. `main` stays the default branch.
- **Ticket** `DZAJ-<n>` is issue `#<n>` (autolinked on GitHub).
- **Branch:** `DZAJ-<n>-short-kebab-description`.
- **Commit / PR title:** `[DZAJ-<n>] <type>(<optional scope>): <Description>`
  - types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`
  - scopes: `core`, `web`, `api`, `db`, `stats`, `ui`, `migrate`, `infra`, `ci`, `docs`, `deps`
  - issue areas (`area:*` labels and the board's Area field): `core`, `web`, `api`, `db`, `stats`, `ui`,
    `migrate`, `infra`, `docs`
  - issue type labels: `type:spike` marks a spike. Its commit type is still `chore(infra)`.
  - `!` after the type/scope marks a breaking change.
- PRs are **squash-merged**; the PR title becomes the commit on `dev`.
- **Dependabot** keeps its own `dependabot/…` branches and targets `dev`.
- Code, comments, docs and commits are in English. What the site shows to users is in Polish.

## Local development

```bash
bun install
bun run dev          # wrangler dev (workerd + local D1)
bun run infra:up     # the same in Docker (Debian, Node 24, Bun), no Cloudflare account needed
```

Locally there is no Analytics Engine SQL API. Without `CF_AE_TOKEN` the app uses `LocalVisitSource`, so the
fresh part of the stats is empty. Copy `.env.example` to set the other variables.

## Tests

```bash
bun test              # pure code: src and scripts
bun run test:worker   # code that needs workerd: D1, Cache API, request.cf (vitest + vitest-pool-workers)
bun run check         # Biome
bun run typecheck
```

Put code with no workerd dependency in `src/domain` so `bun test` can run it
([ADR 0006](docs/adr/0006-one-package-two-test-runners.md)). Do not commit `.skip` or `.only`.

## CI

| Job          | Runs                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| Conventions  | branch name and PR title                                                             |
| Lint         | `biome ci .`                                                                         |
| Typecheck    | `bun run typecheck`                                                                  |
| Test         | `bun test` with coverage, then the `src/domain` line coverage threshold              |
| Worker tests | `bun run test:worker`                                                                |
| Build        | client bundle, `check:size`, `wrangler deploy --dry-run` (no credentials)            |
| Image        | `docker.yml`, only when Docker, `src`, `infra` or similar files change: build, smoke |

Required checks: Conventions, Lint, Typecheck, Test, Worker tests, Build. Image is path-filtered, so it is
not required. To run it locally: `bun run infra:up`, `bun scripts/ci/smoke.ts http://localhost:8787`,
`bun run infra:down`.

## Git hooks (Husky)

| Hook                 | Runs                                           |
| -------------------- | ---------------------------------------------- |
| `prepare-commit-msg` | adds `[DZAJ-<n>]` from the branch name         |
| `commit-msg`         | validates the header format                    |
| `pre-commit`         | `biome check --staged --write` on staged files |
| `pre-push`           | branch name check, `typecheck`, `bun test`     |

CI repeats every check, so `--no-verify` only moves the failure to the PR.

## Deploy

Deploys are manual only: `bun run deploy`. CI runs tests and never deploys. Steps are in
`docs/DEPLOYMENT.md`.

## Definition of done

- Acceptance criteria in the issue are met.
- Tests cover the change; CI is green.
- The owner reviews and merges (squash). Never auto-merge.
- `docs/DESIGN.md` is updated if a decision changed. Larger decisions get an ADR in `docs/adr`.
