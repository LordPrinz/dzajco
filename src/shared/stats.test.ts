import { describe, expect, it } from "bun:test";
import {
  countryName,
  findSecretKey,
  hasCoordinates,
  ownerRequest,
  ownerStatsPath,
  parseCities,
} from "./stats";

const history = [
  { id: "abc", url: "https://a.example", expire: "never", createdAt: "2026-01-01T00:00:00Z" },
  { id: "def", url: "https://b.example", expire: "never", createdAt: "x", secretKey: "KEY-DEF" },
  { id: "ghi", secretKey: "" },
  null,
  "junk",
];

describe("findSecretKey", () => {
  it("returns the key of the matching entry", () => {
    expect(findSecretKey(history, "def")).toBe("KEY-DEF");
  });

  it("returns null for entries without a key, empty keys, unknown ids and bad shapes", () => {
    expect(findSecretKey(history, "abc")).toBeNull();
    expect(findSecretKey(history, "ghi")).toBeNull();
    expect(findSecretKey(history, "nope")).toBeNull();
    expect(findSecretKey("not an array", "def")).toBeNull();
    expect(findSecretKey(null, "def")).toBeNull();
  });
});

describe("ownerRequest", () => {
  it("sends the key only in the Authorization header", () => {
    const { url, init } = ownerRequest("my link", "S3CRET-KEY");
    expect(url).toBe("/api/v1/links/my%20link/stats");
    expect(url).not.toContain("S3CRET-KEY");
    expect(url).not.toContain("?");
    expect(init.headers).toEqual({ Authorization: "Bearer S3CRET-KEY" });
    expect(init.cache).toBe("no-store");
    expect(init.body).toBeUndefined();
    expect(JSON.stringify(init)).toContain("S3CRET-KEY");
    expect(JSON.stringify({ ...init, headers: undefined })).not.toContain("S3CRET-KEY");
  });

  it("builds the path from the encoded id", () => {
    expect(ownerStatsPath("a/b")).toBe("/api/v1/links/a%2Fb/stats");
  });
});

describe("parseCities", () => {
  it("keeps well-formed rows and nulls bad coordinates", () => {
    const rows = parseCities({
      cities: [
        { country: "PL", city: "Warsaw", lat: 52.23, lon: 21.01, visits: 3 },
        { country: "DE", city: "Berlin", lat: null, lon: "x", visits: 1 },
        { city: 5, visits: 1 },
        null,
      ],
    });
    expect(rows).toEqual([
      { country: "PL", city: "Warsaw", lat: 52.23, lon: 21.01, visits: 3 },
      { country: "DE", city: "Berlin", lat: null, lon: null, visits: 1 },
    ]);
  });

  it("returns an empty list for anything else", () => {
    expect(parseCities(null)).toEqual([]);
    expect(parseCities({})).toEqual([]);
    expect(parseCities({ cities: "x" })).toEqual([]);
  });
});

describe("countryName", () => {
  it("names known codes and labels unknown ones", () => {
    expect(countryName("PL", "pl")).toBe("Polska");
    expect(countryName("pl", "pl")).toBe("Polska");
    expect(countryName("PL", "en")).toBe("Poland");
    expect(countryName("", "pl")).toBe("Nieznany kraj");
    expect(countryName("XX", "pl")).toBe("Nieznany kraj");
    expect(countryName("T1", "en")).toBe("Unknown country");
  });
});

describe("hasCoordinates", () => {
  const base = { country: "PL", city: "X", visits: 1 };
  it("is true when any city has both coordinates", () => {
    expect(
      hasCoordinates([
        { ...base, lat: null, lon: null },
        { ...base, lat: 1, lon: 2 },
      ]),
    ).toBe(true);
  });
  it("is false for no cities or cities without a full coordinate pair", () => {
    expect(hasCoordinates([])).toBe(false);
    expect(hasCoordinates([{ ...base, lat: 1, lon: null }])).toBe(false);
  });
});
