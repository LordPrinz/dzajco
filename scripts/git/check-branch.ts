import { currentBranch, fail, isValidBranch } from "./conventions.ts";

const branch = Bun.argv[2] ?? (await currentBranch());
if (!isValidBranch(branch)) {
  fail([
    `Invalid branch name: "${branch}"`,
    "Expected: DZAJ-<number>-short-kebab-description (e.g. DZAJ-44-set-user-permissions)",
    "Create it from the issue: gh issue develop <number> --name DZAJ-<number>-… --checkout",
  ]);
}
