import { describe, expect, test } from "bun:test";
import { DEFAULT_LABELS, LABELS } from "./board.ts";
import { createApplier, createRest, type Runner } from "./github.ts";
import { buildRulesets, SETTINGS, setupRepo, TOPICS } from "./setup-repo.ts";

interface State {
  settings: Record<string, unknown>;
  topics: string[];
  autolinks: { key_prefix: string }[];
  labels: { name: string; color: string; description: string }[];
  alerts: boolean;
  fixes: boolean;
  rulesets: { id: number; name: string }[];
  details: Record<number, unknown>;
}

const converged = (): State => ({
  settings: { ...SETTINGS, extra: 1 },
  topics: [...TOPICS],
  autolinks: [{ key_prefix: "DZAJ-" }],
  labels: LABELS.map((l) => ({ ...l, color: l.color.toUpperCase() })),
  alerts: true,
  fixes: true,
  rulesets: [
    { id: 1, name: "trunk" },
    { id: 2, name: "release" },
  ],
  details: Object.fromEntries(
    buildRulesets(false).map((r, i) => [i + 1, { ...r, id: i + 1, source: "x" }]),
  ),
});
const fresh = (): State => ({
  settings: { description: "old", allow_auto_merge: true },
  topics: [],
  autolinks: [],
  labels: DEFAULT_LABELS.map((name) => ({ name, color: "ffffff", description: "" })),
  alerts: false,
  fixes: false,
  rulesets: [],
  details: {},
});

function fakeRunner(state: State, calls: string[]): Runner {
  return async (args, stdin) => {
    const [, ...rest] = args;
    const isApi = args[0] === "api";
    if (!isApi) throw new Error(`unexpected gh ${args.join(" ")}`);
    const paginate = rest[0] === "--paginate";
    const method = paginate ? "GET" : (rest[1] as string);
    const path = (paginate ? rest[2] : rest[2]) as string;
    const p = path.replace("repos/acme/app", "").split("?")[0] as string;
    calls.push(`${method} ${p}${stdin ? ` ${stdin}` : ""}`);
    const ok = (v: unknown) => ({ code: 0, stdout: v === null ? "" : JSON.stringify(v) });
    if (method !== "GET") return ok(null);
    if (paginate) return ok([state.labels]);
    if (p === "") return ok(state.settings);
    if (p === "/topics") return ok({ names: state.topics });
    if (p === "/autolinks") return ok(state.autolinks);
    if (p === "/vulnerability-alerts") return state.alerts ? ok(null) : { code: 1, stdout: "" };
    if (p === "/automated-security-fixes") return ok({ enabled: state.fixes });
    if (p === "/rulesets") return ok(state.rulesets);
    const detail = /^\/rulesets\/(\d+)$/.exec(p);
    if (detail) return ok(state.details[Number(detail[1])]);
    throw new Error(`unexpected GET ${p}`);
  };
}

const lines = (dryRun: boolean, state: State, withChecks = false) => {
  const calls: string[] = [];
  const out: string[] = [];
  const apply = createApplier(dryRun, (l) => out.push(l));
  const run = fakeRunner(state, calls);
  return setupRepo(createRest(run, "acme/app"), "acme/app", apply, { withChecks }).then(() => ({
    calls,
    out,
    apply,
  }));
};

