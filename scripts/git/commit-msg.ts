import {
  COMMIT_SCOPES,
  COMMIT_TYPES,
  fail,
  GENERATED_HEADER,
  HEADER_PATTERN,
} from "./conventions.ts";

const [messageFile] = Bun.argv.slice(2);
if (!messageFile) fail(["commit-msg: missing message file argument"]);

const header =
  (await Bun.file(messageFile).text())
    .split("\n")
    .find((line) => line.trim() !== "" && !line.startsWith("#")) ?? "";

if (!GENERATED_HEADER.test(header) && !HEADER_PATTERN.test(header)) {
  fail([
    `Invalid commit message: "${header}"`,
    "Expected: [DZAJ-<number>] <type>(<optional scope>)!: <Description>",
    `Types:    ${COMMIT_TYPES.join(", ")}`,
    `Scopes:   ${COMMIT_SCOPES.join(", ")}`,
    "Example:  [DZAJ-44] feat(api): Set user permissions",
    "Tip: commit from a branch named DZAJ-<number>-… and the prefix is added for you.",
  ]);
}
