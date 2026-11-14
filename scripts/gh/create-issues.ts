// Creates the GitHub issues of a roadmap phase from docs/ROADMAP.md. Run locally:
//   bun run gh:create-issues --phase 2 [--dry-run] [--roadmap docs/ROADMAP.md]
import { AREAS, type Area, getLabelTargets, PROJECT_TITLE, syncBoardItem } from "./board.ts";
import {
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
  repoName,
} from "./github.ts";

export interface RoadmapTask {
  /** `T9.0`, `T10b` */
  id: string;
  /** Issue number when the ID cell carries `(#n)`. */
  issue?: number;
  title: string;
  type: string;
  scope: string;
  area: Area;
  priority: string;
  size: string;
  deps: string[];
  criteria: string[];
  phase: number;
  phaseSummary: string;
}

const TASK_ID = /^T\d+(?:\.\d+)?[a-z]?$/;
const AREA_OF_SCOPE: Record<string, Area> = { ci: "infra", deps: "infra" };
const TYPE_LABEL: Record<string, string> = {
  feat: "type:feature",
  fix: "type:bug",
  docs: "type:docs",
};
const CELLS = 8;

const cellsOf = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** Parses every `## Phase N` table of the roadmap into tasks; throws on a malformed table. */
export function parseRoadmap(markdown: string): RoadmapTask[] {
  const tasks: RoadmapTask[] = [];
  const sections = markdown.split(/^## Phase (\d+)\s*$/m);
  for (let i = 1; i < sections.length; i += 2) {
    const phase = Number(sections[i]);
    const body = sections[i + 1] ?? "";
    const lines = body.split("\n");
    const header = lines.findIndex((l) => l.trim().startsWith("|"));
    if (header === -1) throw new Error(`Phase ${phase} has no task table`);
    const phaseSummary = lines.slice(0, header).join(" ").trim();
    const rows = lines.slice(header + 2).filter((l) => l.trim().startsWith("|"));
    for (const row of rows) {
      const cells = cellsOf(row);
      if (cells.length !== CELLS) {
        throw new Error(
          `Phase ${phase}: expected ${CELLS} cells, got ${cells.length} in "${row.slice(0, 60)}"`,
        );
      }
      const [idCell, title, type, scope, priority, size, deps, criteria] = cells as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      const idMatch = /^(\S+?)(?: \(#(\d+)\))?$/.exec(idCell);
      if (!idMatch || !TASK_ID.test(idMatch[1] as string))
        throw new Error(`Phase ${phase}: bad task ID "${idCell}"`);
      const area = AREA_OF_SCOPE[scope] ?? (scope as Area);
      if (!AREAS.includes(area)) throw new Error(`${idCell}: unknown scope "${scope}"`);
      if (!/^P[0-2]$/.test(priority)) throw new Error(`${idCell}: bad priority "${priority}"`);
      if (!/^[SML]$/.test(size)) throw new Error(`${idCell}: bad size "${size}"`);
      const depIds = deps === "-" ? [] : deps.split(",").map((d) => d.trim());
      const badDep = depIds.find((d) => !TASK_ID.test(d));
      if (badDep) throw new Error(`${idCell}: bad dependency "${badDep}"`);
      tasks.push({
        id: idMatch[1] as string,
        issue: idMatch[2] ? Number(idMatch[2]) : undefined,
        title,
        type,
        scope,
        area,
        priority,
        size,
        deps: depIds,
        criteria: criteria
          .split(";")
          .map((c) => c.trim())
          .filter(Boolean),
        phase,
        phaseSummary,
      });
    }
  }
  if (tasks.length === 0) throw new Error("No `## Phase N` task table found in the roadmap");
  return tasks;
}

export function labelsFor(task: RoadmapTask): string[] {
  const type = /\(spike\)/i.test(task.title)
    ? "type:spike"
    : (TYPE_LABEL[task.type] ?? "type:chore");
  return [type, `area:${task.area}`, `priority:${task.priority}`, `size:${task.size}`];
}

/** Issue body; `numbers` maps task IDs to issue numbers where known. */
export function issueBody(task: RoadmapTask, numbers: Map<string, number>): string {
  const ref = (id: string) => (numbers.has(id) ? `${id} (#${numbers.get(id)})` : id);
  return [
    "## Context",
    `Roadmap task ${task.id}, phase ${task.phase}.${task.phaseSummary ? ` ${task.phaseSummary}` : ""}`,
    "",
    "## Scope",
    `${task.title}. Commit type \`${task.type}\`, scope \`${task.scope}\`; priority ${task.priority}, size ${task.size}.`,
    "",
    "## Acceptance criteria",
    ...task.criteria.map((c) => `- [ ] ${c}`),
    "",
    "## Depends on",
    task.deps.length > 0 ? task.deps.map(ref).join(", ") : "None",
    "",
  ].join("\n");
}

interface IssueRow {
  number: number;
  node_id: string;
  title: string;
  pull_request?: unknown;
}

export interface CreateOptions {
  phase: number;
  dryRun: boolean;
}

/** Puts an issue on the board: Status Todo and the label fields, filling only what is missing. */
export type BoardSync = (
  issue: { number: number; nodeId: string },
  labels: string[],
) => Promise<void>;

/** Tasks ordered so that a dependency in the same batch comes first; a cycle keeps roadmap order. */
function inDependencyOrder(tasks: RoadmapTask[]): RoadmapTask[] {
  const ordered: RoadmapTask[] = [];
  let rest = tasks;
  while (rest.length > 0) {
    const ready = rest.filter((t) => !t.deps.some((d) => rest.some((r) => r.id === d && r !== t)));
    const next = ready.length > 0 ? ready : rest;
    ordered.push(...next);
    rest = rest.filter((t) => !next.includes(t));
  }
  return ordered;
}

/** Creates the missing issues of the phase (and repairs the board for existing ones); returns the new numbers. */
export async function createIssues(
  tasks: RoadmapTask[],
  rest: Rest,
  options: CreateOptions,
  board?: BoardSync,
  log: (line: string) => void = console.info,
): Promise<number[]> {
  const phaseTasks = tasks.filter((t) => t.phase === options.phase);
  if (phaseTasks.length === 0) throw new Error(`Phase ${options.phase} not found in the roadmap`);

  const existing = (await rest.list<IssueRow>("/issues?state=all")).filter((i) => !i.pull_request);
  const byTitle = new Map(existing.map((i) => [i.title, i]));
  const byNumber = new Map(existing.map((i) => [i.number, i]));
  const numbers = new Map<string, number>();
  for (const t of tasks) {
    const known = t.issue ?? byTitle.get(t.title)?.number;
    if (known) numbers.set(t.id, known);
  }

  const missing = phaseTasks.filter((t) => !numbers.has(t.id));
  for (const task of phaseTasks.filter((t) => numbers.has(t.id))) {
    const number = numbers.get(task.id) as number;
    log(`skip ${task.id}: issue #${number} already exists`);
    const issue = byNumber.get(number);
    if (board && issue && !options.dryRun) {
      await board({ number, nodeId: issue.node_id }, labelsFor(task));
    }
  }

  const created: number[] = [];
  /** Created before one of its in-batch dependencies had a number (dependency cycle). */
  const stale: { task: RoadmapTask; number: number }[] = [];
  for (const task of inDependencyOrder(missing)) {
    const labels = labelsFor(task);
    const deps =
      task.deps.length > 0
        ? task.deps.map((d) => (numbers.has(d) ? `${d} (#${numbers.get(d)})` : d)).join(", ")
        : "-";
    if (options.dryRun) {
      log(
        `would create ${task.id}: ${task.title}\n  labels: ${labels.join(", ")}\n  depends on: ${deps}\n  criteria: ${task.criteria.length}`,
      );
      continue;
    }
    const issue = await rest.write("POST", "/issues", {
      title: task.title,
      body: issueBody(task, numbers),
      labels,
    });
    numbers.set(task.id, issue.number);
    created.push(issue.number);
    if (task.deps.some((d) => missing.some((m) => m.id === d) && !numbers.has(d))) {
      stale.push({ task, number: issue.number });
    }
    log(`created ${task.id}: #${issue.number} ${task.title}`);
    await board?.({ number: issue.number, nodeId: issue.node_id }, labels);
  }
  for (const { task, number } of stale) {
    await rest.write("PATCH", `/issues/${number}`, { body: issueBody(task, numbers) });
    log(`updated ${task.id}: #${number} dependencies`);
  }
  return created;
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args[i + 1];
  };
  const dryRun = args.includes("--dry-run");
  const phase = Number(flag("--phase"));
  if (!Number.isInteger(phase) || phase < 1) {
    console.error("Usage: gh:create-issues --phase <n> [--dry-run] [--roadmap <path>]");
    process.exit(1);
  }
  const path = flag("--roadmap") ?? "docs/ROADMAP.md";
  const tasks = parseRoadmap(await Bun.file(path).text());

  const trace = Bun.env.GH_TRACE === "1";
  const run = createRunner({ trace });
  const fullName = await repoName(run);
  const owner = fullName.split("/")[0] as string;
  const rest = createRest(run, fullName);

  let board: Parameters<typeof createIssues>[3];
  if (dryRun) {
    console.info(
      `Dry run: each created issue would also join the "${PROJECT_TITLE}" board with Status Todo.`,
    );
  } else {
    const graphql: Graphql = createGraphql(await authToken(run).catch(exitWith), { trace });
    const number = await findProjectNumber(graphql, owner, PROJECT_TITLE);
    if (!number)
      throw new Error(`Project "${PROJECT_TITLE}" not found; run gh:setup-project first`);
    const project = await getProject(graphql, owner, number);
    const targets = await getLabelTargets(graphql, project.id);
    const ctx = {
      graphql,
      project,
      targets,
      items: await getBoardItems(graphql, project.id),
      apply: createApplier(false),
    };
    const todo = project.statusOptions.get("Todo");
    board = (issue, labels) => syncBoardItem(ctx, issue, labels, todo);
  }
  const created = await createIssues(tasks, rest, { phase, dryRun }, board);
  console.info(
    dryRun ? "\nDry run: nothing was written." : `\nCreated ${created.length} issue(s).`,
  );
}
