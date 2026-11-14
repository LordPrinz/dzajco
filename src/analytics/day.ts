// UTC day arithmetic for the rollup cursor. A day is always a real `YYYY-MM-DD` date.

import type { RollupCursor } from "./ports";

const DAY_MS = 86_400_000;
/** Day D closes at D+1 01:00 UTC, which leaves an hour for Analytics Engine ingest delay. */
const CLOSE_AFTER_MS = DAY_MS + 3_600_000;

/** Start of `day` in unix ms. Throws unless `day` is an existing `YYYY-MM-DD` date. */
export function dayStart(day: string): number {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Day must be YYYY-MM-DD");
  }
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(ms) || dayOf(ms) !== day) throw new Error("Day does not exist");
  return ms;
}

export function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function nextDay(day: string): string {
  return dayOf(dayStart(day) + DAY_MS);
}

export function isDayClosed(day: string, now: number): boolean {
  return now >= dayStart(day) + CLOSE_AFTER_MS;
}

/** Where the rollup starts before it has written a cursor: the previous UTC day, offset 0. */
export function startCursor(now: number): RollupCursor {
  return { day: dayOf(now - DAY_MS), offset: 0 };
}
