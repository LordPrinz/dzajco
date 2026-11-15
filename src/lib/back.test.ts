import { describe, expect, it } from "bun:test";
import { safeBack } from "./back";

describe("safeBack", () => {
  it.each([
    ["/", "/"],
    ["/about", "/about"],
    ["/abc/stats?x=1", "/abc/stats?x=1"],
    ["/docs/api#cors", "/docs/api"],
  ])("keeps the same-site path %s", (raw, expected) => {
    expect(safeBack(raw)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    "",
    "about",
    "https://evil.example/",
    "//evil.example/x",
    "/\\evil.example",
    "javascript:alert(1)",
    // Dot segments that normalise into a protocol-relative URL.
    "/.//evil.com",
    "/x/..//evil.com",
    "/%2e//evil.com",
    "/.//x//attacker.com",
    "/..//evil.example/x",
    "/a/..//evil.example",
  ])("falls back to / for %p", (raw) => {
    expect(safeBack(raw)).toBe("/");
  });
});
