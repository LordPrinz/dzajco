import { fail, HEADER_PATTERN } from "./conventions.ts";

const title = Bun.env.PR_TITLE ?? Bun.argv[2] ?? "";
if (!HEADER_PATTERN.test(title)) {
  fail([
    `Invalid PR title: "${title}"`,
    "Expected: [DZAJ-<number>] <type>(<optional scope>)!: <Description>",
    "The PR title becomes the squash commit on the trunk branch.",
  ]);
}
console.info(`PR title OK: ${title}`);
