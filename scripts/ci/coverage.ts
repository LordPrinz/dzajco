// Fails CI when line coverage of src/domain drops below the minimum.
//
// Usage: bun test ./src --coverage --coverage-reporter=lcov && bun scripts/ci/coverage.ts

import { readdirSync } from "node:fs";

export const MINIMUM_LINES = 0.9;
export const SCOPE = "src/domain/";

export interface LineTotals {
  found: number;
  hit: number;
}

/** Sums the `LF`/`LH` records of every non-test file under `scope` in an lcov report. */
export function sumLines(report: string, scope: string = SCOPE): LineTotals {
  const totals: LineTotals = { found: 0, hit: 0 };
  let inScope = false;
  for (const line of report.split("\n")) {
    if (line.startsWith("SF:")) {
      const file = line.slice(3).replaceAll("\\", "/");
      inScope = file.includes(scope) && !file.endsWith(".test.ts");
    } else if (inScope && line.startsWith("LF:")) totals.found += Number(line.slice(3));
    else if (inScope && line.startsWith("LH:")) totals.hit += Number(line.slice(3));
  }
  return totals;
}

/** Domain source files that never show up in the report (not even at 0%) mean the run skipped them. */
export function missingFiles(report: string, files: readonly string[]): string[] {
  const reported = report
    .split("\n")
    .filter((line) => line.startsWith("SF:"))
    .map((line) => line.slice(3).replaceAll("\\", "/"));
  return files.filter((file) => !reported.some((r) => r.endsWith(file)));
}

export function domainSources(dir: string = SCOPE): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => `${dir}${name}`);
}

export function ratio({ found, hit }: LineTotals): number {
  return found === 0 ? 0 : hit / found;
}

if (import.meta.main) {
  const file = Bun.file("coverage/lcov.info");
  if (!(await file.exists())) {
    console.error(
      "coverage/lcov.info is missing; run bun test with --coverage-reporter=lcov first",
    );
    process.exit(1);
  }
  const text = await file.text();
  const missing = missingFiles(text, domainSources());
  if (missing.length > 0) {
    console.error(`not in the coverage report: ${missing.join(", ")}`);
    process.exit(1);
  }
  const totals = sumLines(text);
  if (totals.found === 0) {
    console.error(`coverage/lcov.info holds no line data for ${SCOPE}`);
    process.exit(1);
  }
  const percent = (ratio(totals) * 100).toFixed(2);
  console.log(`Coverage of ${SCOPE}: lines ${percent}% (${totals.hit}/${totals.found})`);
  if (ratio(totals) < MINIMUM_LINES) {
    console.error(`lines: ${percent}% is below the minimum ${MINIMUM_LINES * 100}%`);
    process.exit(1);
  }
}
