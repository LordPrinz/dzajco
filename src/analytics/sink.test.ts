import { describe, expect, it } from "bun:test";
import { aeSink, visitPoint } from "./sink.ts";

function dataset(onWrite: (p: AnalyticsEngineDataPoint) => void = () => {}) {
  const points: AnalyticsEngineDataPoint[] = [];
  return {
    points,
    writeDataPoint(p: AnalyticsEngineDataPoint) {
      onWrite(p);
      points.push(p);
    },
  };
}

describe("visitPoint", () => {
  it("parses latitude and longitude from the cf strings", () => {
    expect(
      visitPoint("abc", 1700, {
        country: "PL",
        city: "Warsaw",
        latitude: "52.22977",
        longitude: "21.01178",
      }),
    ).toEqual({
      linkId: "abc",
      createdAt: 1700,
      country: "PL",
      city: "Warsaw",
      lat: 52.22977,
      lon: 21.01178,
    });
  });

  it("uses empty strings and nulls when cf data is missing or broken", () => {
    expect(visitPoint("abc", 1700, undefined)).toEqual({
      linkId: "abc",
      createdAt: 1700,
      country: "",
      city: "",
      lat: null,
      lon: null,
    });
    expect(visitPoint("abc", 1700, { latitude: "north", longitude: "" })).toMatchObject({
      lat: null,
      lon: null,
    });
  });
});

describe("aeSink", () => {
  it("writes indexes [linkId], blobs [country, city, createdAt], doubles [lat, lon]", () => {
    const ds = dataset();
    aeSink(ds).write({
      linkId: "abc",
      createdAt: 1700,
      country: "PL",
      city: "Warsaw",
      lat: 52.2,
      lon: 21,
    });
    expect(ds.points).toEqual([
      { indexes: ["abc"], blobs: ["PL", "Warsaw", "1700"], doubles: [52.2, 21] },
    ]);
  });

  it("writes no doubles when a coordinate is missing", () => {
    const ds = dataset();
    aeSink(ds).write({
      linkId: "abc",
      createdAt: 1700,
      country: "PL",
      city: "",
      lat: 52.2,
      lon: null,
    });
    expect(ds.points).toEqual([{ indexes: ["abc"], blobs: ["PL", "", "1700"], doubles: [] }]);
  });

  it("never throws", () => {
    const ds = dataset(() => {
      throw new Error("quota");
    });
    expect(() =>
      aeSink(ds).write({
        linkId: "abc",
        createdAt: 1700,
        country: "",
        city: "",
        lat: null,
        lon: null,
      }),
    ).not.toThrow();
  });
});
