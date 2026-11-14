import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { VisitRow } from "../../src/analytics/ports";
import {
  blockHost,
  deleteExpired,
  deleteLink,
  getLinkForOwner,
  getLinkRecord,
  globalStats,
  IdTakenError,
  insertLink,
  isHostBlocked,
  ownerStats,
  publicStats,
  readCursor,
  recomputeGlobalStats,
  upsertStatsBatch,
} from "../../src/db/queries";

const db = env.DB;
const NOW = 1_800_000_000;

function link(id: string, extra: Partial<Parameters<typeof insertLink>[1]> = {}) {
  return {
    id,
    target: "https://example.com/a",
    secretHash: `v1:${"a".repeat(64)}`,
    expiresAt: null,
    createdAt: NOW,
    isCustom: false,
    ...extra,
  };
}

function row(linkId: string, country: string, city: string, visits: number): VisitRow {
  return { linkId, country, city, visits, lat: 52.23, lon: 21.01 };
}

async function count(table: string, where = "1=1"): Promise<number> {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM link_stats"),
    db.prepare("DELETE FROM links"),
    db.prepare("DELETE FROM blocked_hosts"),
    db.prepare("DELETE FROM meta"),
    db.prepare("DELETE FROM global_stats"),
  ]);
});

describe("schema", () => {
  it("has the expiry index and cascading foreign key", async () => {
    const idx = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='links_expires'")
      .first();
    expect(idx).not.toBeNull();
    const fks = await db
      .prepare("PRAGMA foreign_key_list(link_stats)")
      .all<{ on_delete: string }>();
    expect(fks.results[0]?.on_delete).toBe("CASCADE");
  });
});

