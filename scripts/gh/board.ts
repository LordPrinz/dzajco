/** Labels, board fields and the label → field mapping shared by the setup and issue scripts. */
import {
  type Applier,
  type BoardItem,
  type Graphql,
  type ProjectInfo,
  setSingleSelect,
} from "./github.ts";

export const PROJECT_TITLE = "Dzajco";

export const AREAS = ["core", "web", "api", "db", "stats", "ui", "infra", "docs"] as const;
export type Area = (typeof AREAS)[number];

export const LABELS = [
  { name: "type:feature", color: "1d76db", description: "New functionality" },
  { name: "type:bug", color: "d73a4a", description: "Something is broken" },
  { name: "type:chore", color: "c5def5", description: "Tooling, config, maintenance" },
  { name: "type:spike", color: "fbca04", description: "Time-boxed research / experiment" },
  { name: "type:docs", color: "0075ca", description: "Documentation" },
  { name: "area:core", color: "5319e7", description: "Domain logic: ids, URL policy, secrets" },
  { name: "area:web", color: "0e8a16", description: "Redirect path and pages" },
  { name: "area:api", color: "b60205", description: "REST API v1" },
  { name: "area:db", color: "f9a8d4", description: "D1 schema and queries" },
  { name: "area:stats", color: "1abc9c", description: "Visit analytics and rollups" },
  { name: "area:ui", color: "fef2c0", description: "Server-rendered UI" },
  { name: "area:infra", color: "e99695", description: "CI/CD, deployment, tooling" },
  { name: "area:docs", color: "bfdadc", description: "DESIGN.md, ADRs" },
  { name: "priority:P0", color: "b60205", description: "Blocks other work" },
  { name: "priority:P1", color: "fbca04", description: "Needed this sprint" },
  { name: "priority:P2", color: "c2e0c6", description: "Nice to have" },
  { name: "size:S", color: "ededed", description: "Up to half a day" },
  { name: "size:M", color: "d4c5f9", description: "1-2 days" },
  { name: "size:L", color: "f9d0c4", description: "More than 2 days, consider splitting" },
] as const;

/** GitHub's default labels; replaced by the prefixed ones above. */
export const DEFAULT_LABELS = [
  "bug",
  "documentation",
  "duplicate",
  "enhancement",
  "good first issue",
  "help wanted",
  "invalid",
  "question",
  "wontfix",
] as const;

export type Color = "GRAY" | "BLUE" | "GREEN" | "YELLOW" | "ORANGE" | "RED" | "PINK" | "PURPLE";
export interface Option {
  name: string;
  color: Color;
  description: string;
  /** Issue label that maps to this option. */
  label: string;
}

const areaOption = (name: string, area: Area, color: Color): Option => {
  const description = LABELS.find((l) => l.name === `area:${area}`)?.description ?? "";
  return { name, color, description, label: `area:${area}` };
};

export const SELECT_FIELDS: Record<string, Option[]> = {
  Area: [
    areaOption("Core", "core", "PURPLE"),
    areaOption("Web", "web", "GREEN"),
    areaOption("API", "api", "RED"),
    areaOption("DB", "db", "PINK"),
    areaOption("Stats", "stats", "BLUE"),
    areaOption("UI", "ui", "YELLOW"),
    areaOption("Infra", "infra", "ORANGE"),
    areaOption("Docs", "docs", "GRAY"),
  ],
  Priority: [
    { name: "P0", color: "RED", description: "Blocks other work", label: "priority:P0" },
    { name: "P1", color: "YELLOW", description: "Needed this sprint", label: "priority:P1" },
    { name: "P2", color: "GRAY", description: "Nice to have", label: "priority:P2" },
  ],
  Size: [
    { name: "S", color: "GREEN", description: "Up to half a day", label: "size:S" },
    { name: "M", color: "YELLOW", description: "1-2 days", label: "size:M" },
    {
      name: "L",
      color: "RED",
      description: "More than 2 days, consider splitting",
      label: "size:L",
    },
  ],
};

