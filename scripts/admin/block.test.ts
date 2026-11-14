import { describe, expect, it } from "bun:test";
import {
  buildSql,
  CACHE_NOTE,
  type MainDeps,
  main,
  parseArgs,
  sqlString,
  wranglerArgs,
} from "./block";

const parse = (...a: string[]) =>
  parseArgs([...a, ...(a.some((x) => x === "--remote") ? [] : ["--local"])]);

describe("parseArgs", () => {
  it("parses host with reason and flags", () => {
    expect(parse("host", "Evil.Example.", "--reason", "phishing", "--dry-run")).toEqual({
      command: { kind: "host", host: "evil.example", reason: "phishing" },
      dryRun: true,
      local: true,
      yes: false,
    });
  });
  it("defaults to remote, no dry run, null reason", () => {
    expect(parse("host", "a.com")).toEqual({
      command: { kind: "host", host: "a.com", reason: null },
      dryRun: false,
      local: true,
      yes: false,
    });
  });
  it("parses link and unblock", () => {
    expect(parse("link", "abc").command).toEqual({ kind: "link", id: "abc" });
    expect(parse("unblock", "B.com").command).toEqual({ kind: "unblock", host: "b.com" });
  });
  it("converts unicode hosts to punycode", () => {
    expect(parse("host", "bücher.example").command).toMatchObject({
      host: "xn--bcher-kva.example",
    });
  });
  it("rejects ports, paths, userinfo and empty hosts", () => {
    for (const bad of ["evil.com:8080", "evil.com/path", "u@evil.com", "https://evil.com", " "]) {
      expect(() => parse("host", bad)).toThrow();
      expect(() => parse("unblock", bad)).toThrow();
    }
  });
  it("requires exactly one of --remote / --local", () => {
    expect(() => parseArgs(["host", "a.com"])).toThrow("exactly one");
    expect(() => parseArgs(["host", "a.com", "--remote", "--local"])).toThrow("exactly one");
    expect(parseArgs(["unblock", "a.com", "--remote", "--yes"])).toMatchObject({
      local: false,
      yes: true,
    });
  });
  it("rejects bidi and zero-width characters in link ids", () => {
    expect(() => parse("link", "ab\u202ecd")).toThrow();
    expect(() => parse("link", "ab\u200bcd")).toThrow();
  });
  it("rejects bad usage", () => {
    expect(() => parse()).toThrow();
    expect(() => parse("host")).toThrow();
    expect(() => parse("nope", "x")).toThrow();
    expect(() => parse("host", "a.com", "b.com")).toThrow();
    expect(() => parse("host", "a.com", "--reason")).toThrow();
    expect(() => parse("host", "a.com", "--bogus")).toThrow();
    expect(() => parse("link", "a.com", "--reason", "x")).toThrow();
    expect(() => parse("link", "a/b")).toThrow();
    expect(() => parse("host", "a.com", "--reason", "x".repeat(501))).toThrow();
  });
});

describe("sqlString", () => {
  it("doubles single quotes", () => {
    expect(sqlString("it's")).toBe("'it''s'");
  });
  it("keeps hostile input inside one literal", () => {
    expect(sqlString("'; DROP TABLE links; --")).toBe("'''; DROP TABLE links; --'");
  });
  it("rejects control characters", () => {
    expect(() => sqlString("a\0b")).toThrow();
    expect(() => sqlString("a\nb")).toThrow();
  });
});

