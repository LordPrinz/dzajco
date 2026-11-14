// Runs in GitHub Actions (see .github/workflows/project-sync.yml).
import { ticketFromBranch } from "../git/conventions.ts";
import { hasClosingKeyword, withClosingKeyword } from "./closing-keyword.ts";
import {
  closeIssue,
  createGraphql,
  ensureIssueItem,
  getProject,
  isIssueClosed,
  setSingleSelect,
} from "./github.ts";
import { type CreateEvent, handleEvent, type PullRequestEvent } from "./sync-events.ts";

const env = Bun.env;
if (!env.GITHUB_EVENT_PATH)
  throw new Error("GITHUB_EVENT_PATH is not set; run this inside GitHub Actions.");
const [owner, repo] = (env.GITHUB_REPOSITORY ?? "").split("/") as [string, string];
const token = env.GITHUB_TOKEN ?? "";
const event = JSON.parse(await Bun.file(env.GITHUB_EVENT_PATH).text()) as
  | CreateEvent
  | PullRequestEvent;

await handleEvent(env.GITHUB_EVENT_NAME ?? "", event, {
  linkPullRequest: ensureClosingKeyword,
  closeIssue: (issueNumber) => closeIssue(token, owner, repo, issueNumber),
  isIssueClosed: (issueNumber) => isIssueClosed(token, owner, repo, issueNumber),
  hasProjectsToken: Boolean(env.PROJECTS_TOKEN),
  async moveCard(issueNumber, status) {
    const graphql = createGraphql(env.PROJECTS_TOKEN ?? "");
    const project = await getProject(graphql, owner, Number(env.PROJECT_NUMBER));
    const optionId = project.statusOptions.get(status);
    if (!optionId) throw new Error(`Status option "${status}" missing on the board`);
    const itemId = await ensureIssueItem(graphql, project, owner, repo, issueNumber);
    if (!itemId) {
      console.warn(`Issue #${issueNumber} not found; skipping.`);
      return;
    }
    await setSingleSelect(graphql, project.id, itemId, project.statusFieldId, optionId);
    console.info(`#${issueNumber} → ${status}`);
  },
});

/** Adds "Closes #n" so merging the PR closes the issue (and the board moves it to Done). */
async function ensureClosingKeyword(prNumber: number, body: string, headRef: string) {
  const id = ticketFromBranch(headRef)?.slice("DZAJ-".length);
  if (!id || hasClosingKeyword(body, id)) return;
  const newBody = withClosingKeyword(body, id);
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ body: newBody }),
  });
  if (!res.ok) {
    // The board update does not depend on the link, so it carries on.
    console.warn(`Failed to update PR body: ${res.status} ${await res.text()}`);
    return;
  }
  console.info(`PR #${prNumber}: linked to #${id}`);
}
