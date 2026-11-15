// Fresh visits: everything Analytics Engine has that the rollup has not written to D1 yet.

import { MAX_FRESH_PAGES } from "./ae-source";
import { nextDay, startCursor } from "./day";
import type { RollupCursor, VisitRow, VisitSource } from "./ports";

export const DEFAULT_FRESH_TTL = 300;
const DAY_PAGE_SIZE = 10_000;
/** A failed read is cached briefly too, so an AE outage does not turn every stats request into a query. */
const PARTIAL_TTL = 30;
/** Above this many rows a stats request spends noticeable CPU merging fresh visits. */
export const FRESH_ROWS_WARN_THRESHOLD = 20_000;

export interface FreshData {
  /** Groups for all links; a group can appear twice (once for the cursor day, once after it). */
  rows: VisitRow[];
  /** True when the SQL API failed: the caller then shows D1 stats only. */
  partial: boolean;
}

export interface FreshDeps {
  source: VisitSource;
  /** The cursor read in the same D1 batch as `link_stats`. */
  cursor: RollupCursor | null;
  now: number;
  ttlSeconds: number;
  cache?: Cache;
}

/** `AE_FRESH_TTL` in seconds as a positive integer, falling back to 300. */
export function parseFreshTtl(value: string | undefined): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : DEFAULT_FRESH_TTL;
}

/** The cursor is part of the key, so a moved cursor never reads rows that D1 already holds. */
export function freshCacheKey(at: RollupCursor): string {
  return `https://fresh.invalid/v1/${at.day}/${at.offset}`;
}

async function queryFresh(source: VisitSource, at: RollupCursor): Promise<VisitRow[]> {
  const rows: VisitRow[] = [];
  for (let n = 0; ; n++) {
    if (n === MAX_FRESH_PAGES)
      throw new Error("fresh data for the cursor day exceeds the page budget");
    const page = await source.queryDay(at.day, at.offset + n * DAY_PAGE_SIZE, DAY_PAGE_SIZE);
    rows.push(...page);
    if (page.length < DAY_PAGE_SIZE) break;
  }
  rows.push(...(await source.querySince(nextDay(at.day))));
  return rows;
}

function isVisitRow(value: unknown): value is VisitRow {
  const r = value as Record<string, unknown> | null;
  const coord = (c: unknown) => c === null || (typeof c === "number" && Number.isFinite(c));
  return (
    typeof r === "object" &&
    r !== null &&
    typeof r.linkId === "string" &&
    typeof r.country === "string" &&
    typeof r.city === "string" &&
    typeof r.visits === "number" &&
    Number.isSafeInteger(r.visits) &&
    coord(r.lat) &&
    coord(r.lon)
  );
}

function isFreshData(value: unknown): value is FreshData {
  const v = value as Record<string, unknown> | null;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.partial === "boolean" &&
    Array.isArray(v.rows) &&
    v.rows.every(isVisitRow)
  );
}

/**
 * Day D from the cursor offset plus everything from D+1 on, cached for `ttlSeconds` under the
 * cursor. A failing source gives `{rows: [], partial: true}`, cached for 30 seconds. A cached
 * entry with an unexpected shape is ignored and fetched again.
 */
export async function loadFresh({
  source,
  cursor,
  now,
  ttlSeconds,
  cache = caches.default,
}: FreshDeps): Promise<FreshData> {
  const at = cursor ?? startCursor(now);
  const key = freshCacheKey(at);
  try {
    const hit = await cache.match(key);
    if (hit) {
      const cached: unknown = await hit.json();
      if (isFreshData(cached)) return cached;
    }
  } catch {
    // a cache failure only costs a query
  }
  let result: FreshData;
  try {
    result = { rows: await queryFresh(source, at), partial: false };
    if (result.rows.length > FRESH_ROWS_WARN_THRESHOLD) {
      console.warn(`fresh visits returned ${result.rows.length} rows`);
    }
  } catch (error) {
    console.warn("fresh visits unavailable", error instanceof Error ? error.message : error);
    result = { rows: [], partial: true };
  }
  try {
    await cache.put(
      key,
      new Response(JSON.stringify(result), {
        headers: {
          "content-type": "application/json",
          "cache-control": `max-age=${result.partial ? PARTIAL_TTL : ttlSeconds}`,
        },
      }),
    );
  } catch {
    // serve uncached
  }
  return result;
}
