import { createScheduledController } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, expect, it } from "vitest";
import { ARCHIVE_MS, EXPIRED_BATCH, MAX_EXPIRED_BATCHES, runDaily } from "../../src/cron/daily";
import { globalStats, insertLink, readCursor, upsertStatsBatch } from "../../src/db/queries";
import worker from "../../src/index";

const db = env.DB;
const DAY1 = Date.parse("2026-11-14T00:00:00Z");
const DAY2 = Date.parse("2026-11-15T00:00:00Z");

async function addLink(id: string, expiresAt: number | null) {
  await insertLink(db, {
    id,
    target: "https://example.com/",
    secretHash: null,
    expiresAt,
    createdAt: DAY1 - 86_400_000,
    isCustom: false,
  });
}

async function linkIds(): Promise<string[]> {
  const { results } = await db.prepare("SELECT id FROM links ORDER BY id").all<{ id: string }>();
  return results.map((r) => r.id);
}

function cron(scheduledTime: number) {
  return worker.scheduled(createScheduledController({ scheduledTime }), env);
}

beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM link_stats"),
    db.prepare("DELETE FROM links"),
    db.prepare("DELETE FROM deleted_links"),
    db.prepare("DELETE FROM meta"),
    db.prepare("DELETE FROM global_stats"),
  ]);
});

const H = 3_600_000;

it("without analytics configured the daily step runs once per UTC day after 01:00", async () => {
  await addLink("old", DAY1 - 1);
  await addLink("live", null);
  await upsertStatsBatch(
    db,
    [
      {
        linkId: "live",
        createdAt: DAY1 - 86_400_000,
        country: "PL",
        city: "",
        visits: 7,
        lat: null,
        lon: null,
      },
    ],
    null,
    { day: "2026-11-13", offset: 0 },
  );

  // Before 01:00 UTC yesterday is not closed yet.
  await cron(DAY1 + 60_000);
  expect(await linkIds()).toEqual(["live", "old"]);
  expect(await globalStats(db)).toBeNull();

  await cron(DAY1 + H);
  expect(await linkIds()).toEqual(["live"]);
  expect(await globalStats(db)).toEqual({
    links: 1,
    visits: 7,
    countries: [{ code: "PL", visits: 7 }],
    updatedAt: DAY1 + H,
  });

  // Later hours of the same day skip the daily step.
  await addLink("old2", DAY1);
  await cron(DAY1 + 2 * H);
  expect(await linkIds()).toEqual(["live", "old2"]);
  expect((await globalStats(db))?.updatedAt).toBe(DAY1 + H);

  // The next day it runs again.
  await cron(DAY2 + H);
  expect(await linkIds()).toEqual(["live"]);
  expect((await globalStats(db))?.updatedAt).toBe(DAY2 + H);
});

it("without CF_AE_TOKEN the cron skips the rollup and leaves the cursor alone", async () => {
  await cron(DAY1 + H);
  expect(await readCursor(db)).toBeNull();

  await upsertStatsBatch(db, [], null, { day: "2026-11-12", offset: 0 });
  await cron(DAY1 + 2 * H);
  expect(await readCursor(db)).toEqual({ day: "2026-11-12", offset: 0 });
});

it("with analytics configured global_stats waits for the rollup cursor, deleteExpired does not", async () => {
  await addLink("old", DAY1 - 1);
  const none = { expired: false, globalStats: false };

  expect(await runDaily(db, DAY1 + 30 * 60_000, true)).toEqual(none);
  expect(await linkIds()).toEqual(["old"]);

  // Cursor stuck at yesterday (AE failing): expired links still go, once that day.
  await upsertStatsBatch(db, [], null, { day: "2026-11-13", offset: 0 });
  expect(await runDaily(db, DAY1 + H, true)).toEqual({ expired: true, globalStats: false });
  expect(await linkIds()).toEqual([]);
  expect(await globalStats(db)).toBeNull();
  await addLink("old2", DAY1);
  expect(await runDaily(db, DAY1 + 2 * H, true)).toEqual(none);
  expect(await linkIds()).toEqual(["old2"]);

  // The rollup catches up: global_stats runs once.
  await upsertStatsBatch(
    db,
    [],
    { day: "2026-11-13", offset: 0 },
    { day: "2026-11-14", offset: 0 },
  );
  expect(await runDaily(db, DAY1 + 3 * H, true)).toEqual({ expired: false, globalStats: true });
  expect((await globalStats(db))?.updatedAt).toBe(DAY1 + 3 * H);
  expect(await runDaily(db, DAY1 + 4 * H, true)).toEqual(none);
});

