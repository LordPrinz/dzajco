import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixture from "./fixtures/v2-links.json";
import { type MainDeps, main, parseArgs, redactUri, USAGE } from "./mongo-to-d1";

const FIXTURE = join(import.meta.dirname, "fixtures/v2-links.json");
const PEPPER = "cli-test-pepper-do-not-print";
const MONGO_URI = "mongodb://admin:hunter2@localhost:27017/dzajco";
const NOW = Date.parse("2026-11-14T00:00:00Z");
const CONFIG = `{
  // like wrangler.jsonc
  "vars": {
    "PUBLIC_ORIGIN": "https://dzaj.co", /* own host */
    "SECRET_PEPPER_VERSION": "1",
  },
}`;
const KEYS = fixture.flatMap((doc) =>
  "secretKey" in doc && typeof doc.secretKey === "string" ? [doc.secretKey] : [],
);

let out: string;
let logs: string[];
let errors: string[];
let spawned: { command: string[]; env: Record<string, string | undefined> }[];
let mongoCalls: { uri: string; db: string | undefined }[];

beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), "migrate-test-"));
  logs = [];
  errors = [];
  spawned = [];
  mongoCalls = [];
});
afterEach(() => rmSync(out, { recursive: true, force: true }));

function deps(overrides: Partial<MainDeps> = {}): MainDeps {
  return {
    env: { SECRET_PEPPER_VERSION: "1", SECRET_PEPPER_V1: PEPPER, PATH: "/usr/bin" },
    now: () => NOW,
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
    wrangler: "/fake/wrangler",
    exists: () => true,
    spawn: async (command, env) => {
      spawned.push({ command, env });
      return 0;
    },
    readMongo: async (uri, db) => {
      mongoCalls.push({ uri, db });
      return fixture;
    },
    readConfig: () => CONFIG,
    ...overrides,
  };
}

const run = (args: string[], d: MainDeps = deps()) => main([...args, "--out", out], d);
const sqlFiles = () =>
  readdirSync(out)
    .filter((f) => f.endsWith(".sql"))
    .sort();
const allOutput = () =>
  [...logs, ...errors, ...readdirSync(out).map((f) => readFileSync(join(out, f), "utf8"))].join(
    "\n",
  );

describe("parseArgs", () => {
  it("needs exactly one target unless it is a dry run", () => {
    expect(() => parseArgs(["--from-json", "f"])).toThrow("exactly one of --local or --remote");
    expect(() => parseArgs(["--from-json", "f", "--local", "--remote"])).toThrow("exactly one");
    expect(parseArgs(["--from-json", "f", "--dry-run"])).toMatchObject({ dryRun: true });
  });
  it("needs --yes for --remote", () => {
    expect(() => parseArgs(["--from-json", "f", "--remote"])).toThrow("--yes");
    expect(parseArgs(["--from-json", "f", "--remote", "--yes"])).toMatchObject({ remote: true });
  });
  it("refuses two sources, unknown options and missing values", () => {
    expect(() => parseArgs(["--from-json", "f", "--mongo-uri", "u", "--local"])).toThrow(
      "only one of --from-json or --mongo-uri",
    );
    expect(() => parseArgs(["--from-json", "--local"])).toThrow("--from-json needs a value");
    expect(() => parseArgs(["--bogus", "--local"])).toThrow("Unknown option --bogus");
    expect(() => parseArgs(["stray", "--local"])).toThrow("Unknown argument stray");
  });
});

