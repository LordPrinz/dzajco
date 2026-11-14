import { describe, expect, it } from "bun:test";
import { sqlString } from "./sql";

describe("sqlString", () => {
  it("doubles single quotes", () => {
    expect(sqlString("it's")).toBe("'it''s'");
  });
  it("keeps hostile input inside one literal", () => {
    expect(sqlString("'; DROP TABLE links; --")).toBe("'''; DROP TABLE links; --'");
  });
  it("rejects control characters", () => {
    expect(() => sqlString("a\0b")).toThrow();
    expect(() => sqlString("a\nb")).toThrow();
  });
});
