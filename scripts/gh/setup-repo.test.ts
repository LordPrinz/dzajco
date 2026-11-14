import { describe, expect, test } from "bun:test";
import { DEFAULT_LABELS, LABELS } from "./board.ts";
import { createApplier, createRest, type Runner } from "./github.ts";
import { buildRuleset, SETTINGS, setupRepo, TOPICS } from "./setup-repo.ts";

interface State {
  settings: Record<string, unknown>;
  topics: string[];
  autolinks: { key_prefix: string }[];
  labels: { name: string; color: string; description: string }[];
  alerts: boolean;
  fixes: boolean;
  rulesets: { id: number; name: string }[];
  ruleset: unknown;
}

const converged = (): State => ({
  settings: { ...SETTINGS, extra: 1 },
  topics: [...TOPICS],
  autolinks: [{ key_prefix: "DZAJ-" }],
  labels: LABELS.map((l) => ({ ...l, color: l.color.toUpperCase() })),
  alerts: true,
  fixes: true,
  rulesets: [{ id: 1, name: "trunk" }],
  ruleset: { ...buildRuleset(false), id: 1, source: "x" },
});
const fresh = (): State => ({
  settings: { description: "old", allow_auto_merge: true },
  topics: [],
  autolinks: [],
  labels: DEFAULT_LABELS.map((name) => ({ name, color: "ffffff", description: "" })),
  alerts: false,
  fixes: false,
  rulesets: [],
  ruleset: null,
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
    if (p === "/rulesets/1") return ok(state.ruleset);
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

describe("buildRuleset", () => {
  test("targets the default branch and v3.0, without checks unless asked", () => {
    const plain = buildRuleset(false);
    expect(plain.conditions.ref_name.include).toEqual(["~DEFAULT_BRANCH", "refs/heads/v3.0"]);
    expect(plain.rules.map((r) => r.type)).toEqual([
      "deletion",
      "non_fast_forward",
      "required_linear_history",
      "pull_request",
    ]);
    const checked = buildRuleset(true);
    const rule = checked.rules.at(-1) as {
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
  });

  test("keeps auto-merge off and squash only", () => {
    expect(SETTINGS).toMatchObject({
      allow_auto_merge: false,
      allow_squash_merge: true,
      allow_merge_commit: false,
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
    expect(out.some((l) => l.includes("ruleset trunk") && l.includes("create"))).toBe(true);
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
    expect(writes.some((c) => c.startsWith("POST /rulesets"))).toBe(true);
  });

  test("a converged repository reports unchanged and writes nothing", async () => {
    const { calls, out, apply } = await lines(false, converged());
    expect(calls.filter((c) => !c.startsWith("GET "))).toEqual([]);
    expect(apply.counts.changed).toBe(0);
    expect(out.every((l) => l.startsWith("unchanged: "))).toBe(true);
  });

  test("a changed ruleset is updated in place", async () => {
    const state = converged();
    state.ruleset = { ...(state.ruleset as object), rules: [] };
    const { calls } = await lines(false, state);
    expect(calls.filter((c) => c.startsWith("PUT /rulesets/1"))).toHaveLength(1);
  });
});
