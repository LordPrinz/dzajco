import { describe, expect, test } from "bun:test";
import { BACKFILL, SELECT_FIELDS } from "./board.ts";
import { createApplier, createRest, type Graphql, type Runner, STATUS_OPTIONS } from "./github.ts";
import { README, SHORT_DESCRIPTION, setupProject } from "./setup-project.ts";

interface World {
  projectExists: boolean;
  /** Option names the Status field already has, with their ids. */
  statusOptions: [name: string, id: string][];
  withFields: boolean;
  matching: boolean;
  variable: string | null;
}

const converged = (): World => ({
  projectExists: true,
  statusOptions: STATUS_OPTIONS.map((s) => [s.name, `s-${s.name}`]),
  withFields: true,
  matching: true,
  variable: "4",
});
const fresh = (): World => ({
  projectExists: true,
  statusOptions: [["Todo", "s-Todo"]],
  withFields: false,
  matching: false,
  variable: null,
});

const labelsOf = (n: number) => (BACKFILL[n] ?? []).map((name) => ({ name }));

function fakeGraphql(world: World, log: string[], mutations: { query: string; vars: unknown }[]) {
  const fields = world.withFields
    ? [
        ...Object.entries(SELECT_FIELDS).map(([name, options]) => ({
          id: `f-${name}`,
          name,
          options: options.map((o) => ({ id: `o-${name}-${o.name}`, name: o.name })),
        })),
        { id: "f-Sprint", name: "Sprint" },
      ]
    : [];
  return (async (query: string, vars: unknown) => {
    if (/^\s*mutation\b/.test(query)) {
      log.push("graphql mutation");
      mutations.push({ query, vars });
      return { updateProjectV2Field: { projectV2Field: { options: [] } } };
    }
    log.push("graphql query");
    if (query.includes("repository(owner: $owner, name: $repo) { id owner")) {
      return { repository: { id: "R", owner: { id: "O" } } };
    }
    if (query.includes("projectsV2")) {
      const nodes = world.projectExists ? [{ number: 4, title: "Dzajco" }] : [];
      return { repositoryOwner: { projectsV2: { nodes } } };
    }
    if (query.includes("projectV2(number")) {
      const options = world.statusOptions.map(([name, id]) => ({ id, name }));
      const project = { id: "P", url: "https://example.test/p", field: { id: "S", options } };
      return { repositoryOwner: { projectV2: project } };
    }
    if (query.includes("shortDescription")) {
      return {
        node: {
          shortDescription: world.matching ? SHORT_DESCRIPTION : "",
          readme: world.matching ? README : "",
          public: false,
          repositories: { nodes: world.matching ? [{ id: "R" }] : [] },
        },
      };
    }
    if (query.includes("fields(first: 50)")) return { node: { fields: { nodes: fields } } };
    if (query.includes("items(first: 100")) {
      const values = world.matching
        ? [
            { optionId: "s-Todo", field: { id: "S" } },
            { optionId: "o-Area-Infra", field: { id: "f-Area" } },
            { optionId: "o-Priority-P0", field: { id: "f-Priority" } },
            { optionId: "o-Size-M", field: { id: "f-Size" } },
          ]
        : [];
      const nodes = world.matching
        ? [{ id: "I5", content: { number: 5 }, fieldValues: { nodes: values } }]
        : [];
      return { node: { items: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } };
    }
    throw new Error(`unexpected query ${query.slice(0, 40)}`);
  }) as unknown as Graphql;
}

function fakeRunner(world: World, log: string[]): Runner {
  return async (args) => {
    if (args[0] === "api") {
      const paginate = args.includes("--paginate");
      log.push(`rest ${paginate ? "GET" : args[2]}`);
      const issues = [{ number: 5, node_id: "N5", labels: world.matching ? labelsOf(5) : [] }];
      return { code: 0, stdout: JSON.stringify(paginate ? [issues] : issues) };
    }
    log.push(`gh ${args[0]} ${args[1]}`);
    if (args[0] === "variable" && args[1] === "get") {
      return world.variable === null
        ? { code: 1, stdout: "" }
        : { code: 0, stdout: `${world.variable}\n` };
    }
    return { code: 0, stdout: "" };
  };
}

