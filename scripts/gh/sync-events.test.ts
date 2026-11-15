import { describe, expect, test } from "bun:test";
import { handleEvent, type PullRequestEvent, type SyncDeps } from "./sync-events.ts";

function fakeDeps(overrides: Partial<SyncDeps> = {}) {
  const calls: string[] = [];
  const deps: SyncDeps = {
    linkPullRequest: async (n, _body, branch) => void calls.push(`link ${n} ${branch}`),
    closeIssue: async (n) => void calls.push(`close ${n}`),
    isIssueClosed: async () => false,
    hasProjectsToken: true,
    moveCard: async (n, status) => void calls.push(`move ${n} ${status}`),
    ...overrides,
  };
  return { deps, calls };
}

const pr = (
  action: string,
  over: Partial<PullRequestEvent["pull_request"]> = {},
): PullRequestEvent => ({
  action,
  pull_request: {
    number: 9,
    draft: false,
    merged: false,
    base: { ref: "dev" },
    body: "",
    head: { ref: "DZAJ-7-thing", repo: { fork: false } },
    ...over,
  },
});

describe("handleEvent", () => {
  test("a new branch moves its issue to In Progress", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("create", { ref: "DZAJ-7-thing", ref_type: "branch" }, deps);
    expect(calls).toEqual(["move 7 In Progress"]);
  });

  test("a new tag is ignored", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("create", { ref: "DZAJ-7-thing", ref_type: "tag" }, deps);
    expect(calls).toEqual([]);
  });

  test("an opened PR is linked and moves to QA", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("pull_request", pr("opened"), deps);
    expect(calls).toEqual(["link 9 DZAJ-7-thing", "move 7 QA"]);
  });

  test("a PR made ready for review moves to QA", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("pull_request", pr("ready_for_review"), deps);
    expect(calls).toContain("move 7 QA");
  });

  test("an opened draft PR stays In Progress", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("pull_request", pr("opened", { draft: true }), deps);
    expect(calls).toContain("move 7 In Progress");
  });

  test("a closed issue is not dragged back to QA", async () => {
    const { deps, calls } = fakeDeps({ isIssueClosed: async () => true });
    await handleEvent("pull_request", pr("opened"), deps);
    expect(calls).toEqual(["link 9 DZAJ-7-thing"]);
  });

  test("a PR merged into dev closes the issue and moves it to Done", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("pull_request", pr("closed", { merged: true }), deps);
    expect(calls).toEqual(["close 7", "move 7 Done"]);
  });

  test("the issue is closed even when no board token is set", async () => {
    const { deps, calls } = fakeDeps({ hasProjectsToken: false });
    await handleEvent("pull_request", pr("closed", { merged: true }), deps);
    expect(calls).toEqual(["close 7"]);
  });

  test("a PR closed without merging does nothing", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("pull_request", pr("closed"), deps);
    expect(calls).toEqual([]);
  });

  test("a PR merged into another base does nothing", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("pull_request", pr("closed", { merged: true, base: { ref: "main" } }), deps);
    expect(calls).toEqual([]);
  });

  test("a fork PR does nothing", async () => {
    const { deps, calls } = fakeDeps();
    const head = { ref: "DZAJ-7-thing", repo: { fork: true } };
    await handleEvent("pull_request", pr("opened", { head }), deps);
    await handleEvent("pull_request", pr("closed", { head, merged: true }), deps);
    expect(calls).toEqual([]);
  });

  test("a PR whose head repo is gone does nothing", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent(
      "pull_request",
      pr("opened", { head: { ref: "DZAJ-7-thing", repo: null } }),
      deps,
    );
    expect(calls).toEqual([]);
  });

  test("a branch without a ticket does nothing", async () => {
    const { deps, calls } = fakeDeps();
    await handleEvent("create", { ref: "feature/x", ref_type: "branch" }, deps);
    await handleEvent(
      "pull_request",
      pr("closed", { merged: true, head: { ref: "feature/x", repo: { fork: false } } }),
      deps,
    );
    expect(calls).toEqual([]);
  });
});
