// Hourly rollup of Analytics Engine visits into D1, one page of groups at a time.

import { isDayClosed, nextDay, startCursor } from "../analytics/day";
import type { RollupCursor, VisitRow, VisitSource } from "../analytics/ports";
import { readCursor, upsertStatsBatch } from "../db/queries";

export const PAGE_SIZE = 500;
export const DEFAULT_MAX_PAGES = 10;

export interface RollupStore {
  readCursor(): Promise<RollupCursor | null>;
  /** Writes the page and moves the cursor `from` -> `to` atomically; false when `from` is stale. */
  applyPage(
    rows: readonly VisitRow[],
    from: RollupCursor | null,
    to: RollupCursor,
  ): Promise<boolean>;
}

export function d1RollupStore(db: D1Database): RollupStore {
  return {
    readCursor: () => readCursor(db),
    applyPage: (rows, from, to) => upsertStatsBatch(db, rows, from, to),
  };
}

export interface RollupDeps {
  store: RollupStore;
  source: VisitSource;
  now: number;
  maxPages: number;
}

/**
 * Rolls up closed days page by page, at most `maxPages` pages. A page shorter than `PAGE_SIZE`
 * ends its day and moves the cursor to the next day at offset 0. Stops early at a day that is not
 * closed yet, or when a page did not apply (another run moved the cursor first).
 */
export async function runRollup({ store, source, now, maxPages }: RollupDeps): Promise<{
  pages: number;
  cursor: RollupCursor | null;
}> {
  let stored = await store.readCursor();
  let pages = 0;
  while (pages < maxPages) {
    const at = stored ?? startCursor(now);
    if (!isDayClosed(at.day, now)) break;
    const rows = await source.queryDay(at.day, at.offset, PAGE_SIZE);
    const next: RollupCursor =
      rows.length < PAGE_SIZE
        ? { day: nextDay(at.day), offset: 0 }
        : { day: at.day, offset: at.offset + rows.length };
    if (!(await store.applyPage(rows, stored, next))) break;
    stored = next;
    pages++;
  }
  return { pages, cursor: stored };
}

/** Each page costs 2 subrequests (SQL API + D1 batch); 20 pages stay well inside the Free 50. */
export const MAX_PAGES_LIMIT = 20;

/** `ROLLUP_MAX_PAGES` clamped to 1..20; anything that is not an integer gives the default. */
export function parseMaxPages(value: string | undefined): number {
  const n = Number(value);
  if (value === undefined || value.trim() === "" || !Number.isSafeInteger(n)) {
    return DEFAULT_MAX_PAGES;
  }
  return Math.min(Math.max(n, 1), MAX_PAGES_LIMIT);
}
