/** Minimal GitHub GraphQL/REST client shared by the project scripts. */

export const STATUS_OPTIONS = [
  { name: "Backlog", color: "GRAY", description: "Not planned for the current sprint" },
  { name: "Todo", color: "BLUE", description: "Planned for the current sprint" },
  { name: "In Progress", color: "YELLOW", description: "Branch pushed, work ongoing" },
  { name: "QA", color: "PURPLE", description: "PR open: code review and manual testing" },
  { name: "Done", color: "GREEN", description: "Merged to the trunk branch" },
] as const;
export type StatusName = (typeof STATUS_OPTIONS)[number]["name"];

export interface ClientOptions {
  /** Refuse GraphQL mutations; the dry run must never write. */
  readOnly?: boolean;
  /** Print every call to stderr (set GH_TRACE=1). */
  trace?: boolean;
}

export function createGraphql(token: string, options: ClientOptions = {}) {
  return async function graphql<T>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const isMutation = /^\s*mutation\b/.test(query);
    if (options.trace) console.error(`[graphql] ${isMutation ? "mutation" : "query"}`);
    if (isMutation && options.readOnly) throw new Error("Refusing a GraphQL mutation in a dry run");
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    // A gateway error answers with HTML; without the catch its SyntaxError would hide the status.
    const body = (await res.json().catch(() => ({}))) as {
      data?: T;
      errors?: { message: string }[];
    };
    if (!res.ok || body.errors?.length) {
      throw new Error(
        body.errors?.map((e) => e.message).join("; ") ?? `GraphQL HTTP ${res.status}`,
      );
    }
    return body.data as T;
  };
}
export type Graphql = ReturnType<typeof createGraphql>;

export interface ProjectInfo {
  id: string;
  url: string;
  statusFieldId: string;
  statusOptions: Map<string, string>;
}

const PROJECT_FIELDS = `
  id
  url
  field(name: "Status") {
    ... on ProjectV2SingleSelectField { id options { id name } }
  }
`;

export async function getProject(
  graphql: Graphql,
  owner: string,
  number: number,
): Promise<ProjectInfo> {
  type Project = {
    id: string;
    url: string;
    field: { id: string; options: { id: string; name: string }[] } | null;
  };
  const data = await graphql<{
    repositoryOwner: { projectV2?: Project | null } | null;
  }>(
    `query($owner: String!, $number: Int!) {
      repositoryOwner(login: $owner) {
        ... on User { projectV2(number: $number) { ${PROJECT_FIELDS} } }
        ... on Organization { projectV2(number: $number) { ${PROJECT_FIELDS} } }
      }
    }`,
    { owner, number },
  );
  const project = data.repositoryOwner?.projectV2;
  if (!project?.field)
    throw new Error(`Project #${number} of ${owner} not found or has no Status field`);
  return {
    id: project.id,
    url: project.url,
    statusFieldId: project.field.id,
    statusOptions: new Map(project.field.options.map((o) => [o.name, o.id])),
  };
}

