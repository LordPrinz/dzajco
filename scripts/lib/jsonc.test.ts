import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonc } from "./jsonc";

describe("parseJsonc", () => {
  it("drops comments and trailing commas but keeps comment-like text inside strings", () => {
    const text = `{
      // line comment
      "url": "https://example.com/a//b", /* block */
      "list": [1, 2,],
      "quote": "say \\"/* hi */\\"",
      "comma": "a,]",
    }`;
    expect(parseJsonc(text)).toEqual({
      url: "https://example.com/a//b",
      list: [1, 2],
      quote: 'say "/* hi */"',
      comma: "a,]",
    });
  });
  it("drops a trailing comma followed by a comment", () => {
    expect(parseJsonc('{"a":1, // c\n}')).toEqual({ a: 1 });
    expect(parseJsonc("[1, /* c */ ]")).toEqual([1]);
  });
  it("reads the project's wrangler.jsonc", () => {
    const config = parseJsonc(
      readFileSync(join(import.meta.dirname, "../../wrangler.jsonc"), "utf8"),
    );
    expect(config).toMatchObject({ vars: { SECRET_PEPPER_VERSION: "1" } });
  });
  it("throws on unterminated input", () => {
    expect(() => parseJsonc('{"a": "b')).toThrow();
    expect(() => parseJsonc("{ /* x")).toThrow();
  });
});
