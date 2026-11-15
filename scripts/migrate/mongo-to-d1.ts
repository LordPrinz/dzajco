// v2 (MongoDB) to D1 importer. Reads the `links` collection (driver or a mongoexport file),
// writes INSERT OR IGNORE batches plus a report, and optionally runs them with the project's wrangler.
// With --visits it writes only the v2 visit counters instead (ledger rows of migration 0003).
// See USAGE below or run with --help.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { currentVersion, peppersFromEnv } from "../../src/domain/secret";
import { parseJsonc } from "../lib/jsonc";
import { buildSqlFiles, type MigrationReport, transformLinks } from "./transform";
import { buildVisitSqlFiles, parseLocations, transformVisits, type VisitReport } from "./visits";

export interface MigrateArgs {
  fromJson: string | null;
  mongoUri: string | null;
  mongoDb: string | undefined;
  out: string;
  dryRun: boolean;
  local: boolean;
  remote: boolean;
  delta: boolean;
  visits: boolean;
  locations: string | null;
  env: string | null;
  ownHosts: string[];
}

export const USAGE = [
  "Usage:",
  "  migrate:mongo --from-json <file> (--local | --remote --yes | --dry-run) [options]",
  "  MONGODB_URI=<uri> migrate:mongo (--local | --remote --yes | --dry-run) [options]",
  "",
  "Source (one of):",
  "  --from-json <file>  output of `mongoexport --collection links --jsonArray` (Extended JSON).",
  "                      The export holds the v2 keys in plaintext: delete it after the import.",
  "  MONGODB_URI         env var: read the `links` collection with the MongoDB driver",
  "  --mongo-uri <uri>   same as MONGODB_URI, but the URI ends up in shell history",
  "  --mongo-db <name>   database name when the URI has none",
  "",
  "Target:",
  "  --local | --remote  exactly one, unless --dry-run: which D1 database to import into",
  "  --yes               required with --remote; there is no prompt",
  "  --dry-run           write the SQL files and report.json, execute nothing",
  "  --out <dir>         directory for links-NNNN.sql and report.json (default .wrangler/migrate)",
  "  --own-host <host>   this deployment's host for the policy report; repeatable",
  "                      (default: the host of PUBLIC_ORIGIN in wrangler.jsonc)",
  "  --delta             a later catch-up run. It is the same run: every statement is",
  "                      INSERT OR IGNORE, so ids already in D1 are left as they are and only",
  "                      new ids are added. Changes and deletions in v2 are not carried over.",
  "  --visits            import only the v2 visit counters (visits-NNNN.sql), no links; run it",
  "                      after the link import. Idempotent; see docs/DEPLOYMENT.md section 5",
  "  --locations <file>  the `locations` export for --visits (default: locations.json next to",
  "                      --from-json; with MongoDB the collection)",
  "  --env <name>        wrangler environment of the D1 database, for example dev",
  "  --help, -h          show this text",
  "",
  "Keys are hashed with SECRET_PEPPER_V<n> from the env. n is SECRET_PEPPER_VERSION from the env,",
  "else from vars in wrangler.jsonc. The SQL holds hashes only. Expired links (expires_at <= now),",
  "reserved ids and targets over 2048 characters are skipped. Imported links the v3 creation",
  "policy would refuse (shorteners, private or own hosts) are listed under policy flags.",
].join("\n");

const DEFAULT_OUT = join(import.meta.dirname, "../../.wrangler/migrate");
const BATCH_FILE = /^(links|visits)-\d{4}\.sql$/;
const SECRET_ENV = /^(SECRET_PEPPER_V\d+|MONGODB_URI)$/;

