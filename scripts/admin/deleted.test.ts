import { describe, expect, it } from "bun:test";
import {
  buildSql,
  type DeletedRow,
  formatCountries,
  formatList,
  formatOne,
  type MainDeps,
  main,
  parseArgs,
  parseRows,
  wranglerArgs,
} from "./deleted";

const ROW: DeletedRow = {
  id: "abc",
  target: "https://example.com/a",
  expires_at: null,
  created_at: Date.parse("2026-11-01T10:00:00Z"),
  is_custom: 1,
  deleted_at: Date.parse("2026-11-14T08:30:00Z"),
  visits: 6,
  countries: JSON.stringify([
    { code: "PL", visits: 5 },
    { code: "DE", visits: 1 },
  ]),
};

describe("parseArgs", () => {
  it("lists by default and takes one id", () => {
    expect(parseArgs(["--local"])).toEqual({
      id: null,
      local: true,
      env: null,
      limit: 50,
      dryRun: false,
    });
    expect(parseArgs(["abc", "--remote", "--env", "dev", "--dry-run"])).toEqual({
      id: "abc",
      local: false,
      env: "dev",
      limit: 50,
      dryRun: true,
    });
    expect(parseArgs(["--local", "--env", "my_env-2", "--limit", "10"]).limit).toBe(10);
  });
  it("rejects bad usage", () => {
    expect(() => parseArgs([])).toThrow();
    expect(() => parseArgs(["--local", "--remote"])).toThrow();
    expect(() => parseArgs(["a", "b", "--local"])).toThrow();
    expect(() => parseArgs(["a/b", "--local"])).toThrow();
    expect(() => parseArgs(["--local", "--env"])).toThrow();
    expect(() => parseArgs(["--local", "--env", "dev; rm"])).toThrow();
    expect(() => parseArgs(["--local", "--env", "--remote"])).toThrow();
    expect(() => parseArgs(["--local", "--env", "-x"])).toThrow();
    expect(() => parseArgs(["abc", "--local", "--limit", "10"])).toThrow("--limit");
    expect(() => parseArgs(["--local", "--limit", "0"])).toThrow();
    expect(() => parseArgs(["--local", "--limit", "1001"])).toThrow();
    expect(() => parseArgs(["--local", "--limit", "2.5"])).toThrow();
    expect(() => parseArgs(["--local", "--bogus"])).toThrow();
  });
});

describe("buildSql", () => {
  it("lists newest first with a limit", () => {
    expect(buildSql({ id: null, limit: 5 })).toBe(
      "SELECT id, target, expires_at, created_at, is_custom, deleted_at, visits, countries FROM deleted_links ORDER BY deleted_at DESC LIMIT 5;",
    );
  });
  it("escapes the id", () => {
    expect(buildSql({ id: "x'y", limit: 5 })).toContain("WHERE id = 'x''y' ORDER BY");
  });
});

describe("wranglerArgs", () => {
  it("asks for JSON and passes --env only when given", () => {
    expect(wranglerArgs("SELECT 1;", false, null)).toEqual([
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--json",
      "--command",
      "SELECT 1;",
    ]);
    expect(wranglerArgs("SELECT 1;", true, "dev")).toEqual([
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--local",
      "--env",
      "dev",
      "--json",
      "--command",
      "SELECT 1;",
    ]);
  });
});

describe("parseRows", () => {
  it("reads the results of the first statement", () => {
    expect(parseRows(JSON.stringify([{ results: [ROW], success: true }]))).toEqual([ROW]);
  });
  it("throws on anything else", () => {
    expect(() => parseRows("{}")).toThrow();
    expect(() => parseRows("[]")).toThrow();
    expect(() => parseRows("not json")).toThrow();
  });
});