describe("buildSql", () => {
  it("builds a host block with escaped reason", () => {
    const sql = buildSql(
      { kind: "host", host: "evil.example", reason: "'; DROP TABLE links; --" },
      5,
    );
    expect(sql).toBe(
      "INSERT OR REPLACE INTO blocked_hosts (host, reason, created_at) VALUES ('evil.example', '''; DROP TABLE links; --', 5);",
    );
  });
  it("uses NULL without a reason", () => {
    expect(buildSql({ kind: "host", host: "a.com", reason: null }, 1)).toContain(
      "'a.com', NULL, 1",
    );
  });
  it("escapes hostile link ids", () => {
    const { command } = parse("link", "x'; DROP TABLE links; --");
    expect(buildSql(command, 1)).toBe("DELETE FROM links WHERE id = 'x''; DROP TABLE links; --';");
  });
  it("builds unblock", () => {
    expect(buildSql({ kind: "unblock", host: "a.com" }, 1)).toBe(
      "DELETE FROM blocked_hosts WHERE host = 'a.com';",
    );
  });
});

describe("wranglerArgs", () => {
  it("targets remote by default and local on request, SQL as a single argument", () => {
    expect(wranglerArgs("SELECT 1;", false)).toEqual([
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--command",
      "SELECT 1;",
    ]);
    expect(wranglerArgs("SELECT 1;", true)).toContain("--local");
  });
  it("cache note mentions the 60 second window", () => {
    expect(CACHE_NOTE).toContain("60 seconds");
  });
});

function deps(overrides: Partial<MainDeps> = {}) {
  const calls: string[][] = [];
  const out: string[] = [];
  const err: string[] = [];
  const d: MainDeps = {
    spawn: async (c) => {
      calls.push(c);
      return 0;
    },
    now: () => 7,
    log: (l) => out.push(l),
    error: (l) => err.push(l),
    wrangler: "/w/wrangler",
    exists: () => true,
    ...overrides,
  };
  return { d, calls, out, err };
}

describe("main", () => {
  it("--dry-run prints SQL and never spawns", async () => {
    const t = deps();
    expect(await main(["host", "evil.example", "--remote", "--dry-run"], t.d)).toBe(0);
    expect(t.calls).toHaveLength(0);
    expect(t.out[0]).toContain("'evil.example'");
  });
  it("--help prints usage with one form per line and exits 0", async () => {
    const t = deps();
    expect(await main(["--help"], t.d)).toBe(0);
    expect(t.out[0]).toContain("admin:block host <host> [--reason text]");
    expect(t.out[0]).toContain("admin:block link <id>");
    expect(t.out[0]).toContain("admin:block unblock <host>");
    expect(await main(["-h"], deps().d)).toBe(0);
  });
  it("usage errors exit 2 without spawning", async () => {
    const t = deps();
    expect(await main(["host", "a.com"], t.d)).toBe(2);
    expect(t.calls).toHaveLength(0);
  });
  it("remote link delete and unblock need --yes", async () => {
    for (const argv of [
      ["link", "abc"],
      ["unblock", "a.com"],
    ]) {
      const t = deps();
      expect(await main([...argv, "--remote"], t.d)).toBe(1);
      expect(t.calls).toHaveLength(0);
      expect(t.err.join()).toContain("--yes");
      expect(t.out.join()).toContain("DELETE FROM");
    }
    const ok = deps();
    expect(await main(["link", "abc", "--remote", "--yes"], ok.d)).toBe(0);
    expect(ok.calls).toHaveLength(1);
  });
  it("remote host block and local deletes run without --yes", async () => {
    const t = deps();
    expect(await main(["host", "a.com", "--remote"], t.d)).toBe(0);
    expect(await main(["link", "abc", "--local"], t.d)).toBe(0);
    expect(t.calls[0]).toEqual([
      "/w/wrangler",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--command",
      t.out[0] as string,
    ]);
  });
  it("exits 1 cleanly when wrangler is missing or spawn fails", async () => {
    const missing = deps({ exists: () => false });
    expect(await main(["host", "a.com", "--local"], missing.d)).toBe(1);
    expect(missing.err.join()).toContain("wrangler not found");
    const failing = deps({
      spawn: async () => {
        throw new Error("ENOENT");
      },
    });
    expect(await main(["host", "a.com", "--local"], failing.d)).toBe(1);
    expect(failing.err.join()).toContain("ENOENT");
  });
});
