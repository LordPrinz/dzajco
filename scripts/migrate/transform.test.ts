import { describe, expect, it } from "bun:test";
import { verifySecret } from "../../src/domain/secret";
import { MAX_URL_LENGTH } from "../../src/domain/url-policy";
import fixture from "./fixtures/v2-links.json";
import {
  BATCH_SIZE,
  buildSqlFiles,
  compareCodePoints,
  decodeId,
  expiryMillis,
  isRandomId,
  type LinkRow,
  rowSql,
  transformLinks,
} from "./transform";

const NOW = Date.parse("2026-11-14T00:00:00Z");
const PEPPERS = { 1: "migrate-test-pepper" };
const OPTIONS = { now: NOW, version: 1, peppers: PEPPERS, ownHosts: ["dzaj.co"] };
const FIXTURE_KEYS = fixture.flatMap((doc) =>
  "secretKey" in doc && typeof doc.secretKey === "string" ? [doc.secretKey] : [],
);

describe("decodeId", () => {
  it("decodes the v2 encodeURIComponent form and normalises to NFC", () => {
    expect(decodeId("my%20link")).toBe("my link");
    expect(decodeId("cafe%CC%81")).toBe("café");
  });
  it("keeps the raw id when the percent escapes are malformed", () => {
    expect(decodeId("bad%zzname")).toBe("bad%zzname");
    expect(decodeId("100%")).toBe("100%");
  });
});

describe("expiryMillis", () => {
  it("reads null, Date, ISO strings and Extended JSON dates", () => {
    expect(expiryMillis(null)).toBeNull();
    expect(expiryMillis(undefined)).toBeNull();
    expect(expiryMillis(new Date(1000))).toBe(1000);
    expect(expiryMillis("2099-06-01T12:00:00.000Z")).toBe(Date.parse("2099-06-01T12:00:00.000Z"));
    expect(expiryMillis({ $date: "2099-01-01T00:00:00.000Z" })).toBe(4070908800000);
    expect(expiryMillis({ $date: { $numberLong: "1577836800000" } })).toBe(1577836800000);
    expect(expiryMillis({ $date: 1577836800000 })).toBe(1577836800000);
  });
  it("rejects values that are not dates", () => {
    expect(expiryMillis("tomorrow")).toBeUndefined();
    expect(expiryMillis({ $date: "nope" })).toBeUndefined();
    expect(expiryMillis(new Date(Number.NaN))).toBeUndefined();
    expect(expiryMillis(42)).toBeUndefined();
  });
});

describe("isRandomId", () => {
  it("matches the v2 random id shape: nanoid of 3 to 10 characters", () => {
    expect(isRandomId("aB3")).toBe(true);
    expect(isRandomId("aB3_-xYz09")).toBe(true);
    expect(isRandomId("ab")).toBe(false);
    expect(isRandomId("aB3_-xYz09Q")).toBe(false);
    expect(isRandomId("my link")).toBe(false);
    expect(isRandomId("café")).toBe(false);
  });
});

describe("transformLinks ids", () => {
  it("reports ids with format characters as invalid, like redirect and admin:block do", async () => {
    const docs = ["a\u200bb", "ab\u202ecd"].map((_id) => ({ _id, full: "https://example.com/" }));
    const { rows, report } = await transformLinks(docs, OPTIONS);
    expect(rows).toEqual([]);
    expect(report.invalid.map((i) => i.reason)).toEqual(["invalid_id", "invalid_id"]);
  });
});

