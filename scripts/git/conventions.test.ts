import { describe, expect, test } from "bun:test";
import {
  GENERATED_HEADER,
  HEADER_PATTERN,
  isValidBranch,
  needsTicketPrefix,
  ticketFromBranch,
} from "./conventions.ts";

describe("titles and commit headers", () => {
  test.each([
    "[DZAJ-12] feat(api): Add x",
    "[DZAJ-44] chore: Set user permissions",
    "[DZAJ-1] fix(core)!: Reject duplicate names",
    "[DZAJ-120] refactor!: Drop legacy config",
    "[DZAJ-15] build(deps): Bump hono from 4.13.17 to 4.13.18",
    "[DZAJ-15] build(deps-dev): Bump wrangler from 4.1 to 4.2",
    "[DZAJ-15] ci(deps): Bump actions/checkout from 7.0.0 to 7.0.1",
    "[DZAJ-7] docs(docs): Explain the ADR flow",
    "[DZAJ-8] ci(ci): Add PR title check",
    "[DZAJ-1] feat: Łódź tram lines",
  ])("accepts %p", (header) => {
    expect(HEADER_PATTERN.test(header)).toBe(true);
  });

  test.each([
    "feat(api): Add x",
    "[DZAJ-12] feat(api): add x",
    "[JIRA-12] feat(api): Add x",
    "[DZAJ-12] feature(api): Add x",
    "[DZAJ-12] feat(unknown): Add x",
    "[DZAJ-12] feat(api):Add x",
    "[DZAJ-12]feat(api): Add x",
    "[DZAJ-x] feat(api): Add x",
    "[DZAJ-12] feat(API): Add x",
    "[DZAJ-1] feat: łódź tram lines",
  ])("rejects %p", (header) => {
    expect(HEADER_PATTERN.test(header)).toBe(false);
  });

  test("lets git-generated headers through", () => {
    expect(GENERATED_HEADER.test("Merge branch 'main' into DZAJ-4-x")).toBe(true);
    expect(GENERATED_HEADER.test('Revert "[DZAJ-4] feat: X"')).toBe(true);
    expect(GENERATED_HEADER.test("feat: X")).toBe(false);
  });
});

describe("branch names", () => {
  test.each([
    "DZAJ-5-x",
    "DZAJ-44-set-user-permissions",
    "DZAJ-120-add-v2-api",
    "main",
    "v3.0",
    "dependabot/bun/minor-and-patch-1a2b3c",
    "dependabot/github_actions/actions/checkout-7",
  ])("accepts %p", (branch) => {
    expect(isValidBranch(branch)).toBe(true);
  });

  test.each([
    "foo",
    "feature/login",
    "DZAJ-44",
    "DZAJ-44-Set-User",
    "DZAJ-x-thing",
    "dzaj-44-thing",
    "JIRA-44-thing",
    "dependabot-checkout",
  ])("rejects %p", (branch) => {
    expect(isValidBranch(branch)).toBe(false);
  });

  test("accepts trunk and Dependabot branches", () => {
    expect(isValidBranch("main")).toBe(true);
    expect(isValidBranch("v3.0")).toBe(true);
    expect(isValidBranch("dependabot/bun/hono-4.14.0")).toBe(true);
  });

  test("extracts the ticket from a branch", () => {
    expect(ticketFromBranch("DZAJ-44-set-user-permissions")).toBe("DZAJ-44");
    expect(ticketFromBranch("DZAJ-5-x")).toBe("DZAJ-5");
    expect(ticketFromBranch("main")).toBeUndefined();
    expect(ticketFromBranch("foo")).toBeUndefined();
  });
});

describe("ticket prefix", () => {
  test.each([
    "fixup! [DZAJ-5] feat: Add thing",
    "squash! [DZAJ-5] feat: Add thing",
    "amend! [DZAJ-5] feat: Add thing",
    "[DZAJ-9] fix: Other ticket",
    "[DZAJ-5] feat: Already tagged",
  ])("does not prefix %p", (message) => {
    expect(needsTicketPrefix(message)).toBe(false);
  });

  test("prefixes a normal message", () => {
    expect(needsTicketPrefix("feat(api): Add x")).toBe(true);
  });
});
