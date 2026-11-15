import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_CITY_LENGTH } from "../../src/analytics/ae-source";
import { countryCode } from "./countries";
import fixture from "./fixtures/v2-links.json";
import locationsFixture from "./fixtures/v2-locations.json";
import { buildSqlFiles, type LinkRow, transformLinks } from "./transform";
import {
  buildVisitSqlFiles,
  parseLocations,
  splitLocation,
  transformVisits,
  type VisitImportRow,
  visitCount,
  visitSql,
} from "./visits";

const OPTIONS = {
  now: Date.parse("2026-11-14T00:00:00Z"),
  version: 1,
  peppers: { 1: "visits-test-pepper" },
  ownHosts: ["dzaj.co"],
};

async function fixtureVisits() {
  const { rows, sources } = await transformLinks(fixture, OPTIONS);
  return { links: rows, ...transformVisits(rows, sources, parseLocations(locationsFixture)) };
}

function link(id: string, doc: Record<string, unknown>): [LinkRow, [string, typeof doc]] {
  const row: LinkRow = {
    id,
    target: `https://example.com/${id}`,
    targetHost: "example.com",
    secretHash: null,
    expiresAt: null,
    createdAt: 1,
    isCustom: false,
  };
  return [row, [id, doc]];
}

describe("countryCode", () => {
  it("maps the English v2 country names, including the ones Intl spells differently", () => {
    const names: Record<string, string> = {
      Poland: "PL",
      "United States": "US",
      "United Kingdom": "GB",
      Czechia: "CZ",
      China: "CN",
      Turkey: "TR",
      "The Netherlands": "NL",
      Netherlands: "NL",
      "Ivory Coast": "CI",
      "Bosnia and Herzegovina": "BA",
      "Democratic Republic of the Congo": "CD",
      "Republic of the Congo": "CG",
      "Palestinian Territory": "PS",
      "Trinidad and Tobago": "TT",
      Reunion: "RE",
      Myanmar: "MM",
      Kosovo: "XK",
      "Hong Kong": "HK",
    };
    for (const [name, code] of Object.entries(names)) expect(countryCode(name), name).toBe(code);
  });

  it("returns null for names it does not know", () => {
    expect(countryCode("Atlantis")).toBeNull();
    expect(countryCode("")).toBeNull();
  });
});

describe("visitCount", () => {
  it("reads plain numbers and Extended JSON, and refuses the rest", () => {
    expect(visitCount(5)).toBe(5);
    expect(visitCount({ $numberInt: "7" })).toBe(7);
    expect(visitCount({ $numberLong: "8" })).toBe(8);
    for (const bad of [-1, 1.5, "3", null, undefined, {}, Number.NaN]) {
      expect(visitCount(bad)).toBeNull();
    }
  });
});

describe("transformVisits on the v2 fixture", () => {
  it("writes one row per link, country and city, with the rest under the unknown country", async () => {
    const { rows } = await fixtureVisits();
    const view = rows.map(({ linkId, country, city, lat, lon, visits }) => ({
      linkId,
      country,
      city,
      lat,
      lon,
      visits,
    }));
    expect(view).toEqual([
      { linkId: "aB3dE", country: "??", city: "", lat: null, lon: null, visits: 3 },
      { linkId: "my link", country: "NL", city: "Amsterdam", lat: 52.37, lon: 4.9, visits: 9 },
      { linkId: "o'brien", country: "??", city: "", lat: null, lon: null, visits: 3 },
      { linkId: "o'brien", country: "DE", city: "Ghost Town", lat: null, lon: null, visits: 1 },
      { linkId: "o'brien", country: "PL", city: "Gliwice", lat: 50.29, lon: 18.67, visits: 4 },
      { linkId: "o'brien", country: "PL", city: "Ujazd", lat: 50.39, lon: 18.35, visits: 2 },
    ]);
  });

  it("carries the target and key hash of the imported link", async () => {
    const { rows, links } = await fixtureVisits();
    for (const row of rows) {
      const link = links.find((l) => l.id === row.linkId) as LinkRow;
      expect(row.target).toBe(link.target);
      expect(row.secretHash).toBe(link.secretHash);
    }
    expect(rows[0]?.secretHash).toStartWith("v1:");
  });

  it("reports totals, unknown names, missing locations and over-located links", async () => {
    const { report } = await fixtureVisits();
    expect(report).toEqual({
      links: 3,
      rows: 6,
      visits: 22,
      unknownVisits: 6,
      unmappedCountries: ["Atlantis"],
      missingLocations: ["Ghost Town_Nowhere_Germany"],
      locatedOverTotal: ["my link"],
    });
  });

  it("only reads links that were imported", async () => {
    const { rows } = await fixtureVisits();
    const ids = new Set(rows.map((r) => r.linkId));
    // old123 has a visit but expired; the café duplicate is not the imported document.
    expect(ids.has("old123")).toBe(false);
    expect(ids.has("café")).toBe(false);
  });

  it("skips links without visits and ignores malformed entries", () => {
    const [a, aDoc] = link("a", { visits: 0, visitsLocation: [] });
    const [b, bDoc] = link("b", {
      visits: 2,
      visitsLocation: [
        null,
        { visits: 1 },
        { visits: -1, location: "Gliwice_Silesia_Poland" },
        { visits: 1, location: "" },
      ],
    });
    const result = transformVisits([a, b], new Map([aDoc, bDoc]), new Map());
    expect(result.rows.map((r) => [r.linkId, r.country, r.city, r.visits])).toEqual([
      ["b", "??", "", 2],
    ]);
  });
});