describe("buildRulesets", () => {
  test("trunk guards dev with squash and linear history, release guards the default branch with merge commits", () => {
    const [trunk, release] = buildRulesets(false) as [
      ReturnType<typeof buildRulesets>[number],
      ReturnType<typeof buildRulesets>[number],
    ];
    expect(trunk.name).toBe("trunk");
    expect(trunk.conditions.ref_name.include).toEqual(["refs/heads/dev"]);
    expect(trunk.rules.map((r) => r.type)).toEqual([
      "deletion",
      "non_fast_forward",
      "required_linear_history",
      "pull_request",
    ]);
    expect(release.name).toBe("release");
    expect(release.conditions.ref_name.include).toEqual(["~DEFAULT_BRANCH"]);
    expect(release.rules.map((r) => r.type)).toEqual([
      "deletion",
      "non_fast_forward",
      "pull_request",
    ]);
    const methods = (r: typeof trunk) =>
      (
        r.rules.find((x) => x.type === "pull_request") as {
          parameters: { allowed_merge_methods: string[] };
        }
      ).parameters.allowed_merge_methods;
    expect(methods(trunk)).toEqual(["squash"]);
    expect(methods(release)).toEqual(["merge"]);
    expect(release.bypass_actors).toEqual(trunk.bypass_actors);
  });

  test("adds the required checks to both rulesets when asked", () => {
    for (const ruleset of buildRulesets(true)) {
      const rule = ruleset.rules.at(-1) as {
        type: string;
        parameters: { required_status_checks: { context: string }[] };
      };
      expect(rule.type).toBe("required_status_checks");
      expect(rule.parameters.required_status_checks.map((c) => c.context)).toEqual([
        "Conventions",
        "Lint",
        "Typecheck",
        "Test",
        "Worker tests",
        "Build",
        "E2E",
      ]);
    }
  });

  test("keeps auto-merge off and allows squash and merge commits only", () => {
    expect(SETTINGS).toMatchObject({
      allow_auto_merge: false,
      allow_squash_merge: true,
      allow_merge_commit: true,
      merge_commit_title: "PR_TITLE",
      merge_commit_message: "BLANK",
      allow_rebase_merge: false,
    });
  });
});

describe("setupRepo", () => {
  test("a dry run on a fresh repository plans writes and performs none", async () => {
    const { calls, out } = await lines(true, fresh());
    expect(calls.filter((c) => !c.startsWith("GET "))).toEqual([]);
    expect(out.some((l) => l.startsWith("would change: repository settings"))).toBe(true);
    expect(out).toContain("would change: label bug: delete GitHub default");
    for (const name of ["trunk", "release"]) {
      expect(out.some((l) => l.includes(`ruleset ${name}`) && l.includes("create"))).toBe(true);
    }
  });

  test("a real run on a fresh repository writes everything", async () => {
    const { calls } = await lines(false, fresh());
    const writes = calls.filter((c) => !c.startsWith("GET "));
    expect(writes.some((c) => c.startsWith("PATCH  "))).toBe(true);
    expect(writes.some((c) => c.startsWith("PUT /topics"))).toBe(true);
    expect(writes.some((c) => c.startsWith("POST /autolinks"))).toBe(true);
    expect(writes.filter((c) => c.startsWith("POST /labels"))).toHaveLength(LABELS.length);
    expect(writes.filter((c) => c.startsWith("DELETE /labels"))).toHaveLength(
      DEFAULT_LABELS.length,
    );
    expect(writes.some((c) => c.startsWith("PUT /vulnerability-alerts"))).toBe(true);
    expect(writes.filter((c) => c.startsWith("POST /rulesets"))).toHaveLength(2);
  });

  test("a converged repository reports unchanged and writes nothing", async () => {
    const { calls, out, apply } = await lines(false, converged());
    expect(calls.filter((c) => !c.startsWith("GET "))).toEqual([]);
    expect(apply.counts.changed).toBe(0);
    expect(out.every((l) => l.startsWith("unchanged: "))).toBe(true);
  });

  test("a changed ruleset is updated in place by name", async () => {
    const state = converged();
    state.details[2] = { ...(state.details[2] as object), rules: [] };
    const { calls } = await lines(false, state);
    expect(calls.filter((c) => c.startsWith("PUT /rulesets/2"))).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith("PUT /rulesets/1"))).toHaveLength(0);
    expect(calls.filter((c) => c.startsWith("POST /rulesets"))).toHaveLength(0);
  });
});