describe("transformLinks on the v2 fixture", () => {
  it("reports read, inserted, expired, invalid, reserved collisions, duplicates and legacy keys", async () => {
    const { rows, report } = await transformLinks(fixture, OPTIONS);
    expect(report.read).toBe(17);
    expect(report.inserted).toBe(11);
    expect(report.skippedExpired).toBe(1);
    expect(report.skippedInvalid).toBe(3);
    expect(report.reservedCollisions).toEqual(["api"]);
    expect(report.duplicates).toEqual(["café"]);
    expect(report.legacyKeys).toBe(8);
    expect(report.expiredIds).toEqual(["old123"]);
    expect(report.invalid).toEqual([
      { id: "\u0000ctl", reason: "invalid_id" },
      { id: "a/b", reason: "invalid_id" },
      { id: "jsbad", reason: "unsupported_scheme" },
    ]);
    expect(report.schemeAdded).toEqual(["wwwonly"]);
    expect(report.policyFlags).toEqual([
      { id: "ownhost", code: "own_host" },
      { id: "shortx", code: "blocked_target" },
    ]);
    expect(rows.map((r) => r.id)).toEqual([
      "aB3dE",
      "bad%zzname",
      "café",
      "my link",
      "naïve",
      "nokey1",
      "o'brien",
      "ownhost",
      "shortx",
      "wwwonly",
      "zwsp",
    ]);
    expect(report.insertedIds).toEqual(rows.map((r) => r.id));
  });

  it("fills every column the schema needs, target_host included", async () => {
    const { rows } = await transformLinks(fixture, OPTIONS);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get("aB3dE")).toMatchObject({
      target: "https://example.com/plain",
      targetHost: "example.com",
      expiresAt: null,
      createdAt: NOW,
      isCustom: false,
    });
    expect(byId.get("my link")).toMatchObject({
      targetHost: "example.org",
      expiresAt: 4070908800000,
      isCustom: true,
    });
    expect(byId.get("café")).toMatchObject({ target: "https://example.com/duplicate" });
    expect(byId.get("naïve")).toMatchObject({
      target: "https://xn--bcher-kva.example./x",
      targetHost: "xn--bcher-kva.example",
      isCustom: true,
    });
    expect(byId.get("wwwonly")).toMatchObject({
      target: "https://www.example.com/",
      targetHost: "www.example.com",
    });
    expect(byId.get("nokey1")).toMatchObject({ secretHash: null, isCustom: false });
    expect(byId.get("zwsp")).toMatchObject({
      target: "https://example.com/zero-width",
      secretHash: null,
    });
    for (const row of rows) expect(row.targetHost).not.toBe("");
  });

  it("hashes legacy keys as they are with the current pepper version", async () => {
    const { rows } = await transformLinks(fixture, OPTIONS);
    const row = rows.find((r) => r.id === "aB3dE") as LinkRow;
    expect(row.secretHash).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(await verifySecret("Ab3_-xYz09Qw", row.secretHash as string, PEPPERS)).toBe(true);
    const v2 = await transformLinks(fixture, { ...OPTIONS, version: 2, peppers: { 2: "p2" } });
    expect(v2.rows[0]?.secretHash).toMatch(/^v2:[0-9a-f]{64}$/);
  });

  it("counts a link as expired when expires_at equals now", async () => {
    const docs = [{ _id: "edge1", full: "https://example.com/", expire: new Date(NOW) }];
    const { report } = await transformLinks(docs, OPTIONS);
    expect(report.skippedExpired).toBe(1);
    expect(report.inserted).toBe(0);
  });

  it("picks the same NFC duplicate whatever the input order", async () => {
    const nfd = { _id: "cafe%CC%81", full: "https://example.com/nfd", expire: null };
    const nfc = { _id: "caf%C3%A9", full: "https://example.com/nfc", expire: null };
    for (const docs of [
      [nfd, nfc],
      [nfc, nfd],
    ]) {
      const { rows, report } = await transformLinks(docs, OPTIONS);
      expect(rows.map((r) => r.target)).toEqual(["https://example.com/nfc"]);
      expect(report.duplicates).toEqual(["café"]);
    }
  });

  it("sorts by code point, not UTF-16 unit", () => {
    expect(compareCodePoints("\u{1F600}", "\uFFFF")).toBeGreaterThan(0);
    expect("\u{1F600}" < "\uFFFF").toBe(true);
    expect(compareCodePoints("ab", "abc")).toBeLessThan(0);
    expect(compareCodePoints("x", "x")).toBe(0);
  });

  it("skips targets longer than MAX_URL_LENGTH and flags policy misses without skipping", async () => {
    const long = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}`;
    const docs = [
      { _id: "long1", full: long },
      { _id: "priv1", full: "http://127.0.0.1/admin" },
      { _id: "www2", full: "WWW.Example.com:8080/path" },
      { _id: "ftpwww", full: "www.example.com://x" },
    ];
    const { rows, report } = await transformLinks(docs, OPTIONS);
    expect(report.invalid).toEqual([
      { id: "ftpwww", reason: "unsupported_scheme" },
      { id: "long1", reason: "url_too_long" },
    ]);
    expect(rows.map((r) => r.target)).toEqual([
      "http://127.0.0.1/admin",
      "https://www.example.com:8080/path",
    ]);
    expect(report.schemeAdded).toEqual(["www2"]);
    expect(report.policyFlags).toEqual([{ id: "priv1", code: "private_target" }]);
  });

  it("keeps a live duplicate when the first copy is expired", async () => {
    const docs = [
      { _id: "cafe%CC%81", full: "https://example.com/1", expire: new Date(NOW - 1) },
      { _id: "caf%C3%A9", full: "https://example.com/2", expire: null },
    ];
    const { rows, report } = await transformLinks(docs, OPTIONS);
    expect(rows.map((r) => r.target)).toEqual(["https://example.com/2"]);
    expect(report.duplicates).toEqual([]);
  });

  it("reports documents without a usable id, target or expiry as invalid", async () => {
    const docs = [
      { full: "https://example.com/" },
      { _id: { $oid: "65a0c0ffee" }, full: "https://example.com/" },
      { _id: "x".repeat(65), full: "https://example.com/" },
      { _id: "nofull" },
      { _id: "creds", full: "https://user:pw@example.com/" },
      { _id: "badexp", full: "https://example.com/", expire: "soon" },
      "not an object",
    ];
    const { report } = await transformLinks(docs, OPTIONS);
    expect(report.read).toBe(7);
    expect(report.invalid.map((i) => i.reason)).toEqual([
      "invalid_expire",
      "credentials_not_allowed",
      "invalid_url",
      "invalid_id",
      "invalid_id",
      "invalid_id",
      "invalid_document",
    ]);
  });

  it("fails clearly when the pepper for the current version is missing", async () => {
    await expect(transformLinks(fixture, { ...OPTIONS, peppers: {} })).rejects.toThrow(
      "Missing secret pepper for version 1",
    );
  });
});

describe("SQL output", () => {
  it("never contains a plaintext fixture key", async () => {
    const { rows } = await transformLinks(fixture, OPTIONS);
    const sql = buildSqlFiles(rows).join("\n");
    expect(FIXTURE_KEYS.length).toBeGreaterThan(10);
    for (const key of FIXTURE_KEYS) expect(sql).not.toContain(key);
    expect(sql).not.toContain(PEPPERS[1]);
  });

  it("is identical on a second run over the same input", async () => {
    const first = buildSqlFiles((await transformLinks(fixture, OPTIONS)).rows);
    const second = buildSqlFiles((await transformLinks(fixture, OPTIONS)).rows);
    expect(second).toEqual(first);
  });

  it("writes one INSERT OR IGNORE per line", () => {
    const row: LinkRow = {
      id: "abc",
      target: "https://example.com/",
      targetHost: "example.com",
      secretHash: null,
      expiresAt: null,
      createdAt: 1700000000000,
      isCustom: false,
    };
    expect(rowSql(row)).toBe(
      "INSERT OR IGNORE INTO links (id, target, target_host, secret_hash, expires_at, created_at, is_custom) VALUES ('abc', 'https://example.com/', 'example.com', NULL, NULL, 1700000000000, 0);",
    );
  });

  it("escapes hostile values as SQL string literals", () => {
    const row: LinkRow = {
      id: "x'); DROP TABLE links;--",
      target: "https://example.com/?q=';DELETE FROM links;",
      targetHost: "example.com",
      secretHash: "v1:00",
      expiresAt: 5,
      createdAt: 6,
      isCustom: true,
    };
    expect(rowSql(row)).toBe(
      "INSERT OR IGNORE INTO links (id, target, target_host, secret_hash, expires_at, created_at, is_custom) VALUES ('x''); DROP TABLE links;--', 'https://example.com/?q='';DELETE FROM links;', 'example.com', 'v1:00', 5, 6, 1);",
    );
    expect(() => rowSql({ ...row, id: "a\nb" })).toThrow("Control characters are not allowed");
  });

  it("splits rows into files of at most BATCH_SIZE statements", () => {
    const row: LinkRow = {
      id: "a",
      target: "https://example.com/",
      targetHost: "example.com",
      secretHash: null,
      expiresAt: null,
      createdAt: 1,
      isCustom: false,
    };
    const rows = Array.from({ length: BATCH_SIZE * 2 + 1 }, (_, i) => ({ ...row, id: `id${i}` }));
    const files = buildSqlFiles(rows);
    expect(files.map((f) => f.trimEnd().split("\n").length)).toEqual([BATCH_SIZE, BATCH_SIZE, 1]);
    expect(buildSqlFiles([])).toEqual([]);
  });
});
