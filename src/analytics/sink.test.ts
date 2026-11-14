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
      visitPoint("abc", {
        country: "PL",
        city: "Warsaw",
        latitude: "52.22977",
        longitude: "21.01178",
      }),
    ).toEqual({ linkId: "abc", country: "PL", city: "Warsaw", lat: 52.22977, lon: 21.01178 });
  });

  it("uses empty strings and nulls when cf data is missing or broken", () => {
    expect(visitPoint("abc", undefined)).toEqual({
      linkId: "abc",
      country: "",
      city: "",
      lat: null,
      lon: null,
    });
    expect(visitPoint("abc", { latitude: "north", longitude: "" })).toMatchObject({
      lat: null,
      lon: null,
    });
  });
});

describe("aeSink", () => {
  it("writes indexes [linkId], blobs [country, city], doubles [lat, lon]", () => {
    const ds = dataset();
    aeSink(ds).write({ linkId: "abc", country: "PL", city: "Warsaw", lat: 52.2, lon: 21 });
    expect(ds.points).toEqual([{ indexes: ["abc"], blobs: ["PL", "Warsaw"], doubles: [52.2, 21] }]);
  });

  it("writes no doubles when a coordinate is missing", () => {
    const ds = dataset();
    aeSink(ds).write({ linkId: "abc", country: "PL", city: "", lat: 52.2, lon: null });
    expect(ds.points).toEqual([{ indexes: ["abc"], blobs: ["PL", ""], doubles: [] }]);
  });

  it("never throws", () => {
    const ds = dataset(() => {
      throw new Error("quota");
    });
    expect(() =>
      aeSink(ds).write({ linkId: "abc", country: "", city: "", lat: null, lon: null }),
    ).not.toThrow();
  });
});
