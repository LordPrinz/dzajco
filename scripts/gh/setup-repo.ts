// Applies repository settings, labels, branch rules and autolinks. Run locally:
//   bun run gh:setup-repo [--dry-run] [--with-checks]
// --dry-run performs only GETs and prints each planned write; a second real run prints "unchanged".
import { DEFAULT_LABELS, LABELS } from "./board.ts";
import {
  type Applier,
  createApplier,
  createRest,
  createRunner,
  isSubset,
  type Rest,
  repoName,
} from "./github.ts";

export const REQUIRED_CHECKS = [
  "Conventions",
  "Lint",
  "Typecheck",
  "Test",
  "Worker tests",
  "Build",
  "E2E",
];
export const TOPICS = ["url-shortener", "cloudflare-workers", "hono", "d1", "bun", "typescript"];

export const SETTINGS = {
  description: "dzajco: URL shortener on Cloudflare Workers (Hono, D1, Bun)",
  has_wiki: true,
  has_projects: true,
  allow_squash_merge: true,
  allow_merge_commit: true,
  allow_rebase_merge: false,
  allow_auto_merge: false,
  allow_update_branch: true,
  delete_branch_on_merge: true,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "BLANK",
  merge_commit_title: "PR_TITLE",
  merge_commit_message: "BLANK",
};

// The owner may merge their own PR without an approval (solo work), never push directly.
const BYPASS_ACTORS = [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" }];

function pullRequestRule(mergeMethod: "squash" | "merge") {
  return {
    type: "pull_request",
    parameters: {
      required_approving_review_count: 1,
      dismiss_stale_reviews_on_push: true,
      require_code_owner_review: false,
      require_last_push_approval: false,
      required_review_thread_resolution: true,
      allowed_merge_methods: [mergeMethod],
    },
  };
}

function checksRules(withChecks: boolean) {
  return withChecks
    ? [
        {
          type: "required_status_checks",
          parameters: {
            strict_required_status_checks_policy: false,
            required_status_checks: REQUIRED_CHECKS.map((context) => ({ context })),
          },
        },
      ]
    : [];
}

// "trunk" guards dev (squash, linear history); "release" guards the default branch (merge commit).
export function buildRulesets(withChecks: boolean) {
  const base = { target: "branch", enforcement: "active", bypass_actors: BYPASS_ACTORS };
  return [
    {
      ...base,
      name: "trunk",
      conditions: { ref_name: { include: ["refs/heads/dev"], exclude: [] } },
      rules: [
        { type: "deletion" },
        { type: "non_fast_forward" },
        { type: "required_linear_history" },
        pullRequestRule("squash"),
        ...checksRules(withChecks),
      ],
    },
    {
      ...base,
      name: "release",
      conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
      rules: [
        { type: "deletion" },
        { type: "non_fast_forward" },
        pullRequestRule("merge"),
        ...checksRules(withChecks),
      ],
    },
  ];
}

interface Label {
  name: string;
  color: string;
  description: string | null;
}

export async function setupRepo(
  rest: Rest,
  repo: string,
  apply: Applier,
  options: { withChecks: boolean },
): Promise<void> {
  const current = await rest.get<Record<string, unknown>>("");
  if (isSubset(SETTINGS, current)) apply.unchanged("repository settings");
  else await apply.change("repository settings", () => rest.write("PATCH", "", SETTINGS));

  const { names } = await rest.get<{ names: string[] }>("/topics");
  if (TOPICS.length === names.length && TOPICS.every((t) => names.includes(t))) {
    apply.unchanged(`topics: ${TOPICS.join(", ")}`);
  } else {
    await apply.change(`topics: ${TOPICS.join(", ")}`, () =>
      rest.write("PUT", "/topics", { names: TOPICS }),
    );
  }

  const autolinks = await rest.get<{ key_prefix: string }[]>("/autolinks");
  if (autolinks.some((a) => a.key_prefix === "DZAJ-")) apply.unchanged("autolink DZAJ-<n>");
  else {
    await apply.change("autolink DZAJ-<n> -> issue #<n>", () =>
      rest.write("POST", "/autolinks", {
        key_prefix: "DZAJ-",
        url_template: `https://github.com/${repo}/issues/<num>`,
        is_alphanumeric: false,
      }),
    );
  }

  const existing = new Map((await rest.list<Label>("/labels")).map((l) => [l.name, l]));
  for (const label of LABELS) {
    const found = existing.get(label.name);
    const path = `/labels/${encodeURIComponent(label.name)}`;
    if (!found)
      await apply.change(`label ${label.name}: create`, () => rest.write("POST", "/labels", label));
    else if (
      found.color.toLowerCase() !== label.color ||
      (found.description ?? "") !== label.description
    ) {
      await apply.change(`label ${label.name}: update`, () => rest.write("PATCH", path, label));
    } else apply.unchanged(`label ${label.name}`);
  }
  for (const name of DEFAULT_LABELS) {
    if (existing.has(name)) {
      await apply.change(`label ${name}: delete GitHub default`, () =>
        rest.write("DELETE", `/labels/${encodeURIComponent(name)}`),
      );
    }
  }

  if (await rest.exists("/vulnerability-alerts")) apply.unchanged("Dependabot alerts");
  else await apply.change("Dependabot alerts", () => rest.write("PUT", "/vulnerability-alerts"));

  const fixes = await rest
    .get<{ enabled?: boolean } | null>("/automated-security-fixes")
    .catch(() => null);
  if (fixes?.enabled) apply.unchanged("Dependabot security updates");
  else {
    await apply.change("Dependabot security updates", () =>
      rest.write("PUT", "/automated-security-fixes"),
    );
  }

  const rulesets = await rest.get<{ id: number; name: string }[]>("/rulesets");
  for (const ruleset of buildRulesets(options.withChecks)) {
    const found = rulesets.find((r) => r.name === ruleset.name);
    const detail = found && (await rest.get<unknown>(`/rulesets/${found.id}`));
    const what = `ruleset ${ruleset.name} (${options.withChecks ? "with" : "without"} required checks)`;
    if (found && isSubset(ruleset, detail)) apply.unchanged(what);
    else if (found)
      await apply.change(`${what}: update`, () =>
        rest.write("PUT", `/rulesets/${found.id}`, ruleset),
      );
    else await apply.change(`${what}: create`, () => rest.write("POST", "/rulesets", ruleset));
  }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const run = createRunner({ trace: Bun.env.GH_TRACE === "1" });
  const repo = await repoName(run);
  const apply = createApplier(dryRun);
  console.info(`${dryRun ? "Dry run: " : ""}repository ${repo}`);
  await setupRepo(createRest(run, repo), repo, apply, {
    withChecks: args.includes("--with-checks"),
  });
  console.info(
    `\n${apply.counts.unchanged} unchanged, ${apply.counts.changed} ${dryRun ? "planned" : "changed"}`,
  );
}
