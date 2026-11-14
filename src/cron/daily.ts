// Daily cron steps. The cron fires hourly; a `meta` row per step remembers the last UTC day it
// finished. Both steps wait until yesterday is closed (01:00 UTC). `deleteExpired` then runs no
// matter what, so expired links do not pile up while Analytics Engine is failing. `global_stats`
// also waits, when analytics is configured, until the rollup has written yesterday to D1.

import { dayOf, isDayClosed } from "../analytics/day";
import { deleteExpired, readCursor, recomputeGlobalStats } from "../db/queries";

const EXPIRED_KEY = "daily_expired";
const GLOBAL_KEY = "daily_global_stats";
export const EXPIRED_BATCH = 500;

const DAY_MS = 86_400_000;

/** Runs `step` unless the marker under `key` already says `today`; the marker is written after it succeeds. */
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
  await step();
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
  const expired = await oncePerDay(db, EXPIRED_KEY, today, () =>
    deleteExpired(db, now, EXPIRED_BATCH),
  );
  if (analyticsConfigured) {
    const cursor = await readCursor(db);
    if (!cursor || cursor.day < today) return { expired, globalStats: false };
  }
  const globalStats = await oncePerDay(db, GLOBAL_KEY, today, () => recomputeGlobalStats(db, now));
  return { expired, globalStats };
}