describe("main", () => {
  it("prints usage for --help", async () => {
    expect(await main(["--help"], deps())).toBe(0);
    expect(logs).toEqual([USAGE]);
    expect(USAGE).toContain("--delta");
  });

  it("fails clearly without the pepper and never prints a pepper", async () => {
    const env = { SECRET_PEPPER_VERSION: "2", SECRET_PEPPER_V1: PEPPER };
    expect(await run(["--from-json", FIXTURE, "--dry-run"], deps({ env }))).toBe(2);
    expect(errors.join("\n")).toContain("SECRET_PEPPER_V2 is not set");
    expect(await run(["--from-json", FIXTURE, "--dry-run"], deps({ env: {} }))).toBe(2);
    expect(errors.join("\n")).toContain("SECRET_PEPPER_V1 is not set");
    const bare = deps({ env: { SECRET_PEPPER_V1: PEPPER }, readConfig: () => null });
    expect(await run(["--from-json", FIXTURE, "--dry-run"], bare)).toBe(2);
    expect(errors.join("\n")).toContain("SECRET_PEPPER_VERSION");
    expect(allOutput()).not.toContain(PEPPER);
    expect(sqlFiles()).toEqual([]);
  });

  it("takes SECRET_PEPPER_VERSION from wrangler.jsonc unless the env sets it", async () => {
    const fromFile = deps({ env: { SECRET_PEPPER_V1: PEPPER } });
    expect(await run(["--from-json", FIXTURE, "--dry-run"], fromFile)).toBe(0);
    expect(logs).toContain("pepper version: 1");
    expect(readFileSync(join(out, "links-0001.sql"), "utf8")).toContain("'v1:");
    logs = [];
    const fromEnv = deps({ env: { SECRET_PEPPER_VERSION: "2", SECRET_PEPPER_V2: PEPPER } });
    expect(await run(["--from-json", FIXTURE, "--dry-run"], fromEnv)).toBe(0);
    expect(logs).toContain("pepper version: 2");
    const sql = readFileSync(join(out, "links-0001.sql"), "utf8");
    expect(sql).toContain("'v2:");
    expect(sql).not.toContain("'v1:");
  });

  it("lists the ids over 96 bytes in the summary", async () => {
    await run(["--from-json", FIXTURE, "--dry-run"]);
    expect(logs.join("\n")).toContain("ids over 96 bytes (imported anyway): 0 []");
  });

  it("flags own-host targets using PUBLIC_ORIGIN, or the --own-host list instead", async () => {
    await run(["--from-json", FIXTURE, "--dry-run"]);
    const flags = () => JSON.parse(readFileSync(join(out, "report.json"), "utf8")).policyFlags;
    expect(flags()).toEqual([
      { id: "ownhost", code: "own_host" },
      { id: "shortx", code: "blocked_target" },
    ]);
    expect(logs.join("\n")).toContain(
      "policy flags (imported; review, then admin:block if needed): 2",
    );
    await run([
      "--from-json",
      FIXTURE,
      "--dry-run",
      "--own-host",
      "other.test",
      "--own-host",
      "x.test",
    ]);
    expect(flags()).toEqual([{ id: "shortx", code: "blocked_target" }]);
  });

  it("dry run writes SQL and the report, runs nothing, and leaks no key or pepper", async () => {
    expect(await run(["--from-json", FIXTURE, "--dry-run"])).toBe(0);
    expect(spawned).toEqual([]);
    expect(sqlFiles()).toEqual(["links-0001.sql"]);
    const report = JSON.parse(readFileSync(join(out, "report.json"), "utf8"));
    expect(report).toMatchObject({
      read: 17,
      inserted: 11,
      skippedExpired: 1,
      skippedInvalid: 3,
      reservedCollisions: ["api"],
      duplicates: ["café"],
      legacyKeys: 8,
      schemeAdded: ["wwwonly"],
    });
    const text = logs.join("\n");
    expect(text).toContain("read: 17");
    expect(text).toContain("inserted: 11");
    expect(text).toContain("skipped (expired): 1");
    expect(text).toContain('reserved collisions: 1 ["api"]');
    const output = allOutput();
    for (const key of KEYS) expect(output).not.toContain(key);
    expect(output).not.toContain(PEPPER);
  });

  it("writes the same SQL on a second run and drops stale batch files", async () => {
    await run(["--from-json", FIXTURE, "--dry-run"]);
    const first = readFileSync(join(out, "links-0001.sql"), "utf8");
    writeFileSync(join(out, "links-0009.sql"), "stale");
    writeFileSync(join(out, "keep.txt"), "not ours");
    await run(["--from-json", FIXTURE, "--dry-run", "--delta"]);
    expect(sqlFiles()).toEqual(["links-0001.sql"]);
    expect(existsSync(join(out, "keep.txt"))).toBe(true);
    expect(readFileSync(join(out, "links-0001.sql"), "utf8")).toBe(first);
    expect(logs.join("\n")).toContain("--delta");
  });

  it("runs wrangler once per file against the local database, without secrets in its env", async () => {
    const env = {
      SECRET_PEPPER_VERSION: "1",
      SECRET_PEPPER_V1: PEPPER,
      MONGODB_URI: MONGO_URI,
      PATH: "/usr/bin",
    };
    expect(await run(["--from-json", FIXTURE, "--local"], deps({ env }))).toBe(0);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.command).toEqual([
      "/fake/wrangler",
      "d1",
      "execute",
      "DB",
      "--local",
      "--file",
      join(out, "links-0001.sql"),
    ]);
    expect(spawned[0]?.env).toEqual({ SECRET_PEPPER_VERSION: "1", PATH: "/usr/bin" });
  });

  it("runs against the remote database only with --yes", async () => {
    expect(await run(["--from-json", FIXTURE, "--remote"])).toBe(2);
    expect(spawned).toEqual([]);
    expect(await run(["--from-json", FIXTURE, "--remote", "--yes"])).toBe(0);
    expect(spawned[0]?.command).toContain("--remote");
  });

  it("stops at the first failing wrangler run and returns its code", async () => {
    const d = deps({ spawn: async () => 7 });
    expect(await run(["--from-json", FIXTURE, "--local"], d)).toBe(7);
    expect(await run(["--from-json", FIXTURE, "--local"], deps({ exists: () => false }))).toBe(1);
    expect(errors.join("\n")).toContain("wrangler not found");
  });

  it("reads MongoDB from MONGODB_URI and never prints the URI", async () => {
    const env = { SECRET_PEPPER_VERSION: "1", SECRET_PEPPER_V1: PEPPER, MONGODB_URI: MONGO_URI };
    expect(await run(["--dry-run", "--mongo-db", "legacy"], deps({ env }))).toBe(0);
    expect(mongoCalls).toEqual([{ uri: MONGO_URI, db: "legacy" }]);
    expect(allOutput()).not.toContain("hunter2");
  });

  it("accepts --mongo-uri with a note that MONGODB_URI keeps it out of shell history", async () => {
    expect(await run(["--mongo-uri", MONGO_URI, "--dry-run"])).toBe(0);
    expect(mongoCalls).toEqual([{ uri: MONGO_URI, db: undefined }]);
    expect(errors.join("\n")).toContain("MONGODB_URI");
    expect(allOutput()).not.toContain("hunter2");
  });

  it("redacts the URI from a MongoDB error", async () => {
    const readMongo = async (uri: string) => {
      throw new Error(`cannot connect to ${uri}`);
    };
    expect(await run(["--mongo-uri", MONGO_URI, "--dry-run"], deps({ readMongo }))).toBe(1);
    expect(errors.join("\n")).toContain("cannot connect to <redacted>");
    expect(allOutput()).not.toContain("hunter2");
  });

  it("redacts the user and the raw and decoded password on their own", () => {
    const uri = "mongodb+srv://ad%40min:p%40ss%2Fw0rd@cluster0.example.net/dzajco";
    const text = `auth failed for ad@min / ad%40min with p@ss/w0rd (p%40ss%2Fw0rd) via ${uri}`;
    const redacted = redactUri(text, uri);
    for (const secret of ["ad@min", "ad%40min", "p@ss/w0rd", "p%40ss%2Fw0rd", uri]) {
      expect(redacted).not.toContain(secret);
    }
    expect(redacted).toContain("auth failed for <redacted>");
    expect(redactUri("no secrets", "mongodb://localhost/db")).toBe("no secrets");
  });

  it("needs a source and a JSON array", async () => {
    expect(await run(["--dry-run"])).toBe(2);
    expect(errors.join("\n")).toContain("--from-json");
    const notArray = join(out, "object.json");
    writeFileSync(notArray, "{}");
    expect(await run(["--from-json", notArray, "--dry-run"])).toBe(1);
    expect(errors.join("\n")).toContain("JSON array");
  });
});