describe("splitLocation", () => {
  it("takes the country from the end and keeps underscores in the city", () => {
    expect(splitLocation("Gliwice_Silesia_Poland")).toEqual({
      countryName: "Poland",
      city: "Gliwice",
    });
    expect(splitLocation("Saint_Martin_Region_France")).toEqual({
      countryName: "France",
      city: "Saint_Martin",
    });
    expect(splitLocation("Gliwice_Poland")).toEqual({ countryName: "Poland", city: "Gliwice" });
    expect(splitLocation("Poland")).toEqual({ countryName: "Poland", city: "" });
  });

  it("caps the city at the length the rollup keeps", () => {
    const { city } = splitLocation(`${"ż".repeat(150)}_Region_Poland`);
    expect([...city]).toHaveLength(MAX_CITY_LENGTH);
  });
});

describe("visit SQL", () => {
  const row: VisitImportRow = {
    linkId: "o'brien",
    target: "https://example.com/it's",
    secretHash: "v1:ab",
    country: "PL",
    city: "Gliwice",
    lat: 50.29,
    lon: 18.67,
    visits: 4,
  };

  it("guards on the link and its target, and on the ledger row, in one statement", () => {
    expect(visitSql(row)).toBe(
      "INSERT INTO v2_visit_import (link_id, country, city, lat, lon, visits) SELECT 'o''brien', 'PL', 'Gliwice', 50.29, 18.67, 4 " +
        "WHERE EXISTS (SELECT 1 FROM links WHERE id = 'o''brien' AND target = 'https://example.com/it''s' AND secret_hash IS 'v1:ab') " +
        "AND NOT EXISTS (SELECT 1 FROM v2_visit_import WHERE link_id = 'o''brien' AND country = 'PL' AND city = 'Gliwice');",
    );
    expect(visitSql({ ...row, lat: null, lon: null })).toContain("'Gliwice', NULL, NULL, 4");
    expect(visitSql({ ...row, secretHash: null })).toContain("AND secret_hash IS NULL)");
    expect(() => visitSql({ ...row, city: "a\nb" })).toThrow("Control characters");
  });

  it("splits rows into files and is the same on a second run", async () => {
    const first = buildVisitSqlFiles((await fixtureVisits()).rows, 5);
    expect(first.map((f) => f.trimEnd().split("\n").length)).toEqual([5, 1]);
    expect(buildVisitSqlFiles((await fixtureVisits()).rows, 5)).toEqual(first);
    expect(buildVisitSqlFiles([])).toEqual([]);
  });
});

