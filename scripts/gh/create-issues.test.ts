import { describe, expect, test } from "bun:test";
import {
  createIssues,
  issueBody,
  labelsFor,
  parseRoadmap,
  type RoadmapTask,
} from "./create-issues.ts";
import type { Rest } from "./github.ts";

const HEAD =
  "| ID | Title | Type | Scope/Area | Priority | Size | Depends on | Acceptance criteria |\n| --- | --- | --- | --- | --- | --- | --- | --- |";
const doc = (...rows: string[]) =>
  `# Roadmap\n\n## Phase 1\n\nFoundation.\n\n${HEAD}\n${rows.join("\n")}\n`;

describe("parseRoadmap", () => {
  test("parses a row into a task", () => {
    const [task] = parseRoadmap(
      doc("| T6 | URL policy | feat | core | P0 | M | T1 | First; Second |"),
    );
    expect(task).toMatchObject({
      id: "T6",
      title: "URL policy",
      type: "feat",
      area: "core",
      priority: "P0",
      size: "M",
      deps: ["T1"],
      criteria: ["First", "Second"],
      phase: 1,
      phaseSummary: "Foundation.",
    });
  });

  test("reads the issue number and dotted and lettered IDs", () => {
    const tasks = parseRoadmap(
      doc(
        "| T1 (#3) | A | chore | infra | P0 | M | - | x |",
        "| T9.0 | B (spike) | chore | infra | P0 | S | T1 | x |",
        "| T9b | C | feat | api | P0 | M | T9a, T10b | x |",
      ),
    );
    expect(tasks.map((t) => [t.id, t.issue])).toEqual([
      ["T1", 3],
      ["T9.0", undefined],
      ["T9b", undefined],
    ]);
    expect(tasks[0]?.deps).toEqual([]);
    expect(tasks[2]?.deps).toEqual(["T9a", "T10b"]);
  });

  test("maps ci, deps and docs scopes to areas", () => {
    const tasks = parseRoadmap(
      doc(
        "| T1 | A | ci | ci | P0 | S | - | x |",
        "| T2 | B | build | deps | P0 | S | - | x |",
        "| T3 | C | docs | docs | P1 | S | - | x |",
      ),
    );
    expect(tasks.map((t) => t.area)).toEqual(["infra", "infra", "docs"]);
  });

  test("rejects a row without 8 cells", () => {
    expect(() => parseRoadmap(doc("| T1 | A | chore | infra | P0 | M | - |"))).toThrow(
      "expected 8 cells",
    );
  });

  test("rejects a phase without a table and a document without phases", () => {
    expect(() => parseRoadmap("## Phase 1\n\nText only.\n")).toThrow("no task table");
    expect(() => parseRoadmap("# Roadmap\n")).toThrow("No `## Phase N`");
  });

  test.each([
    ["| X1 | A | chore | infra | P0 | M | - | x |", "bad task ID"],
    ["| T1 | A | chore | nope | P0 | M | - | x |", "unknown scope"],
    ["| T1 | A | chore | infra | P9 | M | - | x |", "bad priority"],
    ["| T1 | A | chore | infra | P0 | XL | - | x |", "bad size"],
    ["| T1 | A | chore | infra | P0 | M | foo | x |", "bad dependency"],
  ])("rejects %p", (row, message) => {
    expect(() => parseRoadmap(doc(row))).toThrow(message);
  });

  test("parses the real roadmap fixture", async () => {
    const tasks = parseRoadmap(await Bun.file(`${import.meta.dir}/fixtures/roadmap.md`).text());
    expect(tasks.length).toBeGreaterThan(15);
    const phase2 = tasks.filter((t) => t.phase === 2);
    expect(phase2.map((t) => t.id)).toEqual(["T6", "T7", "T8"]);
    expect(tasks.find((t) => t.id === "T9b")?.deps).toEqual(["T9a", "T10b"]);
    expect(tasks.find((t) => t.id === "T4")?.area).toBe("infra");
  });
});

describe("labelsFor", () => {
  test("maps type, area, priority and size", () => {
    const [feat, spike, test_] = parseRoadmap(
      doc(
        "| T1 | A | feat | core | P0 | M | - | x |",
        "| T2 | B (spike) | chore | infra | P1 | S | - | x |",
        "| T3 | C | test | web | P2 | L | - | x |",
      ),
    );
    expect(labelsFor(feat as RoadmapTask)).toEqual([
      "type:feature",
      "area:core",
      "priority:P0",
      "size:M",
    ]);
    expect(labelsFor(spike as RoadmapTask)).toEqual([
      "type:spike",
      "area:infra",
      "priority:P1",
      "size:S",
    ]);
    expect(labelsFor(test_ as RoadmapTask)).toEqual([
      "type:chore",
      "area:web",
      "priority:P2",
      "size:L",
    ]);
  });
});

