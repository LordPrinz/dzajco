// Pure part of the v2 (MongoDB) to D1 migration: turns v2 link documents into D1 rows and SQL.
// No Node or Bun APIs here, so the worker test can run it inside workerd.

import { normalizeHostname } from "../../src/domain/host";
import { isReserved, LOOKUP_ID } from "../../src/domain/ids";
import { hashSecret, type Peppers } from "../../src/domain/secret";
import { MAX_URL_LENGTH, parseTarget, type TargetError } from "../../src/domain/url-policy";
import { sqlString } from "../lib/sql";

export interface LinkRow {
  id: string;
  target: string;
  targetHost: string;
  secretHash: string | null;
  expiresAt: number | null;
  createdAt: number;
  isCustom: boolean;
}

export type InvalidReason =
  | "invalid_document"
  | "invalid_id"
  | "invalid_url"
  | "url_too_long"
  | "unsupported_scheme"
  | "credentials_not_allowed"
  | "invalid_expire";

export interface MigrationReport {
  read: number;
  /** Rows written to the SQL. `INSERT OR IGNORE` skips ids that already exist in D1. */
  inserted: number;
  skippedExpired: number;
  skippedInvalid: number;
  reservedCollisions: string[];
  duplicates: string[];
  /** Imported links that carry a v2 key (hashed as it is). */
  legacyKeys: number;
  insertedIds: string[];
  expiredIds: string[];
  invalid: { id: string; reason: InvalidReason }[];
  /** Imported `www.` targets that had no scheme and got `https://`. */
  schemeAdded: string[];
  /** Imported links the v3 creation policy would refuse; review them and `admin:block` if needed. */
  policyFlags: { id: string; code: TargetError }[];
}

export interface TransformOptions {
  now: number;
  version: number;
  peppers: Peppers;
  /** Hosts of this deployment, for the report-only policy check. */
  ownHosts: readonly string[];
}

/** v2 random ids came from `nanoid(3..10)`; anything else was a custom name. */
const RANDOM_ID = /^[A-Za-z0-9_-]{3,10}$/;
/** v2 stripped zero-width spaces from the target before redirecting. */
const ZERO_WIDTH_SPACE = /\u200b/g;
const COLUMNS = "id, target, target_host, secret_hash, expires_at, created_at, is_custom";
/** Statements per SQL file, so one `wrangler d1 execute --file` stays small. */
export const BATCH_SIZE = 200;

/** v2 stored custom names as `encodeURIComponent(name)`. A malformed escape keeps the raw id. */
export function decodeId(raw: string): string {
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // keep the raw id
  }
  return id.normalize("NFC");
}

export function isRandomId(id: string): boolean {
  return RANDOM_ID.test(id);
}

/** null for "never"; undefined when the value is not a date. Reads driver Dates and Extended JSON. */
export function expiryMillis(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  let ms: number;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === "string") ms = Date.parse(value);
  else if (typeof value === "object" && "$date" in value) {
    const date = (value as { $date: unknown }).$date;
    if (typeof date === "string") ms = Date.parse(date);
    else if (typeof date === "number") ms = date;
    else if (date && typeof date === "object" && "$numberLong" in date) {
      ms = Number((date as { $numberLong: unknown }).$numberLong);
    } else return undefined;
  } else return undefined;
  return Number.isFinite(ms) ? Math.trunc(ms) : undefined;
}

/** Code point order, so the same documents sort the same whatever their source. */
export function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a, (c) => c.codePointAt(0) as number);
  const right = Array.from(b, (c) => c.codePointAt(0) as number);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return (left[i] as number) - (right[i] as number);
  }
  return left.length - right.length;
}

/** Documents with a string `_id` first, in code point order; the rest keep their input order. */
function sortById(docs: Iterable<unknown>): unknown[] {
  const rawId = (doc: unknown) =>
    typeof doc === "object" && doc !== null && typeof (doc as { _id?: unknown })._id === "string"
      ? ((doc as { _id: string })._id as string)
      : null;
  return [...docs].sort((a, b) => {
    const x = rawId(a);
    const y = rawId(b);
    if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
    return compareCodePoints(x, y);
  });
}

type TargetResult =
  | { ok: true; target: string; host: string; schemeAdded: boolean }
  | { ok: false; reason: InvalidReason };