describe("insertLink", () => {
  it("gives exactly one success and one IdTakenError for parallel inserts of the same id", async () => {
    const results = await Promise.allSettled([
      insertLink(db, link("same")),
      insertLink(db, link("same", { target: "https://example.org/" })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(IdTakenError);
    expect(await count("links", "id = 'same'")).toBe(1);
  });

  it("does not turn other errors into IdTakenError", async () => {
    await expect(insertLink(db, link("bad", { target: "not a url" }))).rejects.not.toBeInstanceOf(
      IdTakenError,
    );
  });

  it("round-trips fields for the owner", async () => {
    await insertLink(db, link("own", { expiresAt: NOW + 10, isCustom: true }));
    expect(await getLinkForOwner(db, "own")).toEqual({
      id: "own",
      target: "https://example.com/a",
      secretHash: `v1:${"a".repeat(64)}`,
      expiresAt: NOW + 10,
    });
    expect(await getLinkForOwner(db, "missing")).toBeNull();
  });
});

describe("getLinkRecord", () => {
  it("returns null for an unknown id", async () => {
    expect(await getLinkRecord(db, "nope")).toBeNull();
  });

  it("sets blocked for the blocked host and its subdomains only", async () => {
    await blockHost(db, "evil.com", "abuse", NOW);
    await insertLink(db, link("exact", { target: "https://evil.com/x" }));
    await insertLink(db, link("sub", { target: "https://a.b.EVIL.com/x" }));
    await insertLink(db, link("lookalike", { target: "https://notevil.com/x" }));
    await insertLink(db, link("fine", { target: "https://good.org/x" }));
    expect((await getLinkRecord(db, "exact"))?.blocked).toBe(true);
    expect((await getLinkRecord(db, "sub"))?.blocked).toBe(true);
    expect((await getLinkRecord(db, "lookalike"))?.blocked).toBe(false);
    expect(await getLinkRecord(db, "fine")).toEqual({
      id: "fine",
      target: "https://good.org/x",
      expiresAt: null,
      blocked: false,
    });
  });

  it("reads a blocked flag with an underscore host without LIKE wildcards", async () => {
    await blockHost(db, "a_c.com", null, NOW);
    await insertLink(db, link("wild", { target: "https://abc.com/" }));
    expect((await getLinkRecord(db, "wild"))?.blocked).toBe(false);
  });

  it("isHostBlocked matches given suffixes", async () => {
    await blockHost(db, "evil.com", null, NOW);
    expect(await isHostBlocked(db, ["x.evil.com", "evil.com", "com"])).toBe(true);
    expect(await isHostBlocked(db, ["good.org", "org"])).toBe(false);
    expect(await isHostBlocked(db, [])).toBe(false);
  });
});

describe("host normalisation", () => {
  it("blocks an IDN host stored as punycode", async () => {
    await blockHost(db, "Bücher.DE.", null, NOW);
    await insertLink(db, link("idn", { target: "https://bücher.de/x" }));
    expect((await getLinkRecord(db, "idn"))?.blocked).toBe(true);
    expect(await count("blocked_hosts", "host = 'xn--bcher-kva.de'")).toBe(1);
  });

  it("rejects ports, paths and userinfo", async () => {
    for (const bad of ["a.com:8080", "a.com/x", "u@a.com", "", "a.com?x"]) {
      await expect(blockHost(db, bad, null, NOW)).rejects.toThrow();
    }
  });

  it("caps suffixes so many labels stay under the bound-parameter limit", async () => {
    const suffixes = Array.from({ length: 150 }, (_, i) => `h${i}.evil.com`);
    await blockHost(db, "com", null, NOW);
    expect(await isHostBlocked(db, [...suffixes, "com"])).toBe(true);
  });
});

describe("deleteLink", () => {
  it("deletes nothing when verify rejects the hash", async () => {
    await insertLink(db, link("keep"));
    expect(await deleteLink(db, "keep", async () => false)).toBe("forbidden");
    expect(await count("links", "id = 'keep'")).toBe(1);
  });

  it("reports forbidden when the hash changes between verify and delete", async () => {
    await insertLink(db, link("race"));
    const result = await deleteLink(db, "race", async () => {
      await db.prepare("UPDATE links SET secret_hash = 'v1:other' WHERE id = 'race'").run();
      return true;
    });
    expect(result).toBe("forbidden");
    expect(await count("links", "id = 'race'")).toBe(1);
  });

  it("refuses links without a stored hash and reports unknown ids", async () => {
    await insertLink(db, link("nohash", { secretHash: null }));
    expect(await deleteLink(db, "nohash", async () => true)).toBe("forbidden");
    expect(await deleteLink(db, "ghost", async () => true)).toBe("not_found");
  });

  it("deletes the link and its link_stats", async () => {
    await insertLink(db, link("gone"));
    await upsertStatsBatch(db, [row("gone", "PL", "Warsaw", 3)], null, {
      day: "2026-11-13",
      offset: 1,
    });
    expect(await count("link_stats", "link_id = 'gone'")).toBe(1);
    expect(await deleteLink(db, "gone", async (h) => h.startsWith("v1:"))).toBe("deleted");
    expect(await count("links", "id = 'gone'")).toBe(0);
    expect(await count("link_stats", "link_id = 'gone'")).toBe(0);
  });
});

describe("deleteExpired", () => {
  it("removes only expires_at < now, at most limit, and returns the ids", async () => {
    await insertLink(db, link("e1", { expiresAt: NOW - 30 }));
    await insertLink(db, link("e2", { expiresAt: NOW - 20 }));
    await insertLink(db, link("e3", { expiresAt: NOW - 10 }));
    await insertLink(db, link("edge", { expiresAt: NOW }));
    await insertLink(db, link("future", { expiresAt: NOW + 5 }));
    await insertLink(db, link("never", { expiresAt: null }));
    await upsertStatsBatch(db, [row("e1", "PL", "", 1)], null, { day: "d", offset: 0 });

    expect(await deleteExpired(db, NOW, 2)).toEqual(["e1", "e2"]);
    expect(await count("link_stats", "link_id = 'e1'")).toBe(0);
    expect(await deleteExpired(db, NOW, 500)).toEqual(["e3"]);
    expect(await count("links")).toBe(3);
    expect(await deleteExpired(db, NOW, 500)).toEqual([]);
  });

  it("clamps the limit", async () => {
    for (const id of ["c1", "c2", "c3"]) await insertLink(db, link(id, { expiresAt: NOW - 1 }));
    expect(await deleteExpired(db, NOW, -5)).toHaveLength(1);
    expect(await deleteExpired(db, NOW, 0)).toHaveLength(1);
    expect(await deleteExpired(db, NOW, 1e9)).toHaveLength(1);
    expect(await count("links")).toBe(0);
  });
});

describe("upsertStatsBatch", () => {
  const c0 = { day: "2026-11-13", offset: 0 };
  const c1 = { day: "2026-11-13", offset: 500 };
  const c2 = { day: "2026-11-14", offset: 0 };

  it("adds visits across pages and writes the cursor in the same batch", async () => {
    await insertLink(db, link("a"));
    await upsertStatsBatch(db, [row("a", "PL", "Warsaw", 3), row("a", "DE", "", 1)], null, c1);
    expect(await readCursor(db)).toEqual(c1);
    await upsertStatsBatch(db, [row("a", "PL", "Warsaw", 4)], c1, c2);
    expect(await readCursor(db)).toEqual(c2);
    const stats = await publicStats(db, "a");
    expect(stats.visits).toBe(8);
    expect(stats.countries).toEqual([
      { code: "PL", visits: 7 },
      { code: "DE", visits: 1 },
    ]);
    expect(stats.cursor).toEqual(c2);
  });

  it("replaying a page that already landed changes nothing", async () => {
    await insertLink(db, link("a"));
    expect(await upsertStatsBatch(db, [row("a", "PL", "", 5)], null, c0)).toBe(true);
    expect(await upsertStatsBatch(db, [row("a", "PL", "", 5)], c0, c1)).toBe(true);
    expect(await upsertStatsBatch(db, [row("a", "PL", "", 5)], c0, c1)).toBe(false);
    expect((await publicStats(db, "a")).visits).toBe(10);
    expect(await readCursor(db)).toEqual(c1);
  });

  it("returns false and changes nothing for a stale cursor", async () => {
    await insertLink(db, link("a"));
    await upsertStatsBatch(db, [row("a", "PL", "", 1)], null, c1);
    expect(await upsertStatsBatch(db, [row("a", "PL", "", 9)], c0, c2)).toBe(false);
    expect(await upsertStatsBatch(db, [row("a", "PL", "", 9)], null, c2)).toBe(false);
    expect((await publicStats(db, "a")).visits).toBe(1);
    expect(await readCursor(db)).toEqual(c1);
  });

  it("compares the cursor by field, whatever the stored key order", async () => {
    await insertLink(db, link("a"));
    await db
      .prepare("INSERT INTO meta (key, value) VALUES ('rollup_cursor', ?)")
      .bind('{"offset":500,"day":"2026-11-13"}')
      .run();
    expect(await upsertStatsBatch(db, [row("a", "PL", "", 2)], c1, c2)).toBe(true);
    expect((await publicStats(db, "a")).visits).toBe(2);
  });

  it("drops bad counts, nulls non-finite and rounds coordinates", async () => {
    await insertLink(db, link("a"));
    const bad = [
      row("a", "XX", "", 0),
      row("a", "XX", "", -1),
      row("a", "XX", "", 1.5),
      row("a", "XX", "", Number.NaN),
      { linkId: "a", country: "PL", city: "Warsaw", visits: 1, lat: 52.23456, lon: Number.NaN },
    ];
    await upsertStatsBatch(db, bad, null, c1);
    expect(await count("link_stats", "country = 'XX'")).toBe(0);
    expect((await ownerStats(db, "a")).cities).toEqual([
      { country: "PL", city: "Warsaw", lat: 52.23, lon: null, visits: 1 },
    ]);
  });

  it("skips rows of deleted links without failing the batch", async () => {
    await insertLink(db, link("alive"));
    await upsertStatsBatch(db, [row("deleted", "PL", "", 9), row("alive", "PL", "", 2)], null, c1);
    expect(await count("link_stats", "link_id = 'deleted'")).toBe(0);
    expect((await publicStats(db, "alive")).visits).toBe(2);
    expect(await readCursor(db)).toEqual(c1);
  });

  it("exposes cities with coordinates to the owner only", async () => {
    await insertLink(db, link("a"));
    await upsertStatsBatch(db, [row("a", "PL", "Warsaw", 2), row("a", "PL", "", 1)], null, c1);
    const owner = await ownerStats(db, "a");
    expect(owner.visits).toBe(3);
    expect(owner.cities).toEqual([
      { country: "PL", city: "Warsaw", lat: 52.23, lon: 21.01, visits: 2 },
    ]);
    expect("cities" in (await publicStats(db, "a"))).toBe(false);
  });
});

describe("global stats", () => {
  it("is null before the first computation, then a single row that is replaced", async () => {
    expect(await globalStats(db)).toBeNull();
    await insertLink(db, link("a"));
    await insertLink(db, link("b"));
    await upsertStatsBatch(db, [row("a", "PL", "", 3), row("b", "DE", "", 2)], null, {
      day: "d",
      offset: 2,
    });
    await recomputeGlobalStats(db, NOW);
    expect(await globalStats(db)).toEqual({
      links: 2,
      visits: 5,
      countries: [
        { code: "PL", visits: 3 },
        { code: "DE", visits: 2 },
      ],
      updatedAt: NOW,
    });
    await recomputeGlobalStats(db, NOW + 1);
    expect(await count("global_stats")).toBe(1);
    expect((await globalStats(db))?.updatedAt).toBe(NOW + 1);
  });
});
