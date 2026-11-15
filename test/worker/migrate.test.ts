import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import fixture from "../../scripts/migrate/fixtures/v2-links.json";
import locations from "../../scripts/migrate/fixtures/v2-locations.json";
import { buildSqlFiles, type LinkRow, transformLinks } from "../../scripts/migrate/transform";
import { buildVisitSqlFiles, parseLocations, transformVisits } from "../../scripts/migrate/visits";
import worker from "../../src/index";

const PEPPER = "migrate-worker-pepper";
const allowAll: RateLimit = { limit: async () => ({ success: true }) };

function testEnv(): Cloudflare.Env {
  return {
    ...env,
    SECRET_PEPPER_V1: PEPPER,
    RL_CREATE: allowAll,
    RL_REDIRECT: allowAll,
    RL_DELETE: allowAll,
    RL_STATS: allowAll,
  };
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const ctx = createExecutionContext();
  const req = new Request(`https://dzaj.co${path}`, { redirect: "manual", ...init });
  const res = await worker.fetch(req, testEnv(), ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/** Runs the generated files the way `wrangler d1 execute --file` would, returning rows changed. */
async function apply(files: string[]): Promise<number> {
  let changes = 0;
  for (const file of files) {
    const statements = file.trimEnd().split("\n");
    const results = await env.DB.batch(statements.map((sql) => env.DB.prepare(sql)));
    for (const result of results) changes += result.meta.changes;
  }
  return changes;
}

const docs = fixture as { _id: string; secretKey?: string | null }[];
let rows: LinkRow[];
let firstRun: number;
let secondRun: number;
let visitRuns: number[];

beforeAll(async () => {
  const result = await transformLinks(fixture, {
    now: Date.now(),
    version: 1,
    peppers: { 1: PEPPER },
    ownHosts: ["dzaj.co"],
  });
  rows = result.rows;
  const files = buildSqlFiles(rows);
  firstRun = await apply(files);
  secondRun = await apply(files);
  const visits = transformVisits(rows, result.sources, parseLocations(locations));
  const visitFiles = buildVisitSqlFiles(visits.rows);
  visitRuns = [await apply(visitFiles), await apply(visitFiles)];
});

describe("migrated v2 links in the Worker", () => {
  it("inserts every planned row once; a second run inserts 0", () => {
    expect(rows).toHaveLength(11);
    expect(firstRun).toBe(11);
    expect(secondRun).toBe(0);
  });

  it("stores target_host for every link", async () => {
    const { results } = await env.DB.prepare(
      "SELECT target_host FROM links WHERE id IN (SELECT value FROM json_each(?))",
    )
      .bind(JSON.stringify(rows.map((r) => r.id)))
      .all<{ target_host: string }>();
    expect(results).toHaveLength(11);
    for (const row of results) expect(row.target_host).not.toBe("");
  });

  it("redirects every migrated id with 302, by its v3 path and by its old v2 path", async () => {
    for (const row of rows) {
      const res = await call(`/${encodeURIComponent(row.id)}`);
      expect(res.status, row.id).toBe(302);
      expect(res.headers.get("location")).toBe(row.target);
    }
    const migratedRaw = docs.filter((doc) =>
      [
        "aB3dE",
        "my%20link",
        "cafe%CC%81",
        "nai%CC%88ve",
        "nokey1",
        "o'brien",
        "wwwonly",
        "zwsp",
      ].includes(doc._id),
    );
    expect(migratedRaw).toHaveLength(8);
    for (const doc of migratedRaw) {
      expect((await call(`/${doc._id}`)).status, doc._id).toBe(302);
    }
  });

  it("does not import expired, reserved or invalid links", async () => {
    for (const id of ["old123", "jsbad"]) {
      expect((await call(`/${id}`)).status, id).toBe(404);
    }
    const api = await env.DB.prepare("SELECT 1 FROM links WHERE id = 'api'").first();
    expect(api).toBeNull();
  });

  it("writes each v2 visit row once; a second run writes 0", () => {
    // D1 counts the ledger row and the link_stats row its trigger writes: 7 rows, 14 changes.
    expect(visitRuns).toEqual([14, 0]);
  });

  it("shows the v2 visits in the public stats", async () => {
    const res = await call(`/api/v1/links/${encodeURIComponent("o'brien")}/stats`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      visits: number;
      countries: { code: string; visits: number }[];
      cities?: unknown;
    };
    expect(body.visits).toBe(10);
    expect(body.countries).toEqual([
      { code: "PL", visits: 6 },
      { code: "", visits: 3 },
      { code: "DE", visits: 1 },
    ]);
    expect(body.cities).toBeUndefined();
  });

  it("shows the v2 cities with coordinates in the owner stats", async () => {
    const res = await call(`/api/v1/links/${encodeURIComponent("my link")}/stats`, {
      headers: { authorization: "Bearer Kk1_-aaBBcc9" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { visits: number; cities: unknown[] };
    expect(body.visits).toBe(9);
    expect(body.cities).toEqual([
      { country: "NL", city: "Amsterdam", lat: 52.37, lon: 4.9, visits: 9 },
    ]);
  });

  it("deletes a migrated link with its original 12 character v2 key", async () => {
    const legacyKey = "Ab3_-xYz09Qw";
    expect(docs.find((doc) => doc._id === "aB3dE")?.secretKey).toBe(legacyKey);
    const del = (key: string) =>
      call("/api/v1/links/aB3dE", {
        method: "DELETE",
        headers: { authorization: `Bearer ${key}` },
      });
    expect((await del("Ab3_-xYz09Qx")).status).toBe(403);
    expect((await del(legacyKey)).status).toBe(204);
    expect((await call("/aB3dE")).status).toBe(404);
  });
});
