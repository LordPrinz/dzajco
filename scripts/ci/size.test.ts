import { describe, expect, it } from "bun:test";
import { budgeted, gzipSize, MAX_GZIP_BYTES, overBudget } from "./size.ts";

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
