import type { RollupCursor, VisitRow } from "../analytics/ports";
import { roundCoord } from "../domain/geo";
import { normalizeHost, normalizeHostname } from "../domain/host";

export class IdTakenError extends Error {
  constructor(id: string) {
    super(`Link id already taken: ${id}`);
    this.name = "IdTakenError";
  }
}

const CURSOR_KEY = "rollup_cursor";
const MAX_EXPIRED_BATCH = 1000;

export interface NewLink {
  id: string;
  target: string;
  secretHash: string | null;
  expiresAt: number | null;
  createdAt: number;
  isCustom: boolean;
}

export interface LinkRecord {
  id: string;
  target: string;
  expiresAt: number | null;
  blocked: boolean;
}

export interface OwnerLink {
  id: string;
  target: string;
  secretHash: string | null;
  expiresAt: number | null;
}

export interface CountryStat {
  code: string;
  visits: number;
}

export interface CityStat {
  country: string;
  city: string;
  lat: number | null;
  lon: number | null;
  visits: number;
}

export interface PublicStats {
  cursor: RollupCursor | null;
  visits: number;
  countries: CountryStat[];
}

export interface OwnerStats extends PublicStats {
  cities: CityStat[];
}

export interface GlobalStats {
  links: number;
  visits: number;
  /** Top 20 countries by visits. */
  countries: CountryStat[];
  updatedAt: number;
}

function isUniqueViolation(error: unknown): boolean {
  const text = `${error instanceof Error ? error.message : ""} ${
    (error as { cause?: { message?: string } } | null)?.cause?.message ?? ""
  }`;
  return /UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(text);
}

function parseCursor(value: string | null | undefined): RollupCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<RollupCursor>;
    if (typeof parsed.day === "string" && Number.isInteger(parsed.offset)) {
      return { day: parsed.day, offset: parsed.offset as number };
    }
  } catch {
    // fall through: a corrupt cursor reads as missing
  }
  return null;
}

export async function insertLink(db: D1Database, link: NewLink): Promise<void> {
  const targetHost = normalizeHostname(new URL(link.target).hostname);
  try {
    await db
      .prepare(
        "INSERT INTO links (id, target, target_host, secret_hash, expires_at, created_at, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        link.id,
        link.target,
        targetHost,
        link.secretHash,
        link.expiresAt,
        link.createdAt,
        link.isCustom ? 1 : 0,
      )
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) throw new IdTakenError(link.id);
    throw error;
  }
}

/**
 * A recursive CTE `s(h)` with the host and its parent domains (`a.b.c`, `b.c`, `c`), so the blocklist
 * check is one primary key lookup per label instead of a scan of `blocked_hosts`. A valid host has at
 * most 127 labels; the LIMIT also bounds rows read for anything longer that was stored before.
 */
function suffixCte(seed: string): string {
  return `WITH RECURSIVE s(h) AS (
    SELECT ${seed}
    UNION ALL SELECT substr(h, instr(h, '.') + 1) FROM s WHERE instr(h, '.') > 0
    LIMIT 127
  )`;
}

/** The link plus whether its host, or a parent domain, is in `blocked_hosts`. */
export const LINK_RECORD_SQL = `SELECT l.id, l.target, l.expires_at AS expiresAt,
  EXISTS (
    ${suffixCte("l.target_host")}
    SELECT 1 FROM blocked_hosts b WHERE b.host IN (SELECT h FROM s)
  ) AS blocked
FROM links l WHERE l.id = ?`;

/** The same check for a host that is not stored yet. */
export const HOST_BLOCKED_SQL = `${suffixCte("?1")}
SELECT 1 AS hit FROM blocked_hosts b WHERE b.host IN (SELECT h FROM s) LIMIT 1`;

/** One round trip: the link plus its blocked flag. */
export async function getLinkRecord(db: D1Database, id: string): Promise<LinkRecord | null> {
  const row = await db
    .prepare(LINK_RECORD_SQL)
    .bind(id)
    .first<{ id: string; target: string; expiresAt: number | null; blocked: number }>();
  if (!row) return null;
  return { id: row.id, target: row.target, expiresAt: row.expiresAt, blocked: row.blocked === 1 };
}

export async function getLinkForOwner(db: D1Database, id: string): Promise<OwnerLink | null> {
  const row = await db
    .prepare(
      "SELECT id, target, secret_hash AS secretHash, expires_at AS expiresAt FROM links WHERE id = ?",
    )
    .bind(id)
    .first<OwnerLink>();
  return row ?? null;
}

