// Daily cron steps. The cron fires hourly; a `meta` row per step remembers the last UTC day it
// finished. Both steps wait until yesterday is closed (01:00 UTC). The cleanup step (`deleteExpired`,
// then `purgeDeletedLinks`) then runs no matter what, so expired links do not pile up while Analytics
// Engine is failing. Expired links are dropped, not archived: only owner deletes go to
// `deleted_links`. `global_stats` also waits, when analytics is configured, until the rollup has
// written yesterday to D1.

import { dayOf, isDayClosed } from "../analytics/day";
import { deleteExpired, purgeDeletedLinks, readCursor, recomputeGlobalStats } from "../db/queries";

// The stored marker keeps its old name, so a deploy does not repeat a cleanup that already ran today.
const CLEANUP_KEY = "daily_expired";
const GLOBAL_KEY = "daily_global_stats";
export const CLEANUP_BATCH = 500;
// One run deletes at most this many batches: expired links get all but the last, and the archive purge
// always gets the last one (plus any the expired links leave unused), so an expired backlog cannot hold
// archive rows past their 30 days. The Free plan allows 50 subrequests per invocation. At
// ROLLUP_MAX_PAGES = 20 the rollup uses 40 (20 SQL API fetches + 20 D1 batches) and the rest of the
// run about 7 D1 queries (marker reads and writes, cursor read, global_stats), so 3 batches make 50.
export const MAX_CLEANUP_BATCHES = 3;

const DAY_MS = 86_400_000;
/** How long `deleted_links` keeps a link deleted by its owner. */
export const ARCHIVE_MS = 30 * DAY_MS;

/**
 * Runs `step` unless the marker under `key` already says `today`. The marker is written after the step
 * succeeds, unless it returns `false` (not finished): then the next hourly run continues.
 */
async function oncePerDay(
  db: D1Database,
  key: string,
  today: string,
  step: () => Promise<unknown>,
): Promise<boolean> {
  const last = await db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (last?.value === today) return false;
  // Both steps are idempotent, so a crash before the marker is written just repeats them next hour.
  if ((await step()) === false) return false;
  await db
    .prepare(
      "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    )
    .bind(key, today)
    .run();
  return true;
}

export async function runDaily(
  db: D1Database,
  now: number,
  analyticsConfigured: boolean,
): Promise<{ expired: boolean; globalStats: boolean }> {
  const today = dayOf(now);
  if (!isDayClosed(dayOf(now - DAY_MS), now)) return { expired: false, globalStats: false };
  const expired = await oncePerDay(db, CLEANUP_KEY, today, async () => {
    let batches = 0;
    let expiredDone = false;
    while (!expiredDone && batches < MAX_CLEANUP_BATCHES - 1) {
      batches++;
      expiredDone = (await deleteExpired(db, now, CLEANUP_BATCH)).length < CLEANUP_BATCH;
    }
    let purgeDone = false;
    while (!purgeDone && batches < MAX_CLEANUP_BATCHES) {
      batches++;
      purgeDone = (await purgeDeletedLinks(db, now - ARCHIVE_MS, CLEANUP_BATCH)) < CLEANUP_BATCH;
    }
    // A full last batch on either side means more may be waiting: the next hourly run continues.
    return expiredDone && purgeDone;
  });
  if (analyticsConfigured) {
    const cursor = await readCursor(db);
    if (!cursor || cursor.day < today) return { expired, globalStats: false };
  }
  const globalStats = await oncePerDay(db, GLOBAL_KEY, today, () => recomputeGlobalStats(db, now));
  return { expired, globalStats };
}