/** Labels for the phase 1 issues, which were created by hand before the labels existed. */
export const BACKFILL: Record<number, string[]> = {
  3: ["type:chore", "area:infra", "priority:P0", "size:M"],
  4: ["type:chore", "area:infra", "priority:P0", "size:M"],
  5: ["type:chore", "area:infra", "priority:P0", "size:M"],
  6: ["type:chore", "area:infra", "priority:P0", "size:S"],
  7: ["type:docs", "area:docs", "priority:P1", "size:S"],
};

export interface FieldTarget {
  fieldId: string;
  optionId: string;
}

/** label → board field option, for the fields that exist on the project. */
export async function getLabelTargets(
  graphql: Graphql,
  projectId: string,
): Promise<Map<string, FieldTarget>> {
  const data = await graphql<{
    node: {
      fields: { nodes: { id?: string; name?: string; options?: { id: string; name: string }[] }[] };
    };
  }>(
    `query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2FieldCommon { id name }
              ... on ProjectV2SingleSelectField { options { id name } }
            }
          }
        }
      }
    }`,
    { projectId },
  );
  const targets = new Map<string, FieldTarget>();
  for (const field of data.node.fields.nodes) {
    const options = field.name ? SELECT_FIELDS[field.name] : undefined;
    if (!field.id || !options) continue;
    for (const option of options) {
      const optionId = field.options?.find((o) => o.name === option.name)?.id;
      if (optionId) targets.set(option.label, { fieldId: field.id, optionId });
    }
  }
  return targets;
}

/** One option per field: when several labels map to the same field, the first label in sort order wins. */
export function pickTargets(
  labels: Iterable<string>,
  targets: Map<string, FieldTarget>,
): [label: string, target: FieldTarget][] {
  const byField = new Map<string, [string, FieldTarget]>();
  for (const label of [...labels].sort()) {
    const target = targets.get(label);
    if (target && !byField.has(target.fieldId)) byField.set(target.fieldId, [label, target]);
  }
  return [...byField.values()];
}

export interface BoardContext {
  graphql: Graphql;
  project: ProjectInfo;
  targets: Map<string, FieldTarget>;
  /** Board items by issue number; updated when an item is added. */
  items: Map<number, BoardItem>;
  apply: Applier;
}

/**
 * Puts an issue on the board and fills its Status (only when empty) and the fields its labels map to
 * (only when they differ). Under a dry-run applier it reports the planned steps and writes nothing.
 */
export async function syncBoardItem(
  ctx: BoardContext,
  issue: { number: number; nodeId: string },
  labels: Iterable<string>,
  statusOptionId: string | undefined,
): Promise<void> {
  const { graphql, project, targets, items, apply } = ctx;
  let item = items.get(issue.number);
  if (item) apply.unchanged(`#${issue.number}: on the board`);
  else {
    await apply.change(`#${issue.number}: add to the board`, async () => {
      const added = await graphql<{ addProjectV2ItemById: { item: { id: string } } }>(
        `mutation($projectId: ID!, $contentId: ID!) {
          addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
        }`,
        { projectId: project.id, contentId: issue.nodeId },
      );
      item = { id: added.addProjectV2ItemById.item.id, values: new Map() };
      items.set(issue.number, item);
    });
  }

  const wanted: [string, FieldTarget][] = pickTargets(labels, targets);
  if (statusOptionId) {
    wanted.unshift(["Status", { fieldId: project.statusFieldId, optionId: statusOptionId }]);
  }
  for (const [what, target] of wanted) {
    const current = item?.values.get(target.fieldId);
    // An existing Status is kept so a re-run cannot drag In Progress or QA back.
    if (current && (what === "Status" || current === target.optionId)) continue;
    const boardItem = item;
    await apply.change(`#${issue.number}: set ${what}`, async () => {
      if (boardItem) {
        await setSingleSelect(graphql, project.id, boardItem.id, target.fieldId, target.optionId);
      }
    });
  }
}
