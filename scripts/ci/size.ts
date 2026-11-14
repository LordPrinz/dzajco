// Fails CI when a browser bundle in public/assets is larger than the gzip budget.
//
// Usage: bun run build:client && bun scripts/ci/size.ts

import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

export const MAX_GZIP_BYTES = 15 * 1024;
export const ASSETS_DIR = "public/assets";
/** The map bundle loads on demand on the stats page only, so the page budget leaves it out. */
export const EXEMPT = /^map-/;

export interface Bundle {
  name: string;
  gzipBytes: number;
}

export function gzipSize(source: Uint8Array): number {
  return gzipSync(source, { level: 9 }).byteLength;
}

/** Names of the bundles that count against the budget: every `.js` file but the exempt ones. */
export function budgeted(names: readonly string[]): string[] {
  return names.filter((name) => name.endsWith(".js") && !EXEMPT.test(name));
}

/** Names of the budgeted bundles whose source mentions Leaflet: it may live in the map bundle only. */
export function leafletLeaks(
  names: readonly string[],
  read: (name: string) => string = (name) => readFileSync(`${ASSETS_DIR}/${name}`, "utf8"),
): string[] {
  return budgeted(names).filter((name) => /leaflet/i.test(read(name)));
}

/** Map bundles that lost the Leaflet copyright notice (BSD-2 requires it to ship with the binary). */
export function missingNotice(
  names: readonly string[],
  read: (name: string) => string = (name) => readFileSync(`${ASSETS_DIR}/${name}`, "utf8"),
): string[] {
  return names
    .filter((name) => name.endsWith(".js") && EXEMPT.test(name))
    .filter((name) => !(read(name).includes("Agafonkin") && read(name).includes("Redistribution")));
}

export function overBudget(bundles: readonly Bundle[], limit: number = MAX_GZIP_BYTES): Bundle[] {
  return bundles.filter((bundle) => bundle.gzipBytes > limit);
}

export function measure(dir: string = ASSETS_DIR): Bundle[] {
  return budgeted(readdirSync(dir)).map((name) => ({
    name,
    gzipBytes: gzipSize(readFileSync(`${dir}/${name}`)),
  }));
}

if (import.meta.main) {
  let bundles: Bundle[];
  try {
    bundles = measure();
  } catch {
    console.error(`${ASSETS_DIR} is missing; run bun run build:client first`);
    process.exit(1);
  }
  if (bundles.length === 0) {
    console.error(`no .js bundles in ${ASSETS_DIR}; run bun run build:client first`);
    process.exit(1);
  }
  for (const { name, gzipBytes } of bundles) {
    console.log(
      `${name}: ${(gzipBytes / 1024).toFixed(2)} KB gzip (limit ${MAX_GZIP_BYTES / 1024} KB)`,
    );
  }
  const leaks = leafletLeaks(readdirSync(ASSETS_DIR));
  if (leaks.length > 0) {
    console.error(`leaflet outside the map bundle: ${leaks.join(", ")}`);
    process.exit(1);
  }
  const unlicensed = missingNotice(readdirSync(ASSETS_DIR));
  if (unlicensed.length > 0) {
    console.error(`Leaflet license notice missing in: ${unlicensed.join(", ")}`);
    process.exit(1);
  }
  const over = overBudget(bundles);
  if (over.length > 0) {
    console.error(`over budget: ${over.map((b) => b.name).join(", ")}`);
    process.exit(1);
  }
}