function readTarget(value: unknown): TargetResult {
  if (typeof value !== "string") return { ok: false, reason: "invalid_url" };
  let input = value.replace(ZERO_WIDTH_SPACE, "").trim();
  // v2 accepted `www.example.com` without a scheme.
  const schemeAdded = /^www\./i.test(input) && !input.includes("://");
  if (schemeAdded) input = `https://${input}`;
  if (input.length > MAX_URL_LENGTH) return { ok: false, reason: "url_too_long" };
  if (!URL.canParse(input)) return { ok: false, reason: "invalid_url" };
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsupported_scheme" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "credentials_not_allowed" };
  }
  if (url.href.length > MAX_URL_LENGTH) return { ok: false, reason: "url_too_long" };
  const host = normalizeHostname(url.hostname);
  if (host === "") return { ok: false, reason: "invalid_url" };
  return { ok: true, target: url.href, host, schemeAdded };
}

export async function transformLinks(
  docs: Iterable<unknown>,
  options: TransformOptions,
): Promise<{ rows: LinkRow[]; report: MigrationReport }> {
  if (!options.peppers[options.version]) {
    throw new Error(`Missing secret pepper for version ${options.version}`);
  }
  const report: MigrationReport = {
    read: 0,
    inserted: 0,
    skippedExpired: 0,
    skippedInvalid: 0,
    reservedCollisions: [],
    duplicates: [],
    legacyKeys: 0,
    insertedIds: [],
    expiredIds: [],
    invalid: [],
    schemeAdded: [],
    policyFlags: [],
  };
  const rows: LinkRow[] = [];
  const seen = new Set<string>();
  const invalid = (id: string, reason: InvalidReason) => report.invalid.push({ id, reason });

  for (const doc of sortById(docs)) {
    report.read += 1;
    if (typeof doc !== "object" || doc === null) {
      invalid("", "invalid_document");
      continue;
    }
    const { _id, full, expire, secretKey } = doc as Record<string, unknown>;
    if (typeof _id !== "string") {
      invalid(String(JSON.stringify(_id) ?? ""), "invalid_id");
      continue;
    }
    const id = decodeId(_id);
    if (!LOOKUP_ID.test(id)) {
      invalid(id, "invalid_id");
      continue;
    }
    if (isReserved(id)) {
      report.reservedCollisions.push(id);
      continue;
    }
    const target = readTarget(full);
    if (!target.ok) {
      invalid(id, target.reason);
      continue;
    }
    const expiresAt = expiryMillis(expire);
    if (expiresAt === undefined) {
      invalid(id, "invalid_expire");
      continue;
    }
    if (expiresAt !== null && expiresAt <= options.now) {
      report.expiredIds.push(id);
      continue;
    }
    if (seen.has(id)) {
      report.duplicates.push(id);
      continue;
    }
    seen.add(id);
    const hasKey = typeof secretKey === "string" && secretKey !== "";
    rows.push({
      id,
      target: target.target,
      targetHost: target.host,
      secretHash: hasKey ? await hashSecret(secretKey, options) : null,
      expiresAt,
      createdAt: options.now,
      isCustom: !isRandomId(id),
    });
    if (hasKey) report.legacyKeys += 1;
    if (target.schemeAdded) report.schemeAdded.push(id);
    const policy = parseTarget(target.target, { ownHosts: options.ownHosts });
    if (!policy.ok) report.policyFlags.push({ id, code: policy.code });
  }

  report.inserted = rows.length;
  report.insertedIds = rows.map((row) => row.id);
  report.skippedExpired = report.expiredIds.length;
  report.skippedInvalid = report.invalid.length;
  return { rows, report };
}

function sqlInteger(value: number | null): string {
  return value === null ? "NULL" : String(Math.trunc(value));
}

export function rowSql(row: LinkRow): string {
  const values = [
    sqlString(row.id),
    sqlString(row.target),
    sqlString(row.targetHost),
    row.secretHash === null ? "NULL" : sqlString(row.secretHash),
    sqlInteger(row.expiresAt),
    sqlInteger(row.createdAt),
    row.isCustom ? "1" : "0",
  ];
  return `INSERT OR IGNORE INTO links (${COLUMNS}) VALUES (${values.join(", ")});`;
}

/** One statement per line, at most BATCH_SIZE lines per file. */
export function buildSqlFiles(rows: readonly LinkRow[], batchSize: number = BATCH_SIZE): string[] {
  const files: string[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    files.push(
      `${rows
        .slice(i, i + batchSize)
        .map(rowSql)
        .join("\n")}\n`,
    );
  }
  return files;
}
