// Creates and wires the project board, labels the phase 1 issues and puts open issues on the board.
// Run locally after `gh auth refresh -s project`:
//   bun run gh:setup-project [--dry-run]
// --dry-run performs only reads and prints each planned write; a second real run prints "unchanged".
import {
  BACKFILL,
  type FieldTarget,
  getLabelTargets,
  PROJECT_TITLE,
  SELECT_FIELDS,
  syncBoardItem,
} from "./board.ts";
import {
  type Applier,
  authToken,
  createApplier,
  createGraphql,
  createRest,
  createRunner,
  exitWith,
  findProjectNumber,
  type Graphql,
  getBoardItems,
  getProject,
  type Rest,
  type Runner,
  repoName,
  STATUS_OPTIONS,
} from "./github.ts";

const SPRINT_START = "2026-11-09";
const SPRINT_DAYS = 14;
const SPRINT_COUNT = 8;
export const SHORT_DESCRIPTION = "Dzajco: tasks, bugs and research spikes";

interface ExistingOption {
  id: string;
  name: string;
  color?: string;
  description?: string;
}

export const README = `## Workflow
Backlog → Todo → In Progress → QA → Done

- Every task is a GitHub issue (no drafts): \`DZAJ-<n>\` = issue \`#<n>\`.
- Branch \`DZAJ-<n>-short-description\` (issue → "Create a branch", or \`gh issue develop\`).
- Commit / PR title: \`[DZAJ-<n>] type(scope): Description\`, added automatically from the branch name.
- Pushing the branch → **In Progress**, opening a PR → **QA**, merging → **Done**.
- QA = code review and manual check; 1 approval required.

See CONTRIBUTING.md in the repository for roles and conventions.`;

interface Deps {
  graphql: Graphql;
  rest: Rest;
  run: Runner;
  owner: string;
  repo: string;
  apply: Applier;
}

interface IssueRef {
  number: number;
  node_id: string;
  pull_request?: unknown;
  labels: { name: string }[];
}

/** Dry run on a project that does not exist yet: everything after its creation, from the static config. */
async function planFollowUps(apply: Applier): Promise<void> {
  const noop = async () => {};
  await apply.change("project description, readme and repository link", noop);
  await apply.change(`status options: ${STATUS_OPTIONS.map((s) => s.name).join(" -> ")}`, noop);
  for (const [name, options] of Object.entries(SELECT_FIELDS)) {
    await apply.change(`field ${name}: create (${options.map((o) => o.name).join(", ")})`, noop);
  }
  await apply.change(
    `field Sprint: create (${SPRINT_COUNT} x ${SPRINT_DAYS} days from ${SPRINT_START})`,
    noop,
  );
  for (const [number, labels] of Object.entries(BACKFILL)) {
    await apply.change(
      `#${number}: add labels ${labels.join(", ")}, add to the board with Todo`,
      noop,
    );
  }
  await apply.change("repository variable PROJECT_NUMBER", noop);
}

