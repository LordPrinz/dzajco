import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { AeVisitSource } from "../../src/analytics/ae-source";
import { type FreshData, freshCacheKey, loadFresh } from "../../src/analytics/fresh";
import { mergeCountries } from "../../src/analytics/merge";
import type { RollupCursor } from "../../src/analytics/ports";
import { d1RollupStore, PAGE_SIZE, runRollup } from "../../src/cron/rollup";
import { insertLink, publicStats, readCursor, upsertStatsBatch } from "../../src/db/queries";
import { FakeAe, type FakePoint } from "./fake-ae";

const db = env.DB;
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const D = "2026-11-13";
const D1 = "2026-11-14";
const AT_D = Date.parse("2026-11-13T12:00:00Z");
const AT_D1 = Date.parse("2026-11-14T00:30:00Z");
const CLOSED = Date.parse("2026-11-14T01:00:00Z");
const OPEN = CLOSED - 1;

let ae: FakeAe;
let cacheSeq = 0;

function source() {
  return new AeVisitSource({ accountId: ACCOUNT, token: "t", fetch: ae.fetch });
}

function rollup(now: number, maxPages = 10) {
  return runRollup({ store: d1RollupStore(db), source: source(), now, maxPages });
}

async function addLinks(...ids: string[]) {
  for (const id of ids) {
    await insertLink(db, {
      id,
      target: "https://example.com/",
      secretHash: null,
      expiresAt: null,
      createdAt: AT_D,
      isCustom: false,
    });
  }
}

/** `n` groups on link `linkId`, one point each, cities c00000.. so the order is predictable. */
function groups(linkId: string, n: number, at = AT_D): FakePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    linkId,
    createdAt: AT_D,
    country: "PL",
    city: `c${String(i).padStart(5, "0")}`,
    at,
  }));
}

async function d1Total(): Promise<number> {
  const r = await db
    .prepare("SELECT COALESCE(SUM(visits), 0) AS n FROM link_stats")
    .first<{ n: number }>();
  return r?.n ?? 0;
}

function freshTotal(fresh: FreshData, linkId?: string): number {
  return fresh.rows
    .filter((r) => linkId === undefined || r.linkId === linkId)
    .reduce((sum, r) => sum + r.visits, 0);
}

async function newCache(): Promise<Cache> {
  return caches.open(`fresh-test-${++cacheSeq}`);
}

beforeEach(async () => {
  ae = new FakeAe();
  await db.batch([
    db.prepare("DELETE FROM link_stats"),
    db.prepare("DELETE FROM links"),
    db.prepare("DELETE FROM meta"),
    db.prepare("DELETE FROM global_stats"),
  ]);
});