/**
 * Deletes a link when `verify` accepts the stored hash. The comparison stays in the caller
 * (versioned HMAC cannot be compared in SQL); the DELETE re-checks the hash it verified, so a
 * concurrent change cannot slip through. Links without a hash can never be deleted this way.
 */
export async function deleteLink(
  db: D1Database,
  id: string,
  verify: (storedHash: string) => Promise<boolean>,
): Promise<"deleted" | "forbidden" | "not_found"> {
  const link = await getLinkForOwner(db, id);
  if (!link) return "not_found";
  if (link.secretHash === null || !(await verify(link.secretHash))) return "forbidden";
  const result = await db
    .prepare("DELETE FROM links WHERE id = ? AND secret_hash = ?")
    .bind(id, link.secretHash)
    .run();
  // The hash changed between the read and the delete: treat as a failed verification.
  return result.meta.changes > 0 ? "deleted" : "forbidden";
}

export async function readCursor(db: D1Database): Promise<RollupCursor | null> {
  const row = await db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .bind(CURSOR_KEY)
    .first<{ value: string }>();
  return parseCursor(row?.value);
}

/**
 * Applies one rollup page and moves the cursor in a single batch. Every upsert only runs while the
 * stored cursor still equals `from` (compared by field, not by text), so replaying a page that
 * already landed changes nothing and returns `false`. Rows for links deleted in the meantime are
 * skipped without failing the batch; rows with a non-positive or non-integer count are dropped.
 */
