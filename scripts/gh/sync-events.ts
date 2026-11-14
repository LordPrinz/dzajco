import { TRUNK, ticketFromBranch } from "../git/conventions.ts";
import type { StatusName } from "./github.ts";

export interface CreateEvent {
  ref: string;
  ref_type: "branch" | "tag";
}
export interface PullRequestEvent {
  action: string;
  pull_request: {
    number: number;
    draft: boolean;
    merged?: boolean;
    base?: { ref: string };
    body: string | null;
    head: { ref: string; repo: { fork: boolean } | null };
  };
}

/** Side effects of a sync, injected so the event rules can be tested without the network. */
export interface SyncDeps {
  linkPullRequest(prNumber: number, body: string, branch: string): Promise<void>;
  closeIssue(issueNumber: number): Promise<void>;
  isIssueClosed(issueNumber: number): Promise<boolean>;
  hasProjectsToken: boolean;
  moveCard(issueNumber: number, status: StatusName): Promise<void>;
}

/** Applies one `create` or `pull_request` event: link the PR, close the issue on merge, move the card. */
export async function handleEvent(
  eventName: string,
  event: CreateEvent | PullRequestEvent,
  deps: SyncDeps,
): Promise<void> {
  let branch: string;
  let status: StatusName;
  let done = false;
  if (eventName === "create") {
    const e = event as CreateEvent;
    if (e.ref_type !== "branch") return;
    branch = e.ref;
    status = "In Progress";
  } else {
    const { action, pull_request: pr } = event as PullRequestEvent;
    // Fork PRs get a read-only token and could name any ticket; their issue link is added by hand.
    if (!pr.head.repo || pr.head.repo.fork) return;
    branch = pr.head.ref;
    status = pr.draft ? "In Progress" : "QA";
    if (action === "closed") {
      // Only a merge into the trunk finishes the ticket; a plain close leaves the card alone.
      if (!pr.merged || pr.base?.ref !== TRUNK) return;
      status = "Done";
      done = true;
    } else {
      await deps
        .linkPullRequest(pr.number, pr.body ?? "", branch)
        .catch((error: unknown) => console.warn("Could not link the PR to its issue:", error));
    }
  }

  const ticket = ticketFromBranch(branch);
  if (!ticket) {
    console.info(`Branch "${branch}" has no ticket, nothing to sync.`);
    return;
  }
  const issueNumber = Number(ticket.slice("DZAJ-".length));

  // "Closes #n" does not fire for merges into a non-default branch, so the issue is closed here.
  if (done) await deps.closeIssue(issueNumber);

  if (!deps.hasProjectsToken) {
    console.warn("PROJECTS_TOKEN secret is not set; skipping board update.");
    return;
  }
  if (!done && (await deps.isIssueClosed(issueNumber))) {
    console.info(`Issue #${issueNumber} is closed; leaving its card where the board put it.`);
    return;
  }
  await deps.moveCard(issueNumber, status);
}
