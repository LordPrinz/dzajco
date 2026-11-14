/** Whether the PR body already links issue `id` with one of GitHub's closing keywords ("Closes: #12", "fixes acme/app#12"). */
export const hasClosingKeyword = (body: string, id: string): boolean =>
  new RegExp(
    String.raw`\b(close[sd]?|fix(e[sd])?|resolve[sd]?):?\s+(?:[\w.-]+/[\w.-]+)?#${id}\b`,
    "i",
  ).test(body);

/** The body with "Closes #id" in it: the empty "Closes #" template line is filled, else a line is appended. */
export const withClosingKeyword = (body: string, id: string): string =>
  /^Closes #\s*$/m.test(body)
    ? body.replace(/^Closes #\s*$/m, `Closes #${id}`)
    : `${body}\n\nCloses #${id}`.trim();