/** Returns the project item for an issue, adding the issue to the project if needed. */
export async function ensureIssueItem(
  graphql: Graphql,
  project: ProjectInfo,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<string | undefined> {
  const data = await graphql<{
    repository: {
      issue: {
        id: string;
        projectItems: { nodes: { id: string; project: { id: string } }[] };
      } | null;
    };
  }>(
    `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
          projectItems(first: 20) { nodes { id project { id } } }
        }
      }
    }`,
    { owner, repo, number: issueNumber },
  );
  const issue = data.repository.issue;
  if (!issue) return undefined;

  const existing = issue.projectItems.nodes.find((item) => item.project.id === project.id);
  if (existing) return existing.id;

  const added = await graphql<{ addProjectV2ItemById: { item: { id: string } } }>(
    `mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
    }`,
    { projectId: project.id, contentId: issue.id },
  );
  return added.addProjectV2ItemById.item.id;
}

export async function setSingleSelect(
  graphql: Graphql,
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
): Promise<void> {
  await graphql(
    `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
        value: { singleSelectOptionId: $optionId }
      }) { projectV2Item { id } }
    }`,
    { projectId, itemId, fieldId, optionId },
  );
}

/**
 * A closed issue is finished work: its board card is already in Done, and the sync run (which starts
 * before a quick merge and ends after it) must not drag it back to QA or In Progress.
 */
export async function isIssueClosed(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const res = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    },
  );
  if (!res.ok)
    throw new Error(`Failed to read issue #${issueNumber}: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { state: string }).state === "closed";
}

/** Result of one `gh` invocation. */
export interface GhResult {
  code: number;
  stdout: string;
}
/** Runs `gh` with the given arguments; tests replace it with a fake. */
export type Runner = (args: string[], stdin?: string) => Promise<GhResult>;

export function createRunner(options: ClientOptions = {}): Runner {
  return async (args, stdin) => {
    if (options.trace) console.error(`[gh] ${args.join(" ")}`);
    const proc = Bun.spawn(["gh", ...args], {
      stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    return { code, stdout };
  };
}

/** REST access to `repos/<repo>/...` through the runner. */
export function createRest(run: Runner, repo: string) {
  const call = async (method: string, path: string, body?: unknown) => {
    const args = ["api", "-X", method, `repos/${repo}${path}`];
    if (body !== undefined) args.push("--input", "-");
    return run(args, body === undefined ? undefined : JSON.stringify(body));
  };
  return {
    async get<T>(path: string): Promise<T> {
      const res = await call("GET", path);
      if (res.code !== 0) throw new Error(`GET ${path} failed`);
      return (res.stdout ? JSON.parse(res.stdout) : null) as T;
    },
    /** True when the endpoint answers 2xx (for the 204/404 style toggles). */
    async exists(path: string): Promise<boolean> {
      return (await call("GET", path)).code === 0;
    },
    async write(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown) {
      const res = await call(method, path, body);
      if (res.code !== 0) throw new Error(`${method} ${path} failed`);
      return res.stdout ? JSON.parse(res.stdout) : null;
    },
    /** Every item of a paginated list. */
    async list<T>(path: string): Promise<T[]> {
      const sep = path.includes("?") ? "&" : "?";
      const res = await run([
        "api",
        "--paginate",
        "--slurp",
        `repos/${repo}${path}${sep}per_page=100`,
      ]);
      if (res.code !== 0) throw new Error(`GET ${path} failed`);
      return (JSON.parse(res.stdout) as T[][]).flat();
    },
  };
}
export type Rest = ReturnType<typeof createRest>;

export async function repoName(run: Runner): Promise<string> {
  const res = await run(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  if (res.code !== 0) throw new Error("Could not resolve the repository (gh repo view failed)");
  return res.stdout.trim();
}

/** Reports each item as unchanged, planned (dry run) or changed; the writes go through `change`. */
export function createApplier(dryRun: boolean, log: (line: string) => void = console.info) {
  const counts = { unchanged: 0, changed: 0 };
  return {
    counts,
    unchanged(what: string) {
      counts.unchanged++;
      log(`unchanged: ${what}`);
    },
    async change(what: string, write: () => Promise<unknown>) {
      counts.changed++;
      if (dryRun) {
        log(`would change: ${what}`);
        return;
      }
      await write();
      log(`changed: ${what}`);
    },
  };
}
export type Applier = ReturnType<typeof createApplier>;

/** True when every key of `expected` is present in `actual` with an equal value (arrays in any order). */
export function isSubset(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected !== "object") return expected === actual;
  if (actual === null || typeof actual !== "object") return false;
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((e) => actual.some((a) => isSubset(e, a)))
    );
  }
  return Object.entries(expected).every(([k, v]) =>
    isSubset(v, (actual as Record<string, unknown>)[k]),
  );
}

export interface BoardItem {
  id: string;
  /** field id → option id for the single-select fields */
  values: Map<string, string>;
}

/** Project items that are issues, keyed by issue number. */
export async function getBoardItems(
  graphql: Graphql,
  projectId: string,
): Promise<Map<number, BoardItem>> {
  const items = new Map<number, BoardItem>();
  for (let cursor: string | null = null; ; ) {
    const page: {
      node: {
        items: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            id: string;
            content: { number?: number } | null;
            fieldValues: { nodes: { optionId?: string; field?: { id: string } }[] };
          }[];
        };
      };
    } = await graphql(
      `query($projectId: ID!, $cursor: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                content { ... on Issue { number } }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      optionId
                      field { ... on ProjectV2FieldCommon { id } }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { projectId, cursor },
    );
    for (const item of page.node.items.nodes) {
      if (item.content?.number === undefined) continue;
      const values = new Map<string, string>();
      for (const v of item.fieldValues.nodes)
        if (v.optionId && v.field) values.set(v.field.id, v.optionId);
      items.set(item.content.number, { id: item.id, values });
    }
    if (!page.node.items.pageInfo.hasNextPage) return items;
    cursor = page.node.items.pageInfo.endCursor;
  }
}

/** Number of the owner's project with this title, if any. */
export async function findProjectNumber(
  graphql: Graphql,
  owner: string,
  title: string,
): Promise<number | undefined> {
  const found = await graphql<{
    repositoryOwner: { projectsV2?: { nodes: { number: number; title: string }[] } } | null;
  }>(
    `query($owner: String!, $title: String!) {
      repositoryOwner(login: $owner) {
        ... on User { projectsV2(first: 20, query: $title) { nodes { number title } } }
        ... on Organization { projectsV2(first: 20, query: $title) { nodes { number title } } }
      }
    }`,
    { owner, title },
  );
  return found.repositoryOwner?.projectsV2?.nodes.find((p) => p.title === title)?.number;
}

/** The token `gh` is logged in with; fails with a clear message when there is none. */
export async function authToken(run: Runner): Promise<string> {
  const res = await run(["auth", "token"]);
  const token = res.stdout.trim();
  if (res.code !== 0 || !token) throw new Error("No GitHub token: run `gh auth login` first");
  return token;
}

/** Prints the error message (no stack) and exits 1; for `.catch` on the top-level setup. */
export function exitWith(error: unknown): never {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
