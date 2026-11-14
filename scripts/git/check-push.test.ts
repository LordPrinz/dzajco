import { describe, expect, test } from "bun:test";
import { pushedBranches } from "./check-push.ts";

const SHA = "a".repeat(40);
const ZERO = "0".repeat(40);

describe("pushedBranches", () => {
  test("reads the remote branch of each pushed ref", () => {
    const stdin = `refs/heads/DZAJ-5-x ${SHA} refs/heads/DZAJ-5-x ${ZERO}\nrefs/heads/foo ${SHA} refs/heads/bar ${ZERO}\n`;
    expect(pushedBranches(stdin)).toEqual(["DZAJ-5-x", "bar"]);
  });

  test("skips deletions", () => {
    expect(pushedBranches(`(delete) ${ZERO} refs/heads/old ${SHA}\n`)).toEqual([]);
  });

  test("skips tags", () => {
    expect(pushedBranches(`refs/tags/v1 ${SHA} refs/tags/v1 ${ZERO}\n`)).toEqual([]);
  });

  test("handles empty input", () => {
    expect(pushedBranches("")).toEqual([]);
  });
});