export async function setupProject(deps: Deps): Promise<string[]> {
  const { graphql, rest, run, owner, repo, apply } = deps;
  const manual: string[] = [];

  // --- 1. Project ---
  const ids = await graphql<{ repository: { id: string; owner: { id: string } } }>(
    `query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) { id owner { id } }
    }`,
    { owner, repo },
  );
  let number = await findProjectNumber(graphql, owner, PROJECT_TITLE);
  if (number) {
    apply.unchanged(`project "${PROJECT_TITLE}" (#${number})`);
  } else {
    await apply.change(`project "${PROJECT_TITLE}": create`, async () => {
      const created = await graphql<{ createProjectV2: { projectV2: { number: number } } }>(
        `mutation($ownerId: ID!, $repositoryId: ID!, $title: String!) {
          createProjectV2(input: { ownerId: $ownerId, repositoryId: $repositoryId, title: $title }) {
            projectV2 { number }
          }
        }`,
        { ownerId: ids.repository.owner.id, repositoryId: ids.repository.id, title: PROJECT_TITLE },
      );
      number = created.createProjectV2.projectV2.number;
    });
  }
  if (!number) {
    await planFollowUps(apply);
    return manual;
  }

  let project = await getProject(graphql, owner, number);
  const meta = await graphql<{
    node: {
      shortDescription: string | null;
      readme: string | null;
      public: boolean;
      repositories: { nodes: { id: string }[] };
    };
  }>(
    `query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          shortDescription readme public
          repositories(first: 20) { nodes { id } }
        }
      }
    }`,
    { projectId: project.id },
  );
  const { node } = meta;
  if (
    node.shortDescription === SHORT_DESCRIPTION &&
    (node.readme ?? "").trim() === README.trim() &&
    !node.public
  ) {
    apply.unchanged("project description and readme");
  } else {
    await apply.change("project description and readme", () =>
      graphql(
        `mutation($projectId: ID!, $description: String!, $readme: String!) {
          updateProjectV2(input: {
            projectId: $projectId, shortDescription: $description, public: false, readme: $readme
          }) { projectV2 { id } }
        }`,
        { projectId: project.id, description: SHORT_DESCRIPTION, readme: README },
      ),
    );
  }
  if (node.repositories.nodes.some((r) => r.id === ids.repository.id)) {
    apply.unchanged("project linked to the repository");
  } else {
    await apply.change("link project to the repository", () =>
      graphql(
        `mutation($projectId: ID!, $repositoryId: ID!) {
          linkProjectV2ToRepository(input: { projectId: $projectId, repositoryId: $repositoryId }) {
            repository { id }
          }
        }`,
        { projectId: project.id, repositoryId: ids.repository.id },
      ),
    );
  }

  // --- 2. Status columns ---
  const wantedStatuses = STATUS_OPTIONS.map((s) => s.name);
  if (wantedStatuses.every((s) => project.statusOptions.has(s))) {
    apply.unchanged(`status options: ${wantedStatuses.join(", ")}`);
  } else {
    // Options that already exist keep their id, so cards set to them stay in their column.
    const statusInputs = STATUS_OPTIONS.map((o) => {
      const id = project.statusOptions.get(o.name);
      return id ? { id, ...o } : { ...o };
    });
    await apply
      .change(`status options: ${wantedStatuses.join(" -> ")}`, async () => {
        await graphql(
          `mutation($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
            updateProjectV2Field(input: { fieldId: $fieldId, singleSelectOptions: $options }) {
              projectV2Field { ... on ProjectV2SingleSelectField { id } }
            }
          }`,
          { fieldId: project.statusFieldId, options: statusInputs },
        );
        project = await getProject(graphql, owner, number as number);
      })
      .catch((error: unknown) => {
        manual.push(
          `Status field: set options to ${wantedStatuses.join(", ")} (API refused: ${(error as Error).message})`,
        );
      });
  }

  // --- 3. Custom fields ---
  const existingFields = await graphql<{
    node: { fields: { nodes: { id: string; name: string; options?: ExistingOption[] }[] } };
  }>(
    `query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2FieldCommon { id name }
              ... on ProjectV2SingleSelectField { options { id name color description } }
            }
          }
        }
      }
    }`,
    { projectId: project.id },
  );
  const fieldByName = new Map(existingFields.node.fields.nodes.map((f) => [f.name, f]));

  for (const [name, options] of Object.entries(SELECT_FIELDS)) {
    const field = fieldByName.get(name);
    const inputs = options.map(({ name, color, description }) => ({ name, color, description }));
    if (!field) {
      await apply.change(`field ${name}: create`, () =>
        graphql(
          `mutation($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
            createProjectV2Field(input: {
              projectId: $projectId, dataType: SINGLE_SELECT, name: $name, singleSelectOptions: $options
            }) { projectV2Field { ... on ProjectV2SingleSelectField { id } } }
          }`,
          { projectId: project.id, name, options: inputs },
        ),
      );
      continue;
    }
    const existing = field.options ?? [];
    const missing = inputs.filter((o) => !existing.some((e) => e.name === o.name));
    if (missing.length === 0) {
      apply.unchanged(`field ${name}`);
      continue;
    }
    // Keep every existing option (including hand-added ones) with its id so items set to them survive.
    await apply
      .change(`field ${name}: add options ${missing.map((o) => o.name).join(", ")}`, async () => {
        const updated = await graphql<{
          updateProjectV2Field: { projectV2Field: { options: { id: string }[] } };
        }>(
          `mutation($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
            updateProjectV2Field(input: { fieldId: $fieldId, singleSelectOptions: $options }) {
              projectV2Field { ... on ProjectV2SingleSelectField { options { id name } } }
            }
          }`,
          {
            fieldId: field.id,
            options: [
              ...existing.map(({ id, name, color, description }) => ({
                id,
                name,
                color,
                description,
              })),
              ...missing,
            ],
          },
        );
        const after = updated.updateProjectV2Field.projectV2Field.options;
        const lost = existing.filter((e) => !after.some((o) => o.id === e.id));
        if (lost.length > 0) {
          console.warn(
            `WARNING: field ${name} lost option ids for ${lost.map((o) => o.name).join(", ")}; items set to them were cleared, run gh:setup-project again to restore`,
          );
        }
      })
      .catch((error: unknown) => {
        manual.push(
          `Field ${name}: add options ${missing.map((o) => o.name).join(", ")} (API refused: ${(error as Error).message})`,
        );
      });
  }

  if (fieldByName.has("Sprint")) apply.unchanged("field Sprint");
  else {
    const iterations = Array.from({ length: SPRINT_COUNT }, (_, i) => {
      const start = new Date(`${SPRINT_START}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() + i * SPRINT_DAYS);
      return {
        title: `Sprint ${i + 1}`,
        startDate: start.toISOString().slice(0, 10),
        duration: SPRINT_DAYS,
      };
    });
    await apply
      .change(
        `field Sprint: create (${SPRINT_COUNT} x ${SPRINT_DAYS} days from ${SPRINT_START})`,
        () =>
          graphql(
            `mutation($projectId: ID!, $config: ProjectV2IterationFieldConfigurationInput!) {
            createProjectV2Field(input: {
              projectId: $projectId, dataType: ITERATION, name: "Sprint", iterationConfiguration: $config
            }) { projectV2Field { ... on ProjectV2IterationField { id } } }
          }`,
            {
              projectId: project.id,
              config: { startDate: SPRINT_START, duration: SPRINT_DAYS, iterations },
            },
          ),
      )
      .catch((error: unknown) => {
        manual.push(
          `Add an Iteration field "Sprint": ${SPRINT_DAYS}-day sprints starting ${SPRINT_START} (API refused: ${(error as Error).message})`,
        );
      });
  }

  // --- 4. Issues: labels, board items, field values ---
  const labelTargets: Map<string, FieldTarget> = await getLabelTargets(graphql, project.id);
  const ctx = {
    graphql,
    project,
    targets: labelTargets,
    items: await getBoardItems(graphql, project.id),
    apply,
  };
  const issues = (await rest.list<IssueRef>("/issues?state=open")).filter((i) => !i.pull_request);
  const todoId = project.statusOptions.get("Todo");
  const backlogId = project.statusOptions.get("Backlog");

  for (const issue of issues) {
    const wanted = BACKFILL[issue.number] ?? [];
    const have = new Set(issue.labels.map((l) => l.name));
    const missing = wanted.filter((l) => !have.has(l));
    if (missing.length > 0) {
      await apply.change(`#${issue.number}: add labels ${missing.join(", ")}`, () =>
        rest.write("POST", `/issues/${issue.number}/labels`, { labels: missing }),
      );
      for (const l of missing) have.add(l);
    }

    await syncBoardItem(
      ctx,
      { number: issue.number, nodeId: issue.node_id },
      have,
      BACKFILL[issue.number] ? todoId : backlogId,
    );
  }

  // --- 5. Wire the repository ---
  const variable = await run(["variable", "get", "PROJECT_NUMBER", "--repo", `${owner}/${repo}`]);
  if (variable.code === 0 && variable.stdout.trim() === String(number)) {
    apply.unchanged(`repository variable PROJECT_NUMBER=${number}`);
  } else {
    await apply.change(`repository variable PROJECT_NUMBER=${number}`, () =>
      run([
        "variable",
        "set",
        "PROJECT_NUMBER",
        "--body",
        String(number),
        "--repo",
        `${owner}/${repo}`,
      ]),
    );
  }

  manual.push(
    "Views: switch the default view to Board (columns = Status); add a Table view grouped by Assignees and a Roadmap view by Sprint.",
    "Workflows (... > Workflows): enable Auto-add to project (is:issue), Item added -> Backlog, Item reopened -> Todo, Item closed -> Done, Pull request merged -> Done, Code changes requested -> In Progress, Auto-close issue (Done).",
    "Repository secret PROJECTS_TOKEN: a classic PAT with only the `project` scope (gh secret set PROJECTS_TOKEN).",
  );
  console.info(`\nBoard: ${project.url}`);
  return manual;
}

if (import.meta.main) {
  const dryRun = Bun.argv.includes("--dry-run");
  const trace = Bun.env.GH_TRACE === "1";
  const run = createRunner({ trace });
  const token = await authToken(run).catch(exitWith);
  const fullName = await repoName(run);
  const [owner, repo] = fullName.split("/") as [string, string];
  const apply = createApplier(dryRun);
  console.info(`${dryRun ? "Dry run: " : ""}project ${PROJECT_TITLE} for ${fullName}`);
  const manual = await setupProject({
    graphql: createGraphql(token, { readOnly: dryRun, trace }),
    rest: createRest(run, fullName),
    run,
    owner,
    repo,
    apply,
  });
  console.info(
    `\n${apply.counts.unchanged} unchanged, ${apply.counts.changed} ${dryRun ? "planned" : "changed"}`,
  );
  if (manual.length > 0)
    console.info(`\nFinish in the browser:\n${manual.map((m) => `  • ${m}`).join("\n")}`);
}