export function parseArgs(argv: string[]): MigrateArgs {
  const args: MigrateArgs = {
    fromJson: null,
    mongoUri: null,
    mongoDb: undefined,
    out: DEFAULT_OUT,
    dryRun: false,
    local: false,
    remote: false,
    delta: false,
    visits: false,
    locations: null,
    env: null,
    ownHosts: [],
  };
  let yes = false;
  const value = (i: number, name: string): string => {
    const next = argv[i];
    if (next === undefined || next.startsWith("--")) throw new Error(`${name} needs a value`);
    return next;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--local") args.local = true;
    else if (arg === "--remote") args.remote = true;
    else if (arg === "--yes") yes = true;
    else if (arg === "--delta") args.delta = true;
    else if (arg === "--visits") args.visits = true;
    else if (arg === "--locations") args.locations = value(++i, arg);
    else if (arg === "--env") args.env = value(++i, arg);
    else if (arg === "--from-json") args.fromJson = value(++i, arg);
    else if (arg === "--mongo-uri") args.mongoUri = value(++i, arg);
    else if (arg === "--mongo-db") args.mongoDb = value(++i, arg);
    else if (arg === "--out") args.out = value(++i, arg);
    else if (arg === "--own-host") args.ownHosts.push(value(++i, arg));
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (args.fromJson !== null && args.mongoUri !== null) {
    throw new Error("Pass only one of --from-json or --mongo-uri");
  }
  if (args.locations !== null && !args.visits) throw new Error("--locations needs --visits");
  if (args.local && args.remote) throw new Error("Pass exactly one of --local or --remote");
  if (!args.dryRun && !args.local && !args.remote) {
    throw new Error(`Pass exactly one of --local or --remote, or --dry-run.\n${USAGE}`);
  }
  if (args.remote && !yes && !args.dryRun) {
    throw new Error("This writes to the remote database: re-run with --yes");
  }
  return args;
}

export interface MainDeps {
  env: Record<string, string | undefined>;
  now: () => number;
  log: (line: string) => void;
  error: (line: string) => void;
  wrangler: string;
  exists: (path: string) => boolean;
  spawn: (command: string[], env: Record<string, string | undefined>) => Promise<number>;
  readMongo: (
    uri: string,
    db: string | undefined,
    collection: "links" | "locations",
  ) => Promise<unknown[]>;
  /** wrangler.jsonc text, or null when there is none. */
  readConfig: () => string | null;
}

const PROJECTIONS = {
  links: { _id: 1, full: 1, expire: 1, secretKey: 1, visits: 1, visitsLocation: 1 },
  locations: { _id: 1, lat: 1, lon: 1 },
};

async function readMongo(
  uri: string,
  db: string | undefined,
  collection: "links" | "locations",
): Promise<unknown[]> {
  // Loaded only here, so the tests and --from-json runs do not need the driver.
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    return await client
      .db(db)
      .collection(collection)
      .find({}, { projection: PROJECTIONS[collection] })
      .sort({ _id: 1 })
      .toArray();
  } finally {
    await client.close();
  }
}

const WRANGLER = join(import.meta.dirname, "../../node_modules/.bin/wrangler");
const WRANGLER_CONFIG = join(import.meta.dirname, "../../wrangler.jsonc");

const defaultDeps: MainDeps = {
  env: process.env,
  now: Date.now,
  log: console.log,
  error: console.error,
  wrangler: WRANGLER,
  exists: existsSync,
  spawn: async (command, env) => {
    const proc = Bun.spawn(command, { env, stdout: "inherit", stderr: "inherit" });
    return await proc.exited;
  },
  readMongo,
  readConfig: () => (existsSync(WRANGLER_CONFIG) ? readFileSync(WRANGLER_CONFIG, "utf8") : null),
};

/** The `vars` of wrangler.jsonc; the env overrides them. */
function configVars(deps: MainDeps): Record<string, unknown> {
  const text = deps.readConfig();
  if (text === null) return {};
  const vars = (parseJsonc(text) as { vars?: unknown }).vars;
  return typeof vars === "object" && vars !== null ? (vars as Record<string, unknown>) : {};
}

/** Every form the credentials can take in an error message: whole URI, user, raw and decoded password. */
export function redactUri(text: string, uri: string): string {
  const secrets = [uri];
  const auth = /^[^:/]+:\/\/([^:@/]*)(?::([^@/]*))?@/.exec(uri);
  for (const part of [auth?.[1], auth?.[2]]) {
    if (!part) continue;
    secrets.push(part);
    try {
      secrets.push(decodeURIComponent(part));
    } catch {
      // the raw form is already listed
    }
  }
  let out = text;
  for (const secret of secrets.sort((a, b) => b.length - a.length)) {
    if (secret !== "") out = out.replaceAll(secret, "<redacted>");
  }
  return out;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summary(report: MigrationReport): string[] {
  const list = (ids: string[]) => `${ids.length} ${JSON.stringify(ids)}`;
  return [
    `read: ${report.read}`,
    `inserted: ${report.inserted} (planned; INSERT OR IGNORE skips ids already in D1)`,
    `skipped (expired): ${report.skippedExpired}`,
    `skipped (invalid): ${report.skippedInvalid} ${JSON.stringify(report.invalid)}`,
    `reserved collisions: ${list(report.reservedCollisions)}`,
    `duplicates: ${list(report.duplicates)}`,
    `legacy keys hashed: ${report.legacyKeys}`,
    `https:// added to www. targets: ${list(report.schemeAdded)}`,
    `ids over 96 bytes (imported anyway): ${list(report.overlongIds)}`,
    `policy flags (imported; review, then admin:block if needed): ${report.policyFlags.length} ${JSON.stringify(report.policyFlags)}`,
  ];
}

function readJsonArray(path: string, flag: string): unknown[] {
  const docs: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(docs)) throw new Error(`${flag} expects a JSON array (--jsonArray)`);
  return docs;
}

async function loadDocs(
  args: MigrateArgs,
  deps: MainDeps,
  collection: "links" | "locations",
): Promise<unknown[]> {
  if (args.fromJson !== null) {
    if (collection === "links") return readJsonArray(args.fromJson, "--from-json");
    const path = args.locations ?? join(dirname(args.fromJson), "locations.json");
    if (!deps.exists(path)) {
      throw new Error(`--visits needs the locations export: ${path} not found, pass --locations`);
    }
    return readJsonArray(path, "--locations");
  }
  if (args.locations !== null && collection === "locations") {
    return readJsonArray(args.locations, "--locations");
  }
  const uri = args.mongoUri ?? (deps.env.MONGODB_URI as string);
  try {
    return await deps.readMongo(uri, args.mongoDb, collection);
  } catch (error) {
    throw new Error(`MongoDB read failed: ${redactUri(message(error), uri)}`);
  }
}

