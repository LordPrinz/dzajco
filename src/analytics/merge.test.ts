import { describe, expect, it } from "bun:test";
import { mergeCities, mergeCountries } from "./merge";
import type { VisitRow } from "./ports";

const row = (r: Partial<VisitRow>): VisitRow => ({
  linkId: "a",
  createdAt: 100,
  country: "PL",
  city: "Warsaw",
  visits: 1,
  lat: null,
  lon: null,
  ...r,
});

describe("mergeCountries", () => {
  it("sums D1 and the fresh rows of one link, sorted by visits then code", () => {
    const d1 = { cursor: null, createdAt: 100, visits: 3, countries: [{ code: "DE", visits: 3 }] };
    const fresh = [
      row({ country: "PL", visits: 2 }),
      row({ country: "PL", city: "", visits: 1 }),
      row({ linkId: "b", country: "FR", visits: 9 }),
      row({ country: "AT", visits: 3 }),
    ];
    expect(mergeCountries(d1, fresh, "a", 100)).toEqual({
      visits: 9,
      countries: [
        { code: "AT", visits: 3 },
        { code: "DE", visits: 3 },
        { code: "PL", visits: 3 },
      ],
    });
  });
});

describe("mergeCities", () => {
  const d1 = (cities: ReturnType<typeof mergeCities>) => ({
    cursor: null,
    createdAt: 100,
    visits: 0,
    countries: [],
    cities,
  });

  it("weights coordinates by the visits that have them and rounds to 2 decimals", () => {
    const merged = mergeCities(
      d1([{ country: "PL", city: "Warsaw", lat: 52.2, lon: 21, visits: 1 }]),
      [row({ lat: 52.4, lon: 21.04, visits: 3 }), row({ visits: 5 })],
      "a",
      100,
    );
    expect(merged).toEqual([{ country: "PL", city: "Warsaw", lat: 52.35, lon: 21.03, visits: 9 }]);
  });

  it("keeps null coordinates when no source has them and skips rows without a city", () => {
    expect(mergeCities(d1([]), [row({ city: "Lodz" }), row({ city: "" })], "a", 100)).toEqual([
      { country: "PL", city: "Lodz", lat: null, lon: null, visits: 1 },
    ]);
  });
});