describe("visit SQL against the D1 schema", () => {
  const MIGRATIONS = join(import.meta.dirname, "../../migrations");

  function database(): Database {
    const db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON");
    for (const file of readdirSync(MIGRATIONS).sort()) {
      db.run(readFileSync(join(MIGRATIONS, file), "utf8"));
    }
    return db;
  }

  const run = (db: Database, files: string[]) => {
    for (const file of files) db.run(file);
  };
  const stats = (db: Database) =>
    db
      .query("SELECT link_id, country, city, lat, lon, visits FROM link_stats ORDER BY 1, 2, 3")
      .all();
  const total = (db: Database) =>
    (db.query("SELECT SUM(visits) AS n FROM link_stats").get() as { n: number }).n;

  it("adds the v2 visits once, however often it runs", async () => {
    const db = database();
    const { links, rows } = await fixtureVisits();
    run(db, buildSqlFiles(links));
    const files = buildVisitSqlFiles(rows);
    run(db, files);
    const first = stats(db);
    expect(total(db)).toBe(22);
    run(db, files);
    run(db, buildSqlFiles(links));
    expect(stats(db)).toEqual(first);
  });

  it("keeps visits counted in v3 and adds the v2 ones on top, once", async () => {
    const db = database();
    const { links, rows } = await fixtureVisits();
    run(db, buildSqlFiles(links));
    // Visits rolled up after the cutover, before the visit import.
    db.run(
      "INSERT INTO link_stats (link_id, country, city, lat, lon, visits) VALUES ('o''brien', 'PL', 'Gliwice', 50.31, 18.69, 4), ('o''brien', 'FR', 'Paris', 48.86, 2.35, 5)",
    );
    const files = buildVisitSqlFiles(rows);
    run(db, files);
    run(db, files);
    const byPlace = db
      .query(
        "SELECT country, city, lat, lon, visits FROM link_stats WHERE link_id = 'o''brien' ORDER BY 1, 2",
      )
      .all();
    expect(byPlace).toEqual([
      { country: "??", city: "", lat: null, lon: null, visits: 3 },
      { country: "DE", city: "Ghost Town", lat: null, lon: null, visits: 1 },
      { country: "FR", city: "Paris", lat: 48.86, lon: 2.35, visits: 5 },
      { country: "PL", city: "Gliwice", lat: 50.3, lon: 18.68, visits: 8 },
      { country: "PL", city: "Ujazd", lat: 50.39, lon: 18.35, visits: 2 },
    ]);
  });

  it("waits for the link, and never adds to a later link that reused the id", async () => {
    const db = database();
    const { links, rows } = await fixtureVisits();
    const files = buildVisitSqlFiles(rows);
    // No links yet: nothing is written, and the ledger stays empty for a later run.
    run(db, files);
    expect(total(db)).toBeNull();
    expect(db.query("SELECT COUNT(*) AS n FROM v2_visit_import").get()).toEqual({ n: 0 });

    run(db, buildSqlFiles(links));
    run(db, files);
    expect(total(db)).toBe(22);

    // The link is deleted and comes back with the same id, target and key: the ledger still
    // holds its rows, so the visits are not added again.
    const hash = links.find((l) => l.id === "aB3dE")?.secretHash ?? null;
    db.run("DELETE FROM links WHERE id = 'aB3dE'");
    db.query(
      "INSERT INTO links (id, target, target_host, secret_hash, created_at) VALUES ('aB3dE', 'https://example.com/plain', 'example.com', ?, 2)",
    ).run(hash);
    run(db, files);
    expect(db.query("SELECT COUNT(*) AS n FROM link_stats WHERE link_id = 'aB3dE'").get()).toEqual({
      n: 0,
    });
  });

  it("skips a link with the same id and target but another key", async () => {
    const db = database();
    const { rows } = await fixtureVisits();
    db.run(
      "INSERT INTO links (id, target, target_host, secret_hash, created_at) VALUES ('aB3dE', 'https://example.com/plain', 'example.com', 'v1:other', 1)",
    );
    run(db, buildVisitSqlFiles(rows));
    expect(db.query("SELECT COUNT(*) AS n FROM link_stats WHERE link_id = 'aB3dE'").get()).toEqual({
      n: 0,
    });
  });

  it("skips a link whose target changed (another link took the id)", async () => {
    const db = database();
    const { rows } = await fixtureVisits();
    db.run(
      "INSERT INTO links (id, target, target_host, created_at) VALUES ('aB3dE', 'https://other.example/', 'other.example', 1)",
    );
    run(db, buildVisitSqlFiles(rows));
    expect(db.query("SELECT COUNT(*) AS n FROM link_stats WHERE link_id = 'aB3dE'").get()).toEqual({
      n: 0,
    });
  });
});
