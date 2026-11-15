import { describe, expect, it } from "bun:test";
import { hostIsIdn } from "./host";

describe("hostIsIdn", () => {
  it("detects a punycode label anywhere in the host", () => {
    expect(hostIsIdn("xn--pnk-qma.pl")).toBe(true);
    expect(hostIsIdn("www.xn--pnk-qma.pl")).toBe(true);
    expect(hostIsIdn("example.com")).toBe(false);
    expect(hostIsIdn("notxn--example.com")).toBe(false);
  });
});
