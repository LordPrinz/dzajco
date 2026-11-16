/** Shared naming rules for branches, commits and PR titles. */

/** The long-lived branch PRs merge into. */
export const TRUNK = "dev";

/** Branches that PRs target. */
export const TRUNK_BRANCHES = ["main", TRUNK] as const;

export const COMMIT_TYPES = [
  "feat",
  "fix",
  "chore",
  "docs",
  "refactor",
  "test",
  "perf",
  "ci",
  "build",
] as const;

export const COMMIT_SCOPES = [
  "core",
  "web",
  "api",
  "db",
  "stats",
  "ui",
  "infra",
  "ci",
  "docs",
  "deps",
  "deps-dev",
] as const;

/** `DZAJ-44-set-user-permissions` */
export const BRANCH_PATTERN = /^DZAJ-(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `[DZAJ-44] feat(api)!: Set user permissions` (optional scope and `!` for breaking changes). */
export const HEADER_PATTERN = new RegExp(
  String.raw`^\[DZAJ-\d+\] (?:${COMMIT_TYPES.join("|")})(?:\((?:${COMMIT_SCOPES.join("|")})\))?!?: \p{Lu}\S*(?: .*)?$`,
  "u",
);

/** Branches that never carry a ticket number. */
export const UNTICKETED_BRANCHES = new Set<string>([...TRUNK_BRANCHES, "HEAD"]);

/** Dependabot names its own branches (`dependabot/bun/zod-4.2.0`); its PR titles carry the umbrella ticket DZAJ-15. */
export const BOT_BRANCH_PATTERN = /^dependabot\/[\w./-]+$/;

/** Branch names a push may create or update: trunk, ticket branches and Dependabot branches. */
export function isValidBranch(branch: string): boolean {
  return (
    UNTICKETED_BRANCHES.has(branch) ||
    BRANCH_PATTERN.test(branch) ||
    BOT_BRANCH_PATTERN.test(branch)
  );
}

/** Commits git generates itself; they are allowed without a ticket. */
export const GENERATED_HEADER = /^(?:Merge |Revert "|fixup! |squash! |amend! )/;

/** A message that is git-generated (`fixup! …`) or already carries a ticket tag must not get another prefix. */
export function needsTicketPrefix(message: string): boolean {
  return !GENERATED_HEADER.test(message) && !/^\[DZAJ-\d+\]/.test(message);
}

export function ticketFromBranch(branch: string): string | undefined {
  const id = /^DZAJ-(\d+)(?:-|$)/.exec(branch)?.[1];
  return id ? `DZAJ-${id}` : undefined;
}

export async function currentBranch(): Promise<string> {
  // symbolic-ref also works before the first commit; it fails only on a detached HEAD.
  const result = await Bun.$`git symbolic-ref --short HEAD`.quiet().nothrow();
  return result.exitCode === 0 ? result.text().trim() : "HEAD";
}

export function fail(lines: string[]): never {
  console.error(`\n✖ ${lines.join("\n  ")}\n`);
  process.exit(1);
}