function writeOutput(
  out: string,
  files: { prefix: string; sql: string[] }[],
  report: MigrationReport | { visits: VisitReport },
): string[] {
  mkdirSync(out, { recursive: true });
  for (const name of readdirSync(out)) {
    if (BATCH_FILE.test(name)) rmSync(join(out, name));
  }
  const paths = files.flatMap(({ prefix, sql }) =>
    sql.map((text, i) => {
      const path = join(out, `${prefix}-${String(i + 1).padStart(4, "0")}.sql`);
      writeFileSync(path, text);
      return path;
    }),
  );
  writeFileSync(join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return paths;
}

function visitSummary(report: VisitReport): string[] {
  const list = (items: string[]) => `${items.length} ${JSON.stringify(items)}`;
  return [
    `visits: ${report.visits} on ${report.links} link(s), ${report.rows} row(s) (planned; rows already imported, and links not in D1 with the same target and key, are skipped)`,
    `visits without a location (unknown country): ${report.unknownVisits}`,
    `unmapped country names: ${list(report.unmappedCountries)}`,
    `locations missing coordinates: ${report.missingLocations.length}`,
    `links with more located visits than visits: ${list(report.locatedOverTotal)}`,
  ];
}

export async function main(argv: string[], deps: MainDeps = defaultDeps): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    deps.log(USAGE);
    return 0;
  }
  let args: MigrateArgs;
  let version: number;
  let ownHosts: string[];
  try {
    args = parseArgs(argv);
    if (args.fromJson === null && args.mongoUri === null && !deps.env.MONGODB_URI) {
      throw new Error("No source: pass --from-json <file> or set MONGODB_URI");
    }
    const vars = configVars(deps);
    version = currentVersion({
      SECRET_PEPPER_VERSION: deps.env.SECRET_PEPPER_VERSION ?? vars.SECRET_PEPPER_VERSION,
    });
    const origin = vars.PUBLIC_ORIGIN;
    ownHosts =
      args.ownHosts.length > 0 || typeof origin !== "string" || !URL.canParse(origin)
        ? args.ownHosts
        : [new URL(origin).host];
    if (!peppersFromEnv(deps.env)[version]) {
      throw new Error(`SECRET_PEPPER_V${version} is not set`);
    }
  } catch (error) {
    deps.error(message(error));
    return 2;
  }
  deps.log(`pepper version: ${version}`);
  if (args.mongoUri !== null) {
    deps.error("Note: --mongo-uri lands in shell history; prefer the MONGODB_URI env var.");
  }
  if (args.delta) {
    deps.log("--delta: same idempotent run; ids already in D1 are left as they are.");
  }

  let paths: string[];
  try {
    const docs = await loadDocs(args, deps, "links");
    const { rows, report, sources } = await transformLinks(docs, {
      now: deps.now(),
      version,
      peppers: peppersFromEnv(deps.env),
      ownHosts,
    });
    if (args.visits) {
      // Visits only: replaying the link SQL after the cutover would bring back deleted links.
      const locations = parseLocations(await loadDocs(args, deps, "locations"));
      const visits = transformVisits(rows, sources, locations);
      const sql = buildVisitSqlFiles(visits.rows);
      paths = writeOutput(args.out, [{ prefix: "visits", sql }], { visits: visits.report });
      for (const line of visitSummary(visits.report)) deps.log(line);
    } else {
      paths = writeOutput(args.out, [{ prefix: "links", sql: buildSqlFiles(rows) }], report);
      for (const line of summary(report)) deps.log(line);
    }
    deps.log(`wrote ${paths.length} SQL file(s) and report.json to ${args.out}`);
  } catch (error) {
    deps.error(message(error));
    return 1;
  }
  if (args.dryRun) return 0;

  if (!deps.exists(deps.wrangler)) {
    deps.error("wrangler not found: run `bun install` first");
    return 1;
  }
  const childEnv = Object.fromEntries(
    Object.entries(deps.env).filter(([name]) => !SECRET_ENV.test(name)),
  );
  for (const path of paths) {
    const target = args.local ? "--local" : "--remote";
    const command = [deps.wrangler, "d1", "execute", "DB", target, "--file", path];
    if (args.env !== null) command.push("--env", args.env);
    let code: number;
    try {
      code = await deps.spawn(command, childEnv);
    } catch (error) {
      deps.error(`Could not run wrangler: ${message(error)}`);
      return 1;
    }
    if (code !== 0) {
      deps.error(`wrangler failed on ${path}; re-running is safe (every statement is idempotent)`);
      return code;
    }
  }
  return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
