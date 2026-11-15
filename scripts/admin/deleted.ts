// Admin CLI: list links their owners deleted in the last 30 days, or show one id.
//
// Read only. Runs the project's wrangler (`wrangler d1 execute DB --json`). Pass exactly one of
// --remote / --local. See USAGE below or run with --help.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { LOOKUP_ID } from "../../src/domain/ids";
import { sqlString } from "../lib/sql";

export interface DeletedArgs {
  /** One link id, or null to list the most recent deletes. */
  id: string | null;
  local: boolean;
  /** Wrangler environment (`--env dev`); null for the top-level config. */
  env: string | null;
  limit: number;
  dryRun: boolean;
}

export interface DeletedRow {
  id: string;
  target: string;
  expires_at: number | null;
  created_at: number;
  is_custom: number;
  deleted_at: number;
  visits: number;
  countries: string;
}

export const USAGE = [
  "Usage:",
  "  admin:deleted [id] (--remote | --local) [--env name] [--limit n] [--dry-run]",
  "",
  "  id                  show every archived copy of this link id; without it, list recent deletes",
  "  --remote | --local  exactly one: which D1 database to read",
  "  --env name          wrangler environment, for example --env dev",
  "  --limit n           how many rows to list (default 50, at most 1000)",
  "  --dry-run           print the SQL and run nothing",
  "  --help, -h          show this text",
].join("\n");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;
// Must not start with "-", so a value can never be read by wrangler as another option.
const ENV_NAME = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/;
const COLUMNS =
  "id, target, expires_at, created_at, is_custom, deleted_at, visits, countries FROM deleted_links";

export function parseArgs(argv: string[]): DeletedArgs {
  let dryRun = false;
  let local = false;
  let remote = false;
  let env: string | null = null;
  let limit = DEFAULT_LIMIT;
  let limitGiven = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--local") local = true;
    else if (arg === "--remote") remote = true;
    else if (arg === "--env") {
      const value = argv[++i];
      if (value === undefined || !ENV_NAME.test(value)) throw new Error("--env needs a name");
      env = value;
    } else if (arg === "--limit") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
        throw new Error(`--limit needs a whole number from 1 to ${MAX_LIMIT}`);
      }
      limit = value;
      limitGiven = true;
    } else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else positional.push(arg);
  }
  if (local === remote) throw new Error(`Pass exactly one of --remote or --local.\n${USAGE}`);
  if (positional.length > 1) throw new Error(USAGE);
  let id: string | null = null;
  if (positional[0] !== undefined) {
    id = positional[0].normalize("NFC");
    if (!LOOKUP_ID.test(id)) throw new Error("Not a valid link id");
    if (limitGiven) throw new Error("--limit only applies to the list, not to one id");
  }
  return { id, local, env, limit, dryRun };
}

export function buildSql(args: Pick<DeletedArgs, "id" | "limit">): string {
  if (args.id !== null) {
    return `SELECT ${COLUMNS} WHERE id = ${sqlString(args.id)} ORDER BY deleted_at DESC;`;
  }
  return `SELECT ${COLUMNS} ORDER BY deleted_at DESC LIMIT ${Math.trunc(args.limit)};`;
}

export function wranglerArgs(sql: string, local: boolean, env: string | null): string[] {
  return [
    "wrangler",
    "d1",
    "execute",
    "DB",
    local ? "--local" : "--remote",
    ...(env === null ? [] : ["--env", env]),
    "--json",
    "--command",
    sql,
  ];
}

/** The rows of the single statement in `wrangler d1 execute --json` output. */
export function parseRows(stdout: string): DeletedRow[] {
  const parsed = JSON.parse(stdout) as unknown;
  const first = Array.isArray(parsed) ? (parsed[0] as { results?: unknown } | undefined) : null;
  if (!first || !Array.isArray(first.results)) throw new Error("Unexpected wrangler output");
  return first.results as DeletedRow[];
}

/**
 * Stored text comes from link owners: control characters would reach the terminal as escapes, and
 * format characters (bidi overrides, zero-width) could make it show something other than what is stored.
 */
function clean(text: string): string {
  return text.replace(/[\p{Cc}\p{Cf}]/gu, "?");
}

function iso(ms: number | null): string {
  return ms === null ? "never" : new Date(ms).toISOString();
}

/** `PL 5, DE 1` (most visits first) from the JSON summary; the raw text if it does not parse. */
export function formatCountries(json: string): string {
  try {
    const list = (JSON.parse(json) as { code: string; visits: number }[])
      .map((c) => ({ code: clean(String(c.code)), visits: Number(c.visits) }))
      .sort((a, b) => b.visits - a.visits || a.code.localeCompare(b.code));
    return list.map((c) => `${c.code} ${c.visits}`).join(", ");
  } catch {
    return clean(json);
  }
}

export function formatList(rows: readonly DeletedRow[]): string {
  if (rows.length === 0) return "No deleted links in the archive.";
  const lines = rows.map(
    (r) => `${iso(r.deleted_at)}  ${clean(r.id)}  ${r.visits} visits  ${clean(r.target)}`,
  );
  const noun = rows.length === 1 ? "link" : "links";
  return [`${rows.length} deleted ${noun}, newest first:`, ...lines].join("\n");
}

export function formatOne(id: string, rows: readonly DeletedRow[]): string {
  if (rows.length === 0) return `No deleted link with id ${clean(id)} in the archive.`;
  return rows
    .map((r) => {
      const countries = formatCountries(r.countries);
      return [
        `id:       ${clean(r.id)}`,
        `target:   ${clean(r.target)}`,
        `custom:   ${r.is_custom === 1 ? "yes" : "no"}`,
        `created:  ${iso(r.created_at)}`,
        `expires:  ${iso(r.expires_at)}`,
        `deleted:  ${iso(r.deleted_at)}`,
        `visits:   ${r.visits}${countries ? ` (${countries})` : ""}`,
      ].join("\n");
    })
    .join("\n\n");
}

export interface MainDeps {
  /** Runs the command; stdout is captured, stderr goes to the terminal. */
  run: (command: string[]) => Promise<{ code: number; stdout: string }>;
  log: (line: string) => void;
  error: (line: string) => void;
  wrangler: string;
  exists: (path: string) => boolean;
}

const WRANGLER = join(import.meta.dirname, "../../node_modules/.bin/wrangler");

const defaultDeps: MainDeps = {
  run: async (command) => {
    const proc = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
    const stdout = await new Response(proc.stdout).text();
    return { code: await proc.exited, stdout };
  },
  log: console.log,
  error: console.error,
  wrangler: WRANGLER,
  exists: existsSync,
};

export async function main(argv: string[], deps: MainDeps = defaultDeps): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    deps.log(USAGE);
    return 0;
  }
  let args: DeletedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    deps.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const sql = buildSql(args);
  if (args.dryRun) {
    deps.log(sql);
    return 0;
  }
  if (!deps.exists(deps.wrangler)) {
    deps.error("wrangler not found: run `bun install` first");
    return 1;
  }
  try {
    const { code, stdout } = await deps.run([
      deps.wrangler,
      ...wranglerArgs(sql, args.local, args.env).slice(1),
    ]);
    if (code !== 0) {
      // With --json, wrangler reports errors on stdout.
      const output = stdout.trim();
      if (output !== "") deps.error(output.split("\n").map(clean).join("\n"));
      return code;
    }
    const rows = parseRows(stdout);
    deps.log(args.id === null ? formatList(rows) : formatOne(args.id, rows));
    return 0;
  } catch (error) {
    deps.error(`Could not run wrangler: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
