// Abuse admin CLI: block or unblock a host, or delete a link.
//
// Runs the project's wrangler (`wrangler d1 execute DB`). Pass exactly one of --remote / --local.
// See USAGE below or run with --help.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { normalizeHost } from "../../src/domain/host";
import { sqlString } from "../lib/sql";

export type BlockCommand =
  | { kind: "host"; host: string; reason: string | null }
  | { kind: "link"; id: string }
  | { kind: "unblock"; host: string };

export interface BlockArgs {
  command: BlockCommand;
  dryRun: boolean;
  local: boolean;
  yes: boolean;
}

export const USAGE = [
  "Usage:",
  "  admin:block host <host> [--reason text] (--remote | --local) [--dry-run]",
  "  admin:block link <id> (--remote | --local) [--yes] [--dry-run]",
  "  admin:block unblock <host> (--remote | --local) [--yes] [--dry-run]",
  "",
  "  --remote | --local  exactly one: which D1 database to change",
  "  --yes               required to run link / unblock against the remote database",
  "  --dry-run           print the SQL and run nothing",
  "  --help, -h          show this text",
].join("\n");
const MAX_REASON_LENGTH = 500;
const LINK_ID = /^[^/\p{Cc}\p{Cf}]{1,64}$/u;

export const CACHE_NOTE =
  "Note: cached copies of a deleted link can still redirect for up to 60 seconds.";

export function parseArgs(argv: string[]): BlockArgs {
  let dryRun = false;
  let local = false;
  let remote = false;
  let yes = false;
  let reason: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--local") local = true;
    else if (arg === "--remote") remote = true;
    else if (arg === "--yes") yes = true;
    else if (arg === "--reason") {
      const value = argv[++i];
      if (value === undefined) throw new Error("--reason needs a value");
      reason = value;
    } else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else positional.push(arg);
  }
  if (local === remote) throw new Error(`Pass exactly one of --remote or --local.\n${USAGE}`);
  const [kind, target, ...extra] = positional;
  if (!kind || !target || extra.length > 0) throw new Error(USAGE);
  if (reason !== null && kind !== "host") throw new Error("--reason only applies to host");
  if (reason !== null && reason.length > MAX_REASON_LENGTH) throw new Error("Reason is too long");

  if (kind === "host") {
    return { command: { kind, host: normalizeHost(target), reason }, dryRun, local, yes };
  }
  if (kind === "unblock") {
    return { command: { kind, host: normalizeHost(target) }, dryRun, local, yes };
  }
  if (kind === "link") {
    const id = target.normalize("NFC");
    if (!LINK_ID.test(id)) throw new Error("Not a valid link id");
    return { command: { kind, id }, dryRun, local, yes };
  }
  throw new Error(USAGE);
}

export function buildSql(command: BlockCommand, now: number): string {
  switch (command.kind) {
    case "host": {
      const reason = command.reason === null ? "NULL" : sqlString(command.reason);
      return `INSERT OR REPLACE INTO blocked_hosts (host, reason, created_at) VALUES (${sqlString(command.host)}, ${reason}, ${Math.trunc(now)});`;
    }
    case "link":
      return `DELETE FROM links WHERE id = ${sqlString(command.id)};`;
    case "unblock":
      return `DELETE FROM blocked_hosts WHERE host = ${sqlString(command.host)};`;
  }
}

export function wranglerArgs(sql: string, local: boolean): string[] {
  return ["wrangler", "d1", "execute", "DB", local ? "--local" : "--remote", "--command", sql];
}

export interface MainDeps {
  spawn: (command: string[]) => Promise<number>;
  now: () => number;
  log: (line: string) => void;
  error: (line: string) => void;
  wrangler: string;
  exists: (path: string) => boolean;
}

const WRANGLER = join(import.meta.dirname, "../../node_modules/.bin/wrangler");

const defaultDeps: MainDeps = {
  spawn: async (command) => {
    const proc = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
    return await proc.exited;
  },
  now: Date.now,
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
  let args: BlockArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    deps.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const sql = buildSql(args.command, deps.now());
  deps.log(sql);
  if (args.command.kind === "link") deps.log(CACHE_NOTE);
  if (args.dryRun) return 0;
  if (!args.local && args.command.kind !== "host" && !args.yes) {
    deps.error("This deletes remote data: re-run with --yes");
    return 1;
  }
  if (!deps.exists(deps.wrangler)) {
    deps.error("wrangler not found: run `bun install` first");
    return 1;
  }
  try {
    return await deps.spawn([deps.wrangler, ...wranglerArgs(sql, args.local).slice(1)]);
  } catch (error) {
    deps.error(`Could not run wrangler: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
