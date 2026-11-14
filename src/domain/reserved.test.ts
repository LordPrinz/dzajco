import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { APP_ROUTES, PUBLIC_ENTRIES, RESERVED_NAMES, reservedFrom } from "./reserved.ts";

const PUBLIC_DIR = join(import.meta.dir, "../../public");

describe("reserved names", () => {
  it("reservedFrom merges routes and public entries", () => {
    const set = reservedFrom(["a"], ["b"]);
    expect([...set].sort()).toEqual(["a", "b"]);
  });

  it("every top-level entry of public/ is reserved", () => {
    const entries = readdirSync(PUBLIC_DIR);
    const missing = entries
      .filter((entry) => !entry.startsWith("."))
      .filter((entry) => !RESERVED_NAMES.has(entry));
    expect(missing).toEqual([]);
  });

  it("the static public list names only entries that exist or are build output", () => {
    const entries = new Set(readdirSync(PUBLIC_DIR));
    const buildOutput = new Set(["assets", "css", "_headers", "robots.txt", "sitemap.xml"]);
    const stale = PUBLIC_ENTRIES.filter((e) => !entries.has(e) && !buildOutput.has(e));
    expect(stale).toEqual([]);
  });

  it("includes the app routes", () => {
    for (const route of APP_ROUTES) expect(RESERVED_NAMES.has(route)).toBe(true);
  });
});
