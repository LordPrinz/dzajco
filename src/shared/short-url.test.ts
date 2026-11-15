import { describe, expect, it } from "bun:test";
import { withoutProtocol } from "./short-url";

describe("withoutProtocol", () => {
  it("drops http and https only", () => {
    expect(withoutProtocol("https://dzaj.de/abc")).toBe("dzaj.de/abc");
    expect(withoutProtocol("http://localhost:8787/x")).toBe("localhost:8787/x");
    expect(withoutProtocol("ftp://x/y")).toBe("ftp://x/y");
  });
});