describe("rollup cron", () => {
  it("does not close day D before D+1 01:00 UTC (frozen clock)", async () => {
    await addLinks("a");
    ae.points = groups("a", 3);
    await upsertStatsBatch(db, [], null, { day: D, offset: 0 });

    expect((await rollup(OPEN)).pages).toBe(0);
    expect(ae.queries).toEqual([]);
    expect(await readCursor(db)).toEqual({ day: D, offset: 0 });

    expect((await rollup(CLOSED)).pages).toBe(1);
    expect(await readCursor(db)).toEqual({ day: D1, offset: 0 });
  });

  it("sums _sample_interval, not point counts", async () => {
    await addLinks("a");
    ae.points = [
      {
        linkId: "a",
        createdAt: AT_D,
        country: "PL",
        city: "Warsaw",
        lat: 52.23,
        lon: 21.01,
        at: AT_D,
        sample: 10,
      },
      {
        linkId: "a",
        createdAt: AT_D,
        country: "PL",
        city: "Warsaw",
        lat: 52.23,
        lon: 21.01,
        at: AT_D,
        sample: 3,
      },
    ];
    await rollup(CLOSED);
    expect(ae.queries[0]).toContain("SUM(_sample_interval)");
    const row = await db
      .prepare("SELECT visits, lat, lon FROM link_stats WHERE link_id = 'a'")
      .first();
    expect(row).toEqual({ visits: 13, lat: 52.23, lon: 21.01 });
  });

  it("pages with ORDER BY ... LIMIT 500 OFFSET and writes the cursor with each page", async () => {
    await addLinks("a");
    ae.points = groups("a", PAGE_SIZE + 200);

    await rollup(CLOSED, 1);
    expect(ae.queries[0]).toContain("ORDER BY index1, blob1, blob2");
    expect(ae.queries[0]).toContain("LIMIT 500 OFFSET 0");
    expect(await readCursor(db)).toEqual({ day: D, offset: 500 });
    expect(await d1Total()).toBe(500);

    await rollup(CLOSED, 1);
    expect(ae.queries[1]).toContain("LIMIT 500 OFFSET 500");
    expect(await readCursor(db)).toEqual({ day: D1, offset: 0 });
    expect(await d1Total()).toBe(700);
  });

  it("rerunning the same page does not change the sums", async () => {
    await addLinks("a");
    ae.points = groups("a", PAGE_SIZE + 1);
    const from = await readCursor(db);
    await rollup(CLOSED, 1);
    const rows = await source().queryDay(D, 0, PAGE_SIZE);

    expect(await upsertStatsBatch(db, rows, from, { day: D, offset: PAGE_SIZE })).toBe(false);
    // A concurrent run that read the old cursor cannot apply its page either.
    const stale = d1RollupStore(db);
    const result = await runRollup({
      store: { ...stale, readCursor: async () => from },
      source: source(),
      now: CLOSED,
      maxPages: 10,
    });
    expect(result.pages).toBe(0);
    expect(await d1Total()).toBe(PAGE_SIZE);
    expect(await readCursor(db)).toEqual({ day: D, offset: PAGE_SIZE });
  });

  it("averages coordinates only over points that have them", async () => {
    await addLinks("a");
    ae.points = [
      {
        linkId: "a",
        createdAt: AT_D,
        country: "PL",
        city: "Warsaw",
        lat: 52,
        lon: 21,
        at: AT_D,
        sample: 1,
      },
      {
        linkId: "a",
        createdAt: AT_D,
        country: "PL",
        city: "Warsaw",
        lat: 53,
        lon: 22,
        at: AT_D,
        sample: 3,
      },
      { linkId: "a", createdAt: AT_D, country: "PL", city: "Warsaw", at: AT_D, sample: 5 },
      { linkId: "a", createdAt: AT_D, country: "PL", city: "Nowhere", at: AT_D },
      { linkId: "a", createdAt: AT_D, country: "PL", city: "Nowhere", at: AT_D, sample: 2 },
    ];
    await rollup(CLOSED);
    const { results } = await db
      .prepare("SELECT city, visits, lat, lon FROM link_stats WHERE link_id = 'a' ORDER BY city")
      .all();
    expect(results).toEqual([
      { city: "Nowhere", visits: 3, lat: null, lon: null },
      { city: "Warsaw", visits: 9, lat: 52.75, lon: 21.75 },
    ]);
  });

  it("stores an empty country as ?? and keeps an empty city", async () => {
    await addLinks("a");
    ae.points = [{ linkId: "a", createdAt: AT_D, country: "", city: "", at: AT_D }];
    await rollup(CLOSED);
    const row = await db
      .prepare("SELECT country, city FROM link_stats WHERE link_id = 'a'")
      .first();
    expect(row).toEqual({ country: "??", city: "" });
  });

  it("skips visits of a link deleted before the rollup and moves the cursor on", async () => {
    await addLinks("kept");
    ae.points = [...groups("gone", 2), ...groups("kept", 1)];
    await rollup(CLOSED);
    expect(await d1Total()).toBe(1);
    expect(await readCursor(db)).toEqual({ day: D1, offset: 0 });
  });

  it("12 pages with ROLLUP_MAX_PAGES 10: {D, 5000} after run 1, {D+1, 0} after run 2", async () => {
    await addLinks("a");
    ae.points = groups("a", 11 * PAGE_SIZE + 7);

    expect((await rollup(CLOSED)).pages).toBe(10);
    expect(await readCursor(db)).toEqual({ day: D, offset: 5000 });

    expect((await rollup(CLOSED)).pages).toBe(2);
    expect(await readCursor(db)).toEqual({ day: D1, offset: 0 });
    expect(await d1Total()).toBe(ae.total());
  });
});

describe("an id that was deleted and created again", () => {
  const OLD = AT_D - 86_400_000;

  it("the rollup writes nothing for points of the earlier link", async () => {
    await addLinks("a");
    ae.points = [
      { linkId: "a", createdAt: OLD, country: "PL", city: "Warsaw", at: AT_D, sample: 5 },
      { linkId: "a", createdAt: null, country: "PL", city: "Warsaw", at: AT_D },
      { linkId: "a", createdAt: AT_D, country: "DE", city: "Berlin", at: AT_D, sample: 2 },
    ];
    await rollup(CLOSED);
    expect(await d1Total()).toBe(2);
    expect((await publicStats(db, "a")).countries).toEqual([{ code: "DE", visits: 2 }]);
    expect(await readCursor(db)).toEqual({ day: D1, offset: 0 });
  });

  it("the live merge counts only fresh rows of the current link", async () => {
    await addLinks("a");
    ae.points = [
      { linkId: "a", createdAt: OLD, country: "PL", city: "Warsaw", at: AT_D, sample: 5 },
      { linkId: "a", createdAt: AT_D, country: "DE", city: "Berlin", at: AT_D, sample: 2 },
    ];
    const stats = await publicStats(db, "a");
    expect(stats.createdAt).toBe(AT_D);
    const fresh = await loadFresh({
      source: source(),
      cursor: stats.cursor,
      now: CLOSED,
      ttlSeconds: 300,
      cache: await newCache(),
    });
    expect(mergeCountries(stats, fresh.rows, "a", stats.createdAt)).toEqual({
      visits: 2,
      countries: [{ code: "DE", visits: 2 }],
    });
  });
});