it("clears a backlog over several hourly runs and writes the day marker only after a short batch", async () => {
  const perRun = EXPIRED_BATCH * MAX_EXPIRED_BATCHES;
  const total = 2 * perRun + 200;
  await db
    .prepare(
      `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ?1)
       INSERT INTO links (id, target, target_host, expires_at, created_at, is_custom)
       SELECT 'e' || i, 'https://example.com/', 'example.com', ?2 - i, 0, 0 FROM n`,
    )
    .bind(total, DAY1 - 1)
    .run();
  const count = async () =>
    (await db.prepare("SELECT COUNT(*) AS n FROM links").first<{ n: number }>())?.n ?? -1;

  // A full last batch leaves the marker unset, so the next hour continues.
  expect((await runDaily(db, DAY1 + H, false)).expired).toBe(false);
  expect(await count()).toBe(total - perRun);
  expect((await runDaily(db, DAY1 + 2 * H, false)).expired).toBe(false);
  expect(await count()).toBe(total - 2 * perRun);

  // The third run ends on a short batch: marker written, later hours skip.
  expect((await runDaily(db, DAY1 + 3 * H, false)).expired).toBe(true);
  expect(await count()).toBe(0);
  await addLink("late", DAY1);
  expect((await runDaily(db, DAY1 + 4 * H, false)).expired).toBe(false);
  expect(await count()).toBe(1);
});

it("a backlog of exactly one full run needs one more run to see the short batch", async () => {
  const perRun = EXPIRED_BATCH * MAX_EXPIRED_BATCHES;
  await db
    .prepare(
      `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ?1)
       INSERT INTO links (id, target, target_host, expires_at, created_at, is_custom)
       SELECT 'e' || i, 'https://example.com/', 'example.com', ?2 - i, 0, 0 FROM n`,
    )
    .bind(perRun, DAY1 - 1)
    .run();
  expect((await runDaily(db, DAY1 + H, false)).expired).toBe(false);
  expect((await runDaily(db, DAY1 + 2 * H, false)).expired).toBe(true);
});

async function archived(): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT target FROM deleted_links ORDER BY deleted_at")
    .all<{ target: string }>();
  return results.map((r) => r.target);
}

async function archive(target: string, deletedAt: number) {
  await db
    .prepare(
      `INSERT INTO deleted_links (id, target, target_host, expires_at, created_at, is_custom,
         deleted_at, visits, countries) VALUES ('gone', ?, 'example.com', NULL, 0, 0, ?, 0, '[]')`,
    )
    .bind(target, deletedAt)
    .run();
}

it("purges archive rows older than 30 days and keeps the rest", async () => {
  const now = DAY1 + H;
  await archive("https://example.com/old", now - ARCHIVE_MS - 1);
  await archive("https://example.com/edge", now - ARCHIVE_MS);
  await archive("https://example.com/new", now - 1);
  expect((await runDaily(db, now, false)).expired).toBe(true);
  expect(await archived()).toEqual(["https://example.com/edge", "https://example.com/new"]);
  // 30 days later the rest has aged out too.
  expect((await runDaily(db, now + ARCHIVE_MS, false)).expired).toBe(true);
  expect(await archived()).toEqual([]);
});

it("does not archive links removed by the expired cleanup", async () => {
  await addLink("old", DAY1 - 1);
  await cron(DAY1 + H);
  expect(await linkIds()).toEqual([]);
  expect(await archived()).toEqual([]);
});

it("purges the archive in batches with the budget the expired cleanup leaves", async () => {
  const now = DAY1 + H;
  const total = MAX_EXPIRED_BATCHES * EXPIRED_BATCH + 10;
  await db
    .prepare(
      `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ?1)
       INSERT INTO deleted_links (id, target, target_host, expires_at, created_at, is_custom,
         deleted_at, visits, countries)
       SELECT 'd' || i, 'https://example.com/', 'example.com', NULL, 0, 0, ?2 - i, 0, '[]' FROM n`,
    )
    .bind(total, now - ARCHIVE_MS - 1)
    .run();
  const count = async () =>
    (await db.prepare("SELECT COUNT(*) AS n FROM deleted_links").first<{ n: number }>())?.n ?? -1;
  // One short expired batch leaves the other batches to the archive; all full, so not finished.
  expect((await runDaily(db, now, false)).expired).toBe(false);
  expect(await count()).toBe(total - (MAX_EXPIRED_BATCHES - 1) * EXPIRED_BATCH);
  expect((await runDaily(db, now + H, false)).expired).toBe(true);
  expect(await count()).toBe(0);
});
