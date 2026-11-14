import { describe, expect, it } from "bun:test";
import { domainSources, missingFiles, ratio, sumLines } from "./coverage.ts";

const report = [
  "SF:src/domain/a.ts",
  "LF:10",
  "LH:9",
  "end_of_record",
  "SF:src/domain/a.test.ts",
  "LF:100",
  "LH:100",
  "end_of_record",
  "SF:src/index.ts",
  "LF:50",
  "LH:0",
  "end_of_record",
  "SF:src/domain/b.ts",
  "LF:10",
  "LH:5",
  "end_of_record",
].join("\n");

describe("coverage script", () => {
  it("sums only non-test files under src/domain", () => {
    expect(sumLines(report)).toEqual({ found: 20, hit: 14 });
  });

  it("computes the ratio and treats an empty scope as 0", () => {
    expect(ratio({ found: 20, hit: 14 })).toBe(0.7);
    expect(ratio({ found: 0, hit: 0 })).toBe(0);
  });

  it("reports domain files that are absent from the report", () => {
    expect(missingFiles(report, ["src/domain/a.ts", "src/domain/c.ts"])).toEqual([
      "src/domain/c.ts",
    ]);
  });

  it("lists non-test sources of src/domain", () => {
    const files = domainSources();
    expect(files).toContain("src/domain/ids.ts");
    expect(files.some((f) => f.endsWith(".test.ts"))).toBe(false);
  });
});
