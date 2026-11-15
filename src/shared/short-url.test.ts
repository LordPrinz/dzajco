import { describe, expect, it } from "bun:test";
import { codeFromInput, withoutProtocol } from "./short-url";

describe("codeFromInput", () => {
  it("takes the code from a full short URL", () => {
    expect(codeFromInput("https://dzaj.de/abc123")).toBe("abc123");
    expect(codeFromInput("http://localhost:8787/abc123/stats")).toBe("abc123");
  });

  it("takes the code from a short link without the protocol, as the site shows it", () => {
    expect(codeFromInput("dzaj.de/abc123")).toBe("abc123");
    expect(codeFromInput(" test.dzaj.de/abc ")).toBe("abc");
    expect(codeFromInput("dzaj.de/za%C5%BC%C3%B3%C5%82%C4%87/stats")).toBe("zażółć");
  });

  it("accepts a bare code and trims spaces", () => {
    expect(codeFromInput("  abc123 ")).toBe("abc123");
    expect(codeFromInput(" https://dzaj.de/abc123 ")).toBe("abc123");
  });

  it("decodes an encoded code and keeps a malformed one as typed", () => {
    expect(codeFromInput("https://dzaj.de/za%C5%BC%C3%B3%C5%82%C4%87")).toBe("zażółć");
    expect(codeFromInput("https://dzaj.de/%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("gives an empty code for a URL without a path", () => {
    expect(codeFromInput("https://dzaj.de/")).toBe("");
    expect(codeFromInput("   ")).toBe("");
  });
});

describe("withoutProtocol", () => {
  it("drops http and https only", () => {
    expect(withoutProtocol("https://dzaj.de/abc")).toBe("dzaj.de/abc");
    expect(withoutProtocol("http://localhost:8787/x")).toBe("localhost:8787/x");
    expect(withoutProtocol("ftp://x/y")).toBe("ftp://x/y");
  });
});
