import { fail, isValidBranch } from "./conventions.ts";

const ZERO_SHA = /^0+$/;

/** Branch names a push would create or update, from git's pre-push stdin lines. */
export function pushedBranches(stdin: string): string[] {
  const branches: string[] = [];
  for (const line of stdin.split("\n")) {
    const [, localSha, remoteRef] = line.trim().split(/\s+/);
    if (!localSha || !remoteRef || ZERO_SHA.test(localSha)) continue;
    if (remoteRef.startsWith("refs/heads/")) branches.push(remoteRef.slice("refs/heads/".length));
  }
  return branches;
}

if (import.meta.main) {
  for (const branch of pushedBranches(await Bun.stdin.text())) {
    if (!isValidBranch(branch)) {
      fail([
        `Invalid branch name: "${branch}"`,
        "Expected: DZAJ-<number>-short-kebab-description (e.g. DZAJ-44-set-user-permissions)",
        "Rename it: git branch -m DZAJ-<number>-…",
      ]);
    }
  }
}
