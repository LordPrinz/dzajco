import { describe, expect, it } from "bun:test";
import { DEFAULT_DATASET } from "./ae-source.ts";

interface EnvConfig {
  analytics_engine_datasets?: { binding: string; dataset: string }[];
  vars?: Record<string, string>;
}

// wrangler.jsonc has only full-line comments, so stripping those lines is enough (URLs contain `//`).
const text = await Bun.file(new URL("../../wrangler.jsonc", import.meta.url)).text();
const config = JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) as EnvConfig & {
  env?: Record<string, EnvConfig>;
};

describe("wrangler.jsonc AE_DATASET", () => {
  const environments: [string, EnvConfig][] = [
    ["top-level", config],
    ...Object.entries(config.env ?? {}),
  ];

  it.each(environments)("%s: AE_DATASET matches the VISITS binding dataset", (_name, env) => {
    const visits = env.analytics_engine_datasets?.find((d) => d.binding === "VISITS");
    expect(visits?.dataset).toBeDefined();
    expect(env.vars?.AE_DATASET ?? DEFAULT_DATASET).toBe(visits?.dataset as string);
  });
});