describe("fresh data", () => {
  it("D1 + AE equals the written points at cursors {D, 0}, {D, 500} and {D+1, 0}", async () => {
    await addLinks("a", "b");
    ae.points = [
      ...groups("a", 400),
      ...groups("b", 300),
      { linkId: "a", createdAt: AT_D, country: "PL", city: "c00000", at: AT_D, sample: 4 },
      ...groups("b", 5, AT_D1),
    ];
    const total = ae.total();
    const seen: RollupCursor[] = [];

    const check = async () => {
      const cache = await newCache();
      const [stA, stB] = [await publicStats(db, "a"), await publicStats(db, "b")];
      const fresh = await loadFresh({
        source: source(),
        cursor: stA.cursor,
        now: CLOSED,
        ttlSeconds: 300,
        cache,
      });
      expect(fresh.partial).toBe(false);
      expect(stA.visits + freshTotal(fresh, "a")).toBe(400 + 4);
      expect(stB.visits + freshTotal(fresh, "b")).toBe(305);
      expect((await d1Total()) + freshTotal(fresh)).toBe(total);
      if (stA.cursor) seen.push(stA.cursor);
    };

    await upsertStatsBatch(db, [], null, { day: D, offset: 0 });
    await check();
    await rollup(CLOSED, 1);
    await check();
    await rollup(CLOSED, 1);
    await check();
    expect(seen).toEqual([
      { day: D, offset: 0 },
      { day: D, offset: 500 },
      { day: D1, offset: 0 },
    ]);
  });

  it("a filled cache does not double count after the rollup moves the cursor", async () => {
    await addLinks("a");
    ae.points = groups("a", 3);
    const cache = await newCache();
    await upsertStatsBatch(db, [], null, { day: D, offset: 0 });

    const read = async () => {
      const stats = await publicStats(db, "a");
      const fresh = await loadFresh({
        source: source(),
        cursor: stats.cursor,
        now: CLOSED,
        ttlSeconds: 300,
        cache,
      });
      return stats.visits + freshTotal(fresh, "a");
    };

    expect(await read()).toBe(3);
    const queriesAfterFill = ae.queries.length;
    expect(await read()).toBe(3);
    expect(ae.queries.length).toBe(queriesAfterFill);

    await rollup(CLOSED);
    expect(await d1Total()).toBe(3);
    expect(await read()).toBe(3);
  });

  it("an SQL API error gives D1 stats with partial: true", async () => {
    await addLinks("a");
    ae.points = groups("a", 2);
    await rollup(CLOSED);
    ae.failWith = 429;
    const stats = await publicStats(db, "a");
    const fresh = await loadFresh({
      source: source(),
      cursor: stats.cursor,
      now: CLOSED,
      ttlSeconds: 300,
      cache: await newCache(),
    });
    expect(fresh).toEqual({ rows: [], partial: true });
    expect(stats.visits).toBe(2);
  });

  it("caches a partial result for 30 s so an outage does not hit the SQL API on every read", async () => {
    ae.failWith = 500;
    const cache = await newCache();
    const read = () =>
      loadFresh({
        source: source(),
        cursor: { day: D, offset: 0 },
        now: CLOSED,
        ttlSeconds: 300,
        cache,
      });
    expect(await read()).toEqual({ rows: [], partial: true });
    const hit = await cache.match(freshCacheKey({ day: D, offset: 0 }));
    expect(hit?.headers.get("cache-control")).toBe("max-age=30");
    await hit?.body?.cancel();
    const queries = ae.queries.length;
    ae.failWith = null;
    expect(await read()).toEqual({ rows: [], partial: true });
    expect(ae.queries.length).toBe(queries);
  });

  it("gives partial when the cursor day needs more pages than the budget", async () => {
    let calls = 0;
    const endless = {
      async queryDay(_day: string, _offset: number, limit: number) {
        calls++;
        return Array.from({ length: limit }, () => ({
          linkId: "a",
          createdAt: AT_D,
          country: "PL",
          city: "",
          visits: 1,
          lat: null,
          lon: null,
        }));
      },
      async querySince() {
        return [];
      },
    };
    const fresh = await loadFresh({
      source: endless,
      cursor: { day: D, offset: 0 },
      now: CLOSED,
      ttlSeconds: 300,
      cache: await newCache(),
    });
    expect(fresh).toEqual({ rows: [], partial: true });
    expect(calls).toBe(5);
  });

  it("ignores a cached entry with an unexpected shape and fetches again", async () => {
    ae.points = groups("a", 2);
    const cache = await newCache();
    const key = freshCacheKey({ day: D, offset: 0 });
    const oldShape = {
      rows: [{ linkId: "a", country: "PL", city: "", visits: 99, lat: null, lon: null }],
      partial: false,
    };
    for (const bad of [
      [{ linkId: 1 }],
      { rows: [{ linkId: "a" }], partial: false },
      oldShape,
      "x",
    ]) {
      await cache.put(key, Response.json(bad, { headers: { "cache-control": "max-age=300" } }));
      const fresh = await loadFresh({
        source: source(),
        cursor: { day: D, offset: 0 },
        now: CLOSED,
        ttlSeconds: 300,
        cache,
      });
      expect(fresh.partial).toBe(false);
      expect(freshTotal(fresh)).toBe(2);
      await cache.delete(key);
    }
  });
});
