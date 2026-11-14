import { describe, expect, it } from "bun:test";
import {
  budgeted,
  gzipSize,
  leafletLeaks,
  MAX_GZIP_BYTES,
  missingNotice,
  overBudget,
} from "./size.ts";

describe("budgeted", () => {
  it("keeps page bundles and leaves out the map bundle and non-js files", () => {
    expect(budgeted(["form.js", "map-abc.js", "form.js.map", "x.css"])).toEqual(["form.js"]);
  });
});

describe("overBudget", () => {
  it("flags only bundles above the limit", () => {
    const bundles = [
      { name: "a.js", gzipBytes: MAX_GZIP_BYTES },
      { name: "b.js", gzipBytes: MAX_GZIP_BYTES + 1 },
    ];
    expect(overBudget(bundles)).toEqual([{ name: "b.js", gzipBytes: MAX_GZIP_BYTES + 1 }]);
  });

  it("accepts a custom limit", () => {
    expect(overBudget([{ name: "a.js", gzipBytes: 11 }], 10)).toHaveLength(1);
  });
});

describe("gzipSize", () => {
  it("measures the compressed size, not the raw size", () => {
    const repetitive = new TextEncoder().encode("a".repeat(10_000));
    expect(gzipSize(repetitive)).toBeLessThan(100);
  });
});

describe("leafletLeaks", () => {
  const sources: Record<string, string> = {
    "form.js": "console.log(1)",
    "stats.js": "import('./map-abc.js')",
    "map-abc.js": "/* Leaflet 1.9.4 */",
    "other.js": "var L=window.leaflet",
  };
  const read = (name: string) => sources[name] ?? "";

  it("ignores the map bundle and flags any other bundle that mentions leaflet", () => {
    expect(leafletLeaks(Object.keys(sources), read)).toEqual(["other.js"]);
  });

  it("is empty when only the map bundle has it", () => {
    expect(leafletLeaks(["form.js", "stats.js", "map-abc.js"], read)).toEqual([]);
  });
});

describe("missingNotice", () => {
  const licensed = "/*! Leaflet (c) Vladimir Agafonkin ... Redistribution and use ... */";
  it("flags map bundles without the copyright and license text", () => {
    const read = (name: string) => (name === "map-ok.js" ? licensed : "var a=1");
    expect(missingNotice(["map-ok.js", "map-bad.js", "form.js"], read)).toEqual(["map-bad.js"]);
  });
});