describe("formatting", () => {
  it("formats the country summary and falls back to the raw text", () => {
    expect(formatCountries(ROW.countries)).toBe("PL 5, DE 1");
    expect(formatCountries("[]")).toBe("");
    expect(formatCountries("oops")).toBe("oops");
    const unsorted = JSON.stringify([
      { code: "DE", visits: 1 },
      { code: "US", visits: 5 },
      { code: "FR", visits: 5 },
    ]);
    expect(formatCountries(unsorted)).toBe("FR 5, US 5, DE 1");
  });
  it("lists one line per row", () => {
    expect(formatList([ROW])).toBe(
      "1 deleted link, newest first:\n2026-11-14T08:30:00.000Z  abc  6 visits  https://example.com/a",
    );
    expect(formatList([ROW, ROW]).split("\n")[0]).toBe("2 deleted links, newest first:");
    expect(formatList([])).toBe("No deleted links in the archive.");
  });
  it("prints every archived copy of one id", () => {
    expect(formatOne("abc", [ROW])).toBe(
      [
        "id:       abc",
        "target:   https://example.com/a",
        "custom:   yes",
        "created:  2026-11-01T10:00:00.000Z",
        "expires:  never",
        "deleted:  2026-11-14T08:30:00.000Z",
        "visits:   6 (PL 5, DE 1)",
      ].join("\n"),
    );
    const plain = { ...ROW, is_custom: 0, expires_at: ROW.deleted_at, visits: 0, countries: "[]" };
    const text = formatOne("abc", [ROW, plain]);
    expect(text.split("\n\n")).toHaveLength(2);
    expect(text).toContain("custom:   no");
    expect(text).toContain("expires:  2026-11-14T08:30:00.000Z");
    expect(text).toMatch(/visits: {3}0$/);
    expect(formatOne("abc", [])).toBe("No deleted link with id abc in the archive.");
  });
  it("replaces control characters so stored text cannot drive the terminal", () => {
    const hostile = { ...ROW, target: "https://example.com/\u001b[2J" };
    expect(formatList([hostile])).not.toContain("\u001b");
    expect(formatOne("abc", [hostile])).toContain("https://example.com/?[2J");
    const bidi = { ...ROW, target: "https://example.com/\u202egnp.exe\u200b" };
    expect(formatList([bidi])).toContain("https://example.com/?gnp.exe?");
  });
});

function deps(overrides: Partial<MainDeps> = {}) {
  const calls: string[][] = [];
  const out: string[] = [];
  const err: string[] = [];
  const d: MainDeps = {
    run: async (c) => {
      calls.push(c);
      return { code: 0, stdout: JSON.stringify([{ results: [ROW] }]) };
    },
    log: (l) => out.push(l),
    error: (l) => err.push(l),
    wrangler: "/w/wrangler",
    exists: () => true,
    ...overrides,
  };
  return { d, calls, out, err };
}

describe("main", () => {
  it("--dry-run prints SQL and never runs wrangler", async () => {
    const t = deps();
    expect(await main(["--remote", "--dry-run"], t.d)).toBe(0);
    expect(t.calls).toHaveLength(0);
    expect(t.out[0]).toContain("FROM deleted_links");
  });
  it("--help prints usage and exits 0", async () => {
    const t = deps();
    expect(await main(["--help"], t.d)).toBe(0);
    expect(t.out[0]).toContain("admin:deleted [id]");
  });
  it("usage errors exit 2", async () => {
    const t = deps();
    expect(await main([], t.d)).toBe(2);
    expect(t.calls).toHaveLength(0);
  });
  it("lists or shows one id through the project's wrangler", async () => {
    const list = deps();
    expect(await main(["--remote", "--env", "dev"], list.d)).toBe(0);
    expect(list.calls[0]?.slice(0, 8)).toEqual([
      "/w/wrangler",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--env",
      "dev",
      "--json",
    ]);
    expect(list.out[0]).toStartWith("1 deleted link");
    const one = deps();
    expect(await main(["abc", "--local"], one.d)).toBe(0);
    expect(one.out[0]).toStartWith("id:       abc");
  });
  it("passes on a wrangler failure and reports bad output", async () => {
    const failing = deps({ run: async () => ({ code: 3, stdout: "" }) });
    expect(await main(["--local"], failing.d)).toBe(3);
    expect(failing.err).toEqual([]);
    const stdout = '{\n  "error": "no such table: deleted_links \u001b[0m"\n}\n';
    const reported = deps({ run: async () => ({ code: 1, stdout }) });
    expect(await main(["--local"], reported.d)).toBe(1);
    expect(reported.err).toEqual(['{\n  "error": "no such table: deleted_links ?[0m"\n}']);
    const garbled = deps({ run: async () => ({ code: 0, stdout: "nope" }) });
    expect(await main(["--local"], garbled.d)).toBe(1);
    expect(garbled.err.join()).toContain("Could not");
    const missing = deps({ exists: () => false });
    expect(await main(["--local"], missing.d)).toBe(1);
    expect(missing.err.join()).toContain("wrangler not found");
  });
});