export async function upsertStatsBatch(
  db: D1Database,
  rows: readonly VisitRow[],
  from: RollupCursor | null,
  to: RollupCursor,
): Promise<boolean> {
  const fromDay = from?.day ?? null;
  const fromOffset = from?.offset ?? null;
  const cursorMatches = `(SELECT json_extract(value, '$.day') FROM meta WHERE key = ?1) IS ?2
     AND (SELECT json_extract(value, '$.offset') FROM meta WHERE key = ?1) IS ?3`;
  const upsert = db.prepare(
    `INSERT INTO link_stats (link_id, country, city, lat, lon, visits)
     SELECT ?4, ?5, ?6, ?7, ?8, ?9
     WHERE EXISTS (SELECT 1 FROM links WHERE id = ?4) AND ${cursorMatches}
     ON CONFLICT (link_id, country, city) DO UPDATE SET
       -- Weighted by all visits: D1 does not track visits-with-coords (small drift vs the live merge).
       lat = CASE WHEN excluded.lat IS NULL THEN lat WHEN lat IS NULL THEN excluded.lat
         ELSE round((lat * visits + excluded.lat * excluded.visits) / (visits + excluded.visits), 2) END,
       lon = CASE WHEN excluded.lon IS NULL THEN lon WHEN lon IS NULL THEN excluded.lon
         ELSE round((lon * visits + excluded.lon * excluded.visits) / (visits + excluded.visits), 2) END,
       visits = visits + excluded.visits`,
  );
  const statements = rows
    .filter((r) => Number.isInteger(r.visits) && r.visits > 0)
    .map((r) =>
      upsert.bind(
        CURSOR_KEY,
        fromDay,
        fromOffset,
        r.linkId,
        r.country,
        r.city,
        roundCoord(r.lat),
        roundCoord(r.lon),
        r.visits,
      ),
    );
  statements.push(
    db
      .prepare(
        `INSERT INTO meta (key, value) SELECT ?1, ?4 WHERE ${cursorMatches}
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      )
      .bind(CURSOR_KEY, fromDay, fromOffset, JSON.stringify(to)),
  );
  const results = await db.batch(statements);
  return (results[results.length - 1]?.meta.changes ?? 0) > 0;
}

export async function publicStats(db: D1Database, id: string): Promise<PublicStats> {
  const [cursorRes, countryRes] = await db.batch([
    db.prepare("SELECT value FROM meta WHERE key = ?").bind(CURSOR_KEY),
    db
      .prepare(
        "SELECT country AS code, SUM(visits) AS visits FROM link_stats WHERE link_id = ? GROUP BY country ORDER BY visits DESC, country",
      )
      .bind(id),
  ]);
  const countries = (countryRes?.results ?? []) as unknown as CountryStat[];
  return {
    cursor: parseCursor((cursorRes?.results?.[0] as { value: string } | undefined)?.value),
    visits: countries.reduce((sum, c) => sum + c.visits, 0),
    countries,
  };
}

/**
 * Includes city coordinates and the stored secret hash, so one batch serves the owner view: the
 * caller must verify the key against `secretHash` before it returns anything. `found` is false
 * when the link no longer exists.
 */
export async function ownerStats(
  db: D1Database,
  id: string,
): Promise<OwnerStats & { found: boolean; secretHash: string | null }> {
  const [cursorRes, countryRes, cityRes, linkRes] = await db.batch([
    db.prepare("SELECT value FROM meta WHERE key = ?").bind(CURSOR_KEY),
    db
      .prepare(
        "SELECT country AS code, SUM(visits) AS visits FROM link_stats WHERE link_id = ? GROUP BY country ORDER BY visits DESC, country",
      )
      .bind(id),
    db
      .prepare(
        "SELECT country, city, lat, lon, visits FROM link_stats WHERE link_id = ? AND city <> '' ORDER BY visits DESC, country, city",
      )
      .bind(id),
    db.prepare("SELECT secret_hash AS secretHash FROM links WHERE id = ?").bind(id),
  ]);
  const linkRow = linkRes?.results?.[0] as { secretHash: string | null } | undefined;
  const countries = (countryRes?.results ?? []) as unknown as CountryStat[];
  return {
    cursor: parseCursor((cursorRes?.results?.[0] as { value: string } | undefined)?.value),
    visits: countries.reduce((sum, c) => sum + c.visits, 0),
    countries,
    cities: (cityRes?.results ?? []) as unknown as CityStat[],
    found: linkRow !== undefined,
    secretHash: linkRow?.secretHash ?? null,
  };
}

export async function globalStats(db: D1Database): Promise<GlobalStats | null> {
  const row = await db
    .prepare(
      "SELECT links, visits, countries, updated_at AS updatedAt FROM global_stats WHERE id = 1",
    )
    .first<{ links: number; visits: number; countries: string | null; updatedAt: number }>();
  if (!row) return null;
  return { ...row, countries: row.countries ? (JSON.parse(row.countries) as CountryStat[]) : [] };
}

/** Recomputes the single `global_stats` row (daily cron step). `countries` is the top 20 by visits, as JSON. */
export async function recomputeGlobalStats(db: D1Database, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO global_stats (id, links, visits, countries, updated_at)
       SELECT 1,
         (SELECT COUNT(*) FROM links),
         COALESCE((SELECT SUM(visits) FROM link_stats), 0),
         (SELECT json_group_array(json_object('code', country, 'visits', v)) FROM (
            SELECT country, SUM(visits) AS v FROM link_stats GROUP BY country ORDER BY v DESC, country LIMIT 20)),
         ?
       ON CONFLICT (id) DO UPDATE SET links = excluded.links, visits = excluded.visits,
         countries = excluded.countries, updated_at = excluded.updated_at`,
    )
    .bind(now)
    .run();
}

/** Deletes up to `limit` links with `expires_at <= now` (oldest first); returns their ids. link_stats cascade. */
export async function deleteExpired(db: D1Database, now: number, limit: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `DELETE FROM links WHERE id IN (
         SELECT id FROM links WHERE expires_at IS NOT NULL AND expires_at <= ?1 ORDER BY expires_at LIMIT ?2
       ) RETURNING id`,
    )
    .bind(now, Math.min(Math.max(1, Math.trunc(limit) || 1), MAX_EXPIRED_BATCH))
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/** Deletes one link only if it has expired (`expires_at <= now`); lazy cleanup on the redirect path. */
export async function deleteIfExpired(db: D1Database, id: string, now: number): Promise<void> {
  await db
    .prepare("DELETE FROM links WHERE id = ? AND expires_at IS NOT NULL AND expires_at <= ?")
    .bind(id, now)
    .run();
}

export async function blockHost(
  db: D1Database,
  host: string,
  reason: string | null,
  now: number,
): Promise<void> {
  await db
    .prepare("INSERT OR REPLACE INTO blocked_hosts (host, reason, created_at) VALUES (?, ?, ?)")
    .bind(normalizeHost(host), reason, now)
    .run();
}

/**
 * True when the host, or any parent domain of it, is in `blocked_hosts`. Throws on input that is
 * not a bare host (or longer than 253 characters); callers must treat an error as blocked.
 */
export async function isHostBlocked(db: D1Database, host: string): Promise<boolean> {
  const normalized = normalizeHost(host);
  const row = await db.prepare(HOST_BLOCKED_SQL).bind(normalized).first();
  return row !== null;
}