describe("issueBody", () => {
  test("has the four sections, one checkbox per criterion and mapped dependencies", () => {
    const [task] = parseRoadmap(doc("| T8 | Q | feat | db | P0 | M | T6, T7 | One; Two |"));
    const body = issueBody(task as RoadmapTask, new Map([["T6", 11]]));
    expect(body).toContain("## Context");
    expect(body).toContain("## Scope");
    expect(body).toContain("- [ ] One\n- [ ] Two");
    expect(body).toContain("## Depends on\nT6 (#11), T7");
  });
});

describe("createIssues", () => {
  const tasks = parseRoadmap(
    `${doc("| T1 (#3) | Done already | chore | infra | P0 | M | - | x |")}\n## Phase 2\n\nData.\n\n${HEAD}\n| T6 | New one | feat | core | P0 | M | T1 | a |\n| T7 | Exists by title | feat | core | P0 | S | - | b |\n`,
  );
  const fakeRest = (writes: unknown[]) =>
    ({
      list: async () => [
        { number: 9, node_id: "N9", title: "Exists by title" },
        { number: 10, title: "A PR", pull_request: {} },
      ],
      write: async (method: string, path: string, body: unknown) => {
        writes.push([method, path, body]);
        return { number: 12, node_id: "N12" };
      },
    }) as unknown as Rest;

  test("dry run reports and writes nothing", async () => {
    const writes: unknown[] = [];
    const lines: string[] = [];
    const created = await createIssues(
      tasks,
      fakeRest(writes),
      { phase: 2, dryRun: true },
      undefined,
      (l) => lines.push(l),
    );
    expect(created).toEqual([]);
    expect(writes).toEqual([]);
    expect(lines.join("\n")).toContain("would create T6");
    expect(lines.join("\n")).toContain("depends on: T1 (#3)");
    expect(lines.join("\n")).toContain("skip T7: issue #9 already exists");
  });

  test("creates only the missing issue, with labels, and hands it to the board", async () => {
    const writes: unknown[][] = [];
    const onBoard: string[] = [];
    const created = await createIssues(
      tasks,
      fakeRest(writes),
      { phase: 2, dryRun: false },
      async (i, labels) => {
        onBoard.push(`${i.number}:${i.nodeId}:${labels.length}`);
      },
      () => {},
    );
    expect(created).toEqual([12]);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.slice(0, 2)).toEqual(["POST", "/issues"]);
    expect(((writes[0] ?? [])[2] as { labels: string[] }).labels).toEqual([
      "type:feature",
      "area:core",
      "priority:P0",
      "size:M",
    ]);
    // T7 already exists by title: its board item is repaired; T6 is new.
    expect(onBoard).toEqual(["9:N9:4", "12:N12:4"]);
  });

  test("fails for a phase that is not in the roadmap", async () => {
    await expect(createIssues(tasks, fakeRest([]), { phase: 7, dryRun: true })).rejects.toThrow(
      "Phase 7 not found",
    );
  });

  const counting = (writes: unknown[][]) => {
    let next = 20;
    return {
      list: async () => [],
      write: async (method: string, path: string, body: unknown) => {
        writes.push([method, path, body]);
        return method === "POST" ? { number: next++, node_id: `N${next}` } : null;
      },
    } as unknown as Rest;
  };

  test("creates in dependency order so a forward dependency gets its number", async () => {
    const roadmap = parseRoadmap(await Bun.file(`${import.meta.dir}/fixtures/roadmap.md`).text());
    const writes: unknown[][] = [];
    await createIssues(roadmap, counting(writes), { phase: 3, dryRun: false }, undefined, () => {});
    const posts = writes
      .filter((w) => w[0] === "POST")
      .map((w) => w[2] as { title: string; body: string });
    const titles = posts.map((p) => p.title);
    expect(titles.indexOf("Analytics Engine sink, SQL source, rollup cron")).toBeLessThan(
      titles.indexOf("Delete, stats, global stats"),
    );
    const t10b = 20 + titles.indexOf("Analytics Engine sink, SQL source, rollup cron");
    const t9b = posts.find((p) => p.title === "Delete, stats, global stats");
    expect(t9b?.body).toContain(`T10b (#${t10b})`);
    expect(writes.some((w) => w[0] === "PATCH")).toBe(false);
  });

  test("patches the body of an issue created before its cyclic dependency", async () => {
    const cyclic = parseRoadmap(
      doc(
        "| T1 | A | feat | core | P0 | S | T2 | x |",
        "| T2 | B | feat | core | P0 | S | T1 | x |",
      ),
    );
    const writes: unknown[][] = [];
    await createIssues(cyclic, counting(writes), { phase: 1, dryRun: false }, undefined, () => {});
    const patches = writes.filter((w) => w[0] === "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0]?.[1]).toBe("/issues/20");
    expect(((patches[0] ?? [])[2] as { body: string }).body).toContain("T2 (#21)");
  });
});
