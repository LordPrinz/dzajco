import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HEADERS_FILE = join(import.meta.dir, "../../public/_headers");

/** Parses the `_headers` format (path line, then indented `Name: value` lines) into rules. */
function parseHeaders(text: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let current: Map<string, string> | null = null;
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = new Map();
      rules.set(line.trim(), current);
      continue;
    }
    const colon = line.indexOf(":");
    if (!current || colon < 0) throw new Error(`Bad header line: ${line}`);
    current.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return rules;
}

describe("public/_headers", () => {
  const all = parseHeaders(readFileSync(HEADERS_FILE, "utf8")).get("/*");

  it("gives every static asset the base security headers", () => {
    expect(all?.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
    expect(all?.get("x-content-type-options")).toBe("nosniff");
    expect(all?.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("sets a CSP that denies everything except same-origin styles, images and fonts", () => {
    const csp = all?.get("content-security-policy") ?? "";
    expect(csp.startsWith("default-src 'none';")).toBe(true);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toContain("script-src");
    expect(csp).not.toContain("unsafe-");
  });
});