const run = async (world: World, dryRun: boolean) => {
  const log: string[] = [];
  const mutations: { query: string; vars: unknown }[] = [];
  const out: string[] = [];
  const apply = createApplier(dryRun, (l) => out.push(l));
  const runner = fakeRunner(world, log);
  const graphql = fakeGraphql(world, log, mutations);
  const guarded = (async (query: string, vars?: Record<string, unknown>) => {
    if (dryRun && /^\s*mutation\b/.test(query)) throw new Error("write attempted in a dry run");
    return graphql(query, vars);
  }) as Graphql;
  await setupProject({
    graphql: guarded,
    rest: createRest(runner, "acme/app"),
    run: runner,
    owner: "acme",
    repo: "app",
    apply,
  });
  return { out, apply, log, mutations };
};

describe("setupProject dry run", () => {
  test("plans the project and every follow-up step when the project is missing", async () => {
    const { out, log } = await run({ ...fresh(), projectExists: false }, true);
    expect(out).toContain('would change: project "Dzajco": create');
    expect(out.some((l) => l.startsWith("would change: field Area: create"))).toBe(true);
    expect(out).toContain("would change: field Sprint: create (8 x 14 days from 2026-11-09)");
    expect(out.some((l) => l.startsWith("would change: #3: add labels"))).toBe(true);
    expect(out.some((l) => l.startsWith("would change: #7: add labels"))).toBe(true);
    expect(out).toContain("would change: repository variable PROJECT_NUMBER");
    expect(log).not.toContain("graphql mutation");
  });

  test("on an existing project it plans changes and makes only reads", async () => {
    const { out, apply, log } = await run(fresh(), true);
    expect(log).not.toContain("graphql mutation");
    const writes = log.filter(
      (l) =>
        (l.startsWith("rest ") && l !== "rest GET") ||
        (l.startsWith("gh ") && l !== "gh variable get"),
    );
    expect(writes).toEqual([]);
    expect(out).toContain("would change: field Area: create");
    expect(out).toContain(
      "would change: #5: add labels type:chore, area:infra, priority:P0, size:M",
    );
    expect(out).toContain("would change: #5: add to the board");
    expect(out).toContain("would change: repository variable PROJECT_NUMBER=4");
    expect(apply.counts.changed).toBeGreaterThan(5);
  });
});

describe("setupProject real run", () => {
  test("a second run on a converged project reports everything unchanged", async () => {
    const { out, apply, log, mutations } = await run(converged(), false);
    expect(mutations).toEqual([]);
    expect(log.filter((l) => l.startsWith("rest ") && l !== "rest GET")).toEqual([]);
    expect(log.filter((l) => l === "gh variable set")).toEqual([]);
    expect(apply.counts.changed).toBe(0);
    expect(out.every((l) => l.startsWith("unchanged: ") || l.startsWith("\nBoard"))).toBe(true);
  });

  test("keeps the ids of existing Status options when it adds the missing ones", async () => {
    const { mutations } = await run(
      {
        ...converged(),
        statusOptions: [
          ["Todo", "s-Todo"],
          ["Done", "s-Done"],
        ],
      },
      false,
    );
    const update = mutations.find((m) => m.query.includes("updateProjectV2Field"));
    const options = ((update ?? { vars: {} }).vars as { options: { id?: string; name: string }[] })
      .options;
    expect(options.map((o) => o.name)).toEqual(STATUS_OPTIONS.map((o) => o.name));
    expect(options.find((o) => o.name === "Todo")?.id).toBe("s-Todo");
    expect(options.find((o) => o.name === "Done")?.id).toBe("s-Done");
    expect(options.find((o) => o.name === "QA")?.id).toBeUndefined();
  });

  test("does not touch Status when all options exist", async () => {
    const { mutations } = await run(converged(), false);
    expect(mutations.some((m) => m.query.includes("updateProjectV2Field"))).toBe(false);
  });
});
